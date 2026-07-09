/********************************************************************************
 * Eclipse Tractus-X - Industry Core Hub Frontend
 *
 * Copyright (c) 2026 Contributors to the Eclipse Foundation
 *
 * See the NOTICE file(s) distributed with this work for additional
 * information regarding copyright ownership.
 *
 * This program and the accompanying materials are made available under the
 * terms of the Apache License, Version 2.0 which is available at
 * https://www.apache.org/licenses/LICENSE-2.0.
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND,
 * either express or implied. See the
 * License for the specific language govern in permissions and limitations
 * under the License.
 *
 * SPDX-License-Identifier: Apache-2.0
 ********************************************************************************/

import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Container,
  InputAdornment,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import { ArrowBack, Search as SearchIcon } from '@mui/icons-material';
import { fetchSerializedPartTwinDetails } from '@/features/industry-core-kit/serialized-parts/api';
import { SerializedPartTwinDetailsRead } from '@/features/industry-core-kit/serialized-parts/types/twin-types';
import { darkCardStyles } from '@/features/eco-pass-kit/passport-provision/styles/cardStyles';
import { getParticipantId } from '@/services/EnvironmentService';
import {
  ensureQualityInvestigationAcknowledgements,
  getQualityInvestigationNotificationContentString,
  QI_CONTEXT_FAULT,
  QI_CONTEXT_REQUEST,
  QualityInvestigationNotification,
} from '../api';

interface ReceivedRequestRow {
  id: string;
  requestMessageId: string;
  localPartGlobalId: string;
  localPartInstanceId: string;
  manufacturerId: string;
  manufacturerPartId: string;
  requesterBpn: string;
  requesterPartGlobalId: string;
  status: 'OPEN' | 'OK';
  requestOpenedAt: string;
  requestClosedAt?: string;
  faultMessageId?: string;
}

const localBpn = getParticipantId();

const formatDateTime = (value?: string): string => {
  if (!value) {
    return 'n/a';
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
};

const getStatusStyles = (status: 'OPEN' | 'OK'): { background: string; color: string } => {
  return status === 'OPEN'
    ? { background: 'linear-gradient(135deg, #ff9f1c 0%, #ff7a00 100%)', color: '#fff' }
    : { background: 'linear-gradient(135deg, #41c77b 0%, #2f8f49 100%)', color: '#fff' };
};

const TraceabilityQualityInvestigationReceiverInboxPage: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [rows, setRows] = useState<ReceivedRequestRow[]>([]);

  useEffect(() => {
    const loadReceivedRequests = async () => {
      setLoading(true);
      setError(null);

      try {
        const notifications = await ensureQualityInvestigationAcknowledgements(localBpn);
        const incomingRequests = notifications.filter((notification) => {
          return notification.context === QI_CONTEXT_REQUEST
            && notification.receiverBpn === localBpn;
        });

        const uniqueLocalPartIds = [...new Set(
          incomingRequests
            .map((notification) => getQualityInvestigationNotificationContentString(notification, 'remotePartGlobalId'))
            .filter(Boolean)
        )];

        const twinEntries = await Promise.all(
          uniqueLocalPartIds.map(async (globalId) => {
            try {
              const twin = await fetchSerializedPartTwinDetails(globalId);
              return [globalId, twin] as const;
            } catch {
              return [globalId, null] as const;
            }
          })
        );

        const twinMap = new Map<string, SerializedPartTwinDetailsRead | null>(twinEntries);

        const mappedRows = incomingRequests.map((notification) => {
          const localPartGlobalId = getQualityInvestigationNotificationContentString(notification, 'remotePartGlobalId');
          const requesterPartGlobalId = getQualityInvestigationNotificationContentString(notification, 'localPartGlobalId');
          const fallbackPartInstanceId = getQualityInvestigationNotificationContentString(notification, 'localPartInstanceId');
          const twin = twinMap.get(localPartGlobalId) ?? null;
          const faultNotification = notifications.find((candidate) => {
            return candidate.context === QI_CONTEXT_FAULT
              && candidate.senderBpn === localBpn
              && candidate.relatedMessageId === notification.messageId;
          });

          return {
            id: notification.messageId,
            requestMessageId: notification.messageId,
            localPartGlobalId,
            localPartInstanceId: twin?.partInstanceId ?? fallbackPartInstanceId ?? 'n/a',
            manufacturerId: twin?.manufacturerId ?? 'n/a',
            manufacturerPartId: twin?.manufacturerPartId ?? 'n/a',
            requesterBpn: notification.senderBpn,
            requesterPartGlobalId,
            status: faultNotification ? 'OK' : 'OPEN',
            requestOpenedAt: notification.createdAt,
            requestClosedAt: faultNotification?.createdAt,
            faultMessageId: faultNotification?.messageId,
          } as ReceivedRequestRow;
        }).sort((left, right) => {
          const byStatus = left.status === right.status ? 0 : (left.status === 'OPEN' ? -1 : 1);
          if (byStatus !== 0) {
            return byStatus;
          }

          const byDate = new Date(right.requestOpenedAt).getTime() - new Date(left.requestOpenedAt).getTime();
          if (byDate !== 0) {
            return byDate;
          }

          const byPart = left.manufacturerPartId.localeCompare(right.manufacturerPartId);
          if (byPart !== 0) {
            return byPart;
          }

          return left.localPartInstanceId.localeCompare(right.localPartInstanceId);
        });

        setRows(mappedRows);
      } catch (loadError) {
        const message = loadError instanceof Error ? loadError.message : 'Failed to load received quality investigation requests.';
        setError(message);
      } finally {
        setLoading(false);
      }
    };

    loadReceivedRequests();
  }, []);

  const filteredRows = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) {
      return rows;
    }

    return rows.filter((row) =>
      row.manufacturerId.toLowerCase().includes(query)
      || row.manufacturerPartId.toLowerCase().includes(query)
      || row.localPartInstanceId.toLowerCase().includes(query)
      || row.localPartGlobalId.toLowerCase().includes(query)
      || row.requesterBpn.toLowerCase().includes(query)
      || row.requestMessageId.toLowerCase().includes(query)
      || row.requestOpenedAt.toLowerCase().includes(query)
      || (row.requestClosedAt ?? '').toLowerCase().includes(query)
    );
  }, [rows, searchQuery]);

  return (
    <Container maxWidth="xl" sx={{ py: 3 }}>
      <Button
        startIcon={<ArrowBack />}
        variant="outlined"
        onClick={() => navigate('/traceability/quality-investigation')}
        sx={{
          mb: 2,
          borderColor: 'rgba(255, 122, 0, 0.5)',
          color: '#fff',
          '&:hover': {
            borderColor: 'rgba(255, 122, 0, 0.9)',
            backgroundColor: 'rgba(255, 122, 0, 0.12)',
          },
        }}
      >
        Back To Quality Investigation
      </Button>

      <Card
        sx={{
          background: 'linear-gradient(135deg, rgba(30, 30, 30, 0.95) 0%, rgba(20, 20, 20, 0.95) 100%)',
          border: '1px solid rgba(255, 122, 0, 0.4)',
          borderRadius: 3,
          boxShadow: '0 10px 35px rgba(0, 0, 0, 0.4)',
        }}
      >
        <CardContent>
          <Typography variant="h4" sx={{ color: '#fff', mb: 1 }}>
            VIEW Received QI Requests
          </Typography>
          <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.72)' }}>
            Traceability Quality Investigation requests received by the local partner.
          </Typography>
        </CardContent>
      </Card>

      <Paper
        sx={{
          mt: 3,
          background: 'linear-gradient(135deg, rgba(30, 30, 30, 0.95) 0%, rgba(15, 15, 15, 0.95) 100%)',
          borderRadius: 3,
          border: '1px solid rgba(255,255,255,0.08)',
          p: 2,
        }}
      >
        <TextField
          fullWidth
          value={searchQuery}
          onChange={(event) => setSearchQuery(event.target.value)}
          placeholder="Search by manufacturer ID, part instance, requester BPN, dates or message IDs"
          sx={{
            ...darkCardStyles.textField,
            mb: 3,
            '& .MuiInputBase-input': {
              color: '#fff',
            },
            '& .MuiInputBase-input::placeholder': {
              color: 'rgba(255,255,255,0.5)',
              opacity: 1,
            },
          }}
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon sx={{ color: 'rgba(255,255,255,0.7)' }} />
                </InputAdornment>
              ),
            },
          }}
        />

        {loading && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, p: 2 }}>
            <CircularProgress size={20} />
            <Typography sx={{ color: 'rgba(255,255,255,0.8)' }}>Loading received quality investigation requests...</Typography>
          </Box>
        )}

        {error && (
          <Alert severity="error" sx={{ mt: 1 }}>
            {error}
          </Alert>
        )}

        {!loading && !error && filteredRows.length === 0 && (
          <Alert severity="info" sx={{ mt: 1 }}>
            No received Quality Investigation requests match the current filter.
          </Alert>
        )}

        {!loading && !error && filteredRows.length > 0 && (
          <TableContainer sx={{ mt: 1 }}>
            <Table size="small" sx={{ minWidth: 1100 }}>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ color: '#fff', fontWeight: 700 }}>Manufacturer Part ID / Part Instance ID</TableCell>
                  <TableCell sx={{ color: '#fff', fontWeight: 700 }}>Manufacturer ID</TableCell>
                  <TableCell sx={{ color: '#fff', fontWeight: 700 }}>Requester BPN</TableCell>
                  <TableCell sx={{ color: '#fff', fontWeight: 700 }}>QI opened</TableCell>
                  <TableCell sx={{ color: '#fff', fontWeight: 700 }}>QI closed</TableCell>
                  <TableCell sx={{ color: '#fff', fontWeight: 700 }}>Status</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredRows.map((row) => {
                  const statusStyles = getStatusStyles(row.status);

                  return (
                    <TableRow
                      key={row.id}
                      hover
                      onClick={() => navigate(`/traceability/quality-investigation/respond?globalId=${encodeURIComponent(row.localPartGlobalId)}&requestMessageId=${encodeURIComponent(row.requestMessageId)}&faultMessageId=${encodeURIComponent(row.faultMessageId ?? '')}`)}
                      sx={{
                        cursor: 'pointer',
                        '& td': {
                          color: '#fff',
                        },
                      }}
                    >
                      <TableCell>
                        <Box sx={{ display: 'grid' }}>
                          <Typography variant="body2" sx={{ color: '#fff', fontWeight: 600 }}>
                            {row.manufacturerPartId}
                          </Typography>
                          <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.72)' }}>
                            {row.localPartInstanceId}
                          </Typography>
                        </Box>
                      </TableCell>
                      <TableCell>{row.manufacturerId}</TableCell>
                      <TableCell>{row.requesterBpn}</TableCell>
                      <TableCell>{formatDateTime(row.requestOpenedAt)}</TableCell>
                      <TableCell>{formatDateTime(row.requestClosedAt)}</TableCell>
                      <TableCell>
                        <Button
                          variant="contained"
                          size="small"
                          onClick={(event) => {
                            event.stopPropagation();
                            navigate(`/traceability/quality-investigation/respond?globalId=${encodeURIComponent(row.localPartGlobalId)}&requestMessageId=${encodeURIComponent(row.requestMessageId)}&faultMessageId=${encodeURIComponent(row.faultMessageId ?? '')}`);
                          }}
                          sx={{
                            minWidth: 110,
                            background: statusStyles.background,
                            color: statusStyles.color,
                            textTransform: 'none',
                            '&:hover': {
                              background: statusStyles.background,
                              filter: 'brightness(1.05)',
                            },
                          }}
                        >
                          {row.status === 'OPEN' ? 'QI Requested' : 'OK'}
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Paper>
    </Container>
  );
};

export default TraceabilityQualityInvestigationReceiverInboxPage;
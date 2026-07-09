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
  Grid2,
  InputAdornment,
  Paper,
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
  hasPendingResponse: boolean;
}

const localBpn = getParticipantId();

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

        const mappedRows = incomingRequests
          .map((notification) => {
            const localPartGlobalId = getQualityInvestigationNotificationContentString(notification, 'remotePartGlobalId');
            const requesterPartGlobalId = getQualityInvestigationNotificationContentString(notification, 'localPartGlobalId');
            const fallbackPartInstanceId = getQualityInvestigationNotificationContentString(notification, 'localPartInstanceId');
            const twin = twinMap.get(localPartGlobalId) ?? null;
            const hasPendingResponse = !notifications.some((candidate) => {
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
              hasPendingResponse,
            } as ReceivedRequestRow;
          })
          .sort((left, right) => {
            if (left.hasPendingResponse !== right.hasPendingResponse) {
              return left.hasPendingResponse ? -1 : 1;
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
            Local Part Instances that received a Traceability Quality Investigation request notification.
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
          placeholder="Search by requester BPN, part instance ID, local global asset ID or request message ID"
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
          <Grid2 container spacing={2}>
            {filteredRows.map((row) => (
              <Grid2 key={row.id} size={{ xs: 12, md: 6, xl: 4 }}>
                <Card
                  sx={{
                    ...darkCardStyles.card,
                    height: '100%',
                    border: '1px solid rgba(255, 122, 0, 0.22)',
                  }}
                >
                  <CardContent sx={{ ...darkCardStyles.cardContent }}>
                    <Typography variant="h6" sx={{ color: '#fff', mb: 1 }}>
                      {`${row.manufacturerPartId} / ${row.localPartInstanceId}`}
                    </Typography>
                    <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.7)', mb: 2 }}>
                      Traceability QI request received from remote partner.
                    </Typography>

                    <Box sx={{ display: 'grid', gap: 1.25 }}>
                      <Typography variant="body2" sx={{ color: '#fff' }}>
                        <strong>Manufacturer ID:</strong> {row.manufacturerId}
                      </Typography>
                      <Typography variant="body2" sx={{ color: '#fff' }}>
                        <strong>Manufacturer Part ID:</strong> {row.manufacturerPartId}
                      </Typography>
                      <Typography variant="body2" sx={{ color: '#fff' }}>
                        <strong>Part Instance ID:</strong> {row.localPartInstanceId}
                      </Typography>
                      <Typography variant="body2" sx={{ color: '#fff' }}>
                        <strong>Requester BPN:</strong> {row.requesterBpn}
                      </Typography>
                      <Typography variant="body2" sx={{ color: '#fff', fontFamily: 'monospace' }}>
                        <strong>Local Global Asset ID:</strong> {row.localPartGlobalId}
                      </Typography>
                      <Typography variant="body2" sx={{ color: '#fff', fontFamily: 'monospace' }}>
                        <strong>Requester Global Asset ID:</strong> {row.requesterPartGlobalId || 'n/a'}
                      </Typography>
                    </Box>

                    <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 1, mt: 3, flexWrap: 'wrap' }}>
                      <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.65)', fontFamily: 'monospace', alignSelf: 'center' }}>
                        {row.requestMessageId}
                      </Typography>
                      <Button
                        variant="contained"
                        onClick={() => {
                          if (!row.hasPendingResponse) {
                            return;
                          }

                          navigate(
                            `/traceability/quality-investigation/respond?globalId=${encodeURIComponent(row.localPartGlobalId)}&requestMessageId=${encodeURIComponent(row.requestMessageId)}`
                          );
                        }}
                        disabled={!row.hasPendingResponse}
                        sx={{
                          background: row.hasPendingResponse
                            ? 'linear-gradient(135deg, #ff9f1c 0%, #ff7a00 100%)'
                            : 'linear-gradient(135deg, #41c77b 0%, #2f8f49 100%)',
                          color: '#fff',
                          textTransform: 'none',
                          '&.Mui-disabled': {
                            color: '#fff',
                            opacity: 0.85,
                          },
                        }}
                      >
                        {row.hasPendingResponse ? 'QI Requested' : 'OK'}
                      </Button>
                    </Box>
                  </CardContent>
                </Card>
              </Grid2>
            ))}
          </Grid2>
        )}
      </Paper>
    </Container>
  );
};

export default TraceabilityQualityInvestigationReceiverInboxPage;
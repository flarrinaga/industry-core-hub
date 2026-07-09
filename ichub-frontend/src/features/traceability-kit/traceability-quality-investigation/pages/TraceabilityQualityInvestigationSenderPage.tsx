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
  Chip,
  CircularProgress,
  Container,
  Grid2,
  InputAdornment,
  Paper,
  TextField,
  Typography,
} from '@mui/material';
import { ArrowBack, Launch as LaunchIcon, Search as SearchIcon } from '@mui/icons-material';
import { fetchAllSerializedPartTwins, fetchSerializedPartTwinDetails } from '@/features/industry-core-kit/serialized-parts/api';
import { SerializedPartTwinDetailsRead } from '@/features/industry-core-kit/serialized-parts/types/twin-types';
import { getParticipantId } from '@/services/EnvironmentService';
import { darkCardStyles } from '@/features/eco-pass-kit/passport-provision/styles/cardStyles';
import {
  fetchBomAsBuiltSubmodelContent,
  fetchQualityInvestigationNotifications,
  getFinishedQualityInvestigationRequestIds,
  QI_CONTEXT_ACK,
  QI_CONTEXT_FAULT,
  QI_CONTEXT_REQUEST,
  QualityInvestigationNotification,
  QualityInvestigationStatus,
} from '../api';
import {
  BOM_AS_BUILT_SEMANTIC_ID,
  BOM_AS_BUILT_SEMANTIC_ID_ALT,
  BomChildItem,
  toChildItems,
  TwinAspectRead,
} from '../utils/bomAsBuilt';

interface InvestigationRow {
  id: string;
  name: string;
  manufacturerId: string;
  manufacturerPartId: string;
  partInstanceId: string;
  globalId: string;
  dtrAasId: string;
  bomSubmodelCount: number;
  relationStatuses: RelationStatus[];
}

interface RelationStatus {
  id: string;
  remoteBpn: string;
  remotePartGlobalId: string;
  status: QualityInvestigationStatus;
  requestMessageId?: string;
  faultMessageId?: string;
}

const localBpn = getParticipantId();

const getChildString = (childItem: BomChildItem, key: string): string => {
  const value = childItem[key];
  if (typeof value === 'string') {
    return value;
  }

  if (typeof value === 'number') {
    return String(value);
  }

  return '';
};

const getNotificationContentString = (notification: QualityInvestigationNotification, key: string): string => {
  const value = notification.content[key];
  if (typeof value === 'string') {
    return value;
  }

  if (typeof value === 'number') {
    return String(value);
  }

  return '';
};

const getStatusChipConfig = (status: QualityInvestigationStatus): {
  label: string;
  backgroundColor: string;
  color: string;
} => {
  switch (status) {
    case 'OPEN':
      return { label: 'QI Sent', backgroundColor: '#f7d358', color: '#1a1a1a' };
    case 'ACK':
      return { label: 'QI Ack', backgroundColor: '#f7d358', color: '#1a1a1a' };
    case 'ACCEPTED':
      return { label: 'QI Accepted', backgroundColor: '#8ed1fc', color: '#082032' };
    case 'OK':
    default:
      return { label: 'OK', backgroundColor: '#6ccf7d', color: '#0f2716' };
  }
};

const resolveChildInvestigationState = (
  localPartGlobalId: string,
  childItem: BomChildItem,
  notifications: QualityInvestigationNotification[],
  finishedRequestIds: Set<string>,
): RelationStatus => {
  const remoteBpn = getChildString(childItem, 'businessPartner');
  const remotePartGlobalId = getChildString(childItem, 'globalAssetId');

  if (!remoteBpn || !remotePartGlobalId || !localPartGlobalId) {
    return {
      id: `${remoteBpn || 'n/a'}::${remotePartGlobalId || 'n/a'}`,
      remoteBpn,
      remotePartGlobalId,
      status: 'OK',
    };
  }

  const request = notifications.find((notification) => {
    return notification.context === QI_CONTEXT_REQUEST
      && notification.senderBpn === localBpn
      && notification.receiverBpn === remoteBpn
      && getNotificationContentString(notification, 'localPartGlobalId') === localPartGlobalId
      && getNotificationContentString(notification, 'remotePartGlobalId') === remotePartGlobalId;
  });

  if (!request || finishedRequestIds.has(request.messageId)) {
    return {
      id: `${remoteBpn}::${remotePartGlobalId}`,
      remoteBpn,
      remotePartGlobalId,
      status: 'OK',
    };
  }

  const fault = notifications.find((notification) => {
    return notification.context === QI_CONTEXT_FAULT
      && notification.senderBpn === remoteBpn
      && notification.receiverBpn === localBpn
      && notification.relatedMessageId === request.messageId;
  });

  if (fault) {
    return {
      id: `${remoteBpn}::${remotePartGlobalId}`,
      remoteBpn,
      remotePartGlobalId,
      status: 'ACCEPTED',
      requestMessageId: request.messageId,
      faultMessageId: fault.messageId,
    };
  }

  const ack = notifications.find((notification) => {
    return notification.context === QI_CONTEXT_ACK
      && notification.senderBpn === remoteBpn
      && notification.receiverBpn === localBpn
      && notification.relatedMessageId === request.messageId;
  });

  if (ack) {
    return {
      id: `${remoteBpn}::${remotePartGlobalId}`,
      remoteBpn,
      remotePartGlobalId,
      status: 'ACK',
      requestMessageId: request.messageId,
    };
  }

  return {
    id: `${remoteBpn}::${remotePartGlobalId}`,
    remoteBpn,
    remotePartGlobalId,
    status: 'OPEN',
    requestMessageId: request.messageId,
  };
};

const TraceabilityQualityInvestigationSenderPage: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<InvestigationRow[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  const getBomAsBuiltAspects = (twinDetails: SerializedPartTwinDetailsRead): TwinAspectRead[] => {
    const fromAllAspects = twinDetails.allAspects ?? [];
    const fromAspectMap = Object.values(twinDetails.aspects ?? {});

    return [...fromAllAspects, ...fromAspectMap].filter((aspect, index, allAspects) => {
      const isBomAspect = aspect.semanticId === BOM_AS_BUILT_SEMANTIC_ID || aspect.semanticId === BOM_AS_BUILT_SEMANTIC_ID_ALT;
      if (!isBomAspect) {
        return false;
      }

      return allAspects.findIndex((candidate) => candidate.submodelId === aspect.submodelId) === index;
    });
  };

  useEffect(() => {
    const loadInvestigationData = async () => {
      setLoading(true);
      setError(null);

      try {
        const localTwins = await fetchAllSerializedPartTwins();
        const notifications = await fetchQualityInvestigationNotifications(localBpn);
        const finishedRequestIds = new Set(getFinishedQualityInvestigationRequestIds());
        const detailedTwins = await Promise.all(
          localTwins
            .filter((twin) => Boolean(twin.globalId))
            .map(async (twin) => {
              const twinDetails = await fetchSerializedPartTwinDetails(String(twin.globalId));
              return twinDetails;
            })
        );

        const uniqueRows = detailedTwins
          .filter((twinDetails): twinDetails is SerializedPartTwinDetailsRead => Boolean(twinDetails))
          .map((twinDetails) => {
            const bomAsBuiltAspects = getBomAsBuiltAspects(twinDetails);
            if (bomAsBuiltAspects.length === 0) {
              return null;
            }

            const localPartGlobalId = String(twinDetails.globalId);

            return {
              twinDetails,
              bomAsBuiltAspects,
              localPartGlobalId,
            };
          })
          .filter((entry): entry is {
            twinDetails: SerializedPartTwinDetailsRead;
            bomAsBuiltAspects: TwinAspectRead[];
            localPartGlobalId: string;
          } => Boolean(entry));

        const rowsWithRelations = await Promise.all(
          uniqueRows.map(async ({ twinDetails, bomAsBuiltAspects, localPartGlobalId }) => {
            const childItemsBySubmodel = await Promise.all(
              bomAsBuiltAspects.map(async (aspect) => {
                try {
                  const content = await fetchBomAsBuiltSubmodelContent(aspect.submodelId);
                  return toChildItems(content);
                } catch (submodelError) {
                  // A missing submodel endpoint response should not break the Open page.
                  console.warn(
                    `Skipping BoMAsBuilt submodel ${aspect.submodelId} while loading sender overview.`,
                    submodelError,
                  );
                  return [];
                }
              })
            );

            const relationMap = new Map<string, RelationStatus>();
            childItemsBySubmodel.flat().forEach((childItem) => {
              const relation = resolveChildInvestigationState(localPartGlobalId, childItem, notifications, finishedRequestIds);
              if (!relation.remoteBpn || !relation.remotePartGlobalId) {
                return;
              }

              if (!relationMap.has(relation.id)) {
                relationMap.set(relation.id, relation);
              }
            });

            const relationStatuses = Array.from(relationMap.values()).sort((left, right) => {
              const byBpn = left.remoteBpn.localeCompare(right.remoteBpn);
              if (byBpn !== 0) {
                return byBpn;
              }
              return left.remotePartGlobalId.localeCompare(right.remotePartGlobalId);
            });

            return {
              id: String(twinDetails.globalId),
              name: `${twinDetails.manufacturerPartId} / ${twinDetails.partInstanceId}`,
              manufacturerId: twinDetails.manufacturerId,
              manufacturerPartId: twinDetails.manufacturerPartId,
              partInstanceId: twinDetails.partInstanceId,
              globalId: String(twinDetails.globalId),
              dtrAasId: String(twinDetails.dtrAasId),
              bomSubmodelCount: bomAsBuiltAspects.length,
              relationStatuses,
            } as InvestigationRow;
          })
        );

        rowsWithRelations.sort((a, b) => {
          const byPart = a.manufacturerPartId.localeCompare(b.manufacturerPartId);
          if (byPart !== 0) {
            return byPart;
          }
          return a.partInstanceId.localeCompare(b.partInstanceId);
        });

        setRows(rowsWithRelations);
      } catch (loadError) {
        const message = loadError instanceof Error ? loadError.message : 'Failed to load investigation data.';
        setError(message);
      } finally {
        setLoading(false);
      }
    };

    loadInvestigationData();
  }, []);

  const filteredRows = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) {
      return rows;
    }

    return rows.filter((row) =>
      row.manufacturerId.toLowerCase().includes(query)
      || row.manufacturerPartId.toLowerCase().includes(query)
      || row.partInstanceId.toLowerCase().includes(query)
      || row.globalId.toLowerCase().includes(query)
      || String(row.bomSubmodelCount).includes(query)
    );
  }, [rows, searchQuery]);

  const handleOpenDetail = (row: InvestigationRow) => {
    navigate(`/traceability/quality-investigation/detail?globalId=${encodeURIComponent(row.globalId)}`);
  };

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
            OPEN Quality Investigation
          </Typography>
          <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.72)' }}>
            Local Part Instances with BoMAsBuilt submodels attached.
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
          placeholder="Search by manufacturer part ID, part instance ID, global asset ID or BoM submodel count"
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
            <Typography sx={{ color: 'rgba(255,255,255,0.8)' }}>Loading local BoMAsBuilt part instances...</Typography>
          </Box>
        )}

        {error && (
          <Alert severity="error" sx={{ mt: 1 }}>
            {error}
          </Alert>
        )}

        {!loading && !error && filteredRows.length === 0 && (
          <Alert severity="info" sx={{ mt: 1 }}>
            No local part instances with an attached BoMAsBuilt submodel match the current filter.
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
                      {row.name}
                    </Typography>
                    <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.7)', mb: 2 }}>
                      Local relation created through Traceability Preparation.
                    </Typography>

                    <Box sx={{ display: 'grid', gap: 1.25 }}>
                      <Typography variant="body2" sx={{ color: '#fff' }}>
                        <strong>Manufacturer ID:</strong> {row.manufacturerId}
                      </Typography>
                      <Typography variant="body2" sx={{ color: '#fff' }}>
                        <strong>Manufacturer Part ID:</strong> {row.manufacturerPartId}
                      </Typography>
                      <Typography variant="body2" sx={{ color: '#fff' }}>
                        <strong>Part Instance ID:</strong> {row.partInstanceId}
                      </Typography>
                      <Typography variant="body2" sx={{ color: '#fff', fontFamily: 'monospace' }}>
                        <strong>Global Asset ID:</strong> {row.globalId}
                      </Typography>
                      <Typography variant="body2" sx={{ color: '#fff', fontFamily: 'monospace' }}>
                        <strong>BoMAsBuilt Submodels:</strong> {row.bomSubmodelCount}
                      </Typography>
                    </Box>

                    <Box sx={{ mt: 2.5 }}>
                      <Typography variant="subtitle2" sx={{ color: '#fff', mb: 1 }}>
                        Part Instance Associations (BoMAsBuilt)
                      </Typography>

                      {row.relationStatuses.length === 0 && (
                        <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.72)' }}>
                          No valid childItem association found.
                        </Typography>
                      )}

                      {row.relationStatuses.length > 0 && (
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                          {row.relationStatuses.map((relation) => {
                            const statusChip = getStatusChipConfig(relation.status);
                            const isAcceptedLink = relation.status === 'ACCEPTED' && relation.requestMessageId && relation.faultMessageId;

                            return (
                              <Chip
                                key={`${row.id}-${relation.id}`}
                                label={`${statusChip.label} - ${relation.remoteBpn}`}
                                onClick={() => {
                                  if (!isAcceptedLink) {
                                    return;
                                  }

                                  navigate(
                                    `/traceability/quality-investigation/fault-detail?globalId=${encodeURIComponent(row.globalId)}&requestMessageId=${encodeURIComponent(relation.requestMessageId!)}&faultMessageId=${encodeURIComponent(relation.faultMessageId!)}`
                                  );
                                }}
                                clickable={Boolean(isAcceptedLink)}
                                sx={{
                                  fontWeight: 700,
                                  backgroundColor: statusChip.backgroundColor,
                                  color: statusChip.color,
                                  cursor: isAcceptedLink ? 'pointer' : 'default',
                                  maxWidth: '100%',
                                  '& .MuiChip-label': {
                                    display: 'block',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap',
                                  },
                                }}
                              />
                            );
                          })}
                        </Box>
                      )}
                    </Box>

                    <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 3 }}>
                      <Button
                        variant="outlined"
                        startIcon={<LaunchIcon />}
                        onClick={() => handleOpenDetail(row)}
                        sx={{
                          borderColor: 'rgba(255, 122, 0, 0.5)',
                          color: '#fff',
                          '&:hover': {
                            borderColor: 'rgba(255, 122, 0, 0.9)',
                            backgroundColor: 'rgba(255, 122, 0, 0.12)',
                          },
                        }}
                      >
                        Open Investigation Detail
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

export default TraceabilityQualityInvestigationSenderPage;
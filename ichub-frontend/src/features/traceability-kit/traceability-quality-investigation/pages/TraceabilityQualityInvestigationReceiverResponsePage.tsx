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
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Container,
  Paper,
  TextField,
  Typography,
} from '@mui/material';
import { ArrowBack, Send } from '@mui/icons-material';
import { fetchSerializedPartTwinDetails } from '@/features/industry-core-kit/serialized-parts/api';
import { SerializedPartTwinDetailsRead } from '@/features/industry-core-kit/serialized-parts/types/twin-types';
import { getParticipantId } from '@/services/EnvironmentService';
import {
  ensureQualityInvestigationAcknowledgements,
  fetchQualityInvestigationNotifications,
  getQualityInvestigationNotificationContentString,
  QI_CONTEXT_FAULT,
  QI_CONTEXT_REQUEST,
  QualityInvestigationNotification,
  sendQualityInvestigationFault,
} from '../api';

interface SelectedRequestView {
  request: QualityInvestigationNotification;
  fault?: QualityInvestigationNotification;
  localTwin: SerializedPartTwinDetailsRead | null;
  requesterTwin: SerializedPartTwinDetailsRead | null;
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

const TraceabilityQualityInvestigationReceiverResponsePage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const globalId = searchParams.get('globalId') ?? '';
  const requestMessageId = searchParams.get('requestMessageId') ?? '';
  const faultMessageIdParam = searchParams.get('faultMessageId') ?? '';

  const [notifications, setNotifications] = useState<QualityInvestigationNotification[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [faultMessage, setFaultMessage] = useState('');
  const [sending, setSending] = useState(false);

  const refreshNotifications = async () => {
    const list = await ensureQualityInvestigationAcknowledgements(localBpn);
    setNotifications(list);
  };

  useEffect(() => {
    refreshNotifications().catch((loadError) => {
      const message = loadError instanceof Error ? loadError.message : 'Failed to load quality investigation notifications.';
      setError(message);
    });
  }, []);

  const selectedRequest = useMemo(() => {
    if (!globalId && !requestMessageId) {
      return null;
    }

    if (requestMessageId) {
      return notifications.find((notification) => {
        return notification.context === QI_CONTEXT_REQUEST
          && notification.receiverBpn === localBpn
          && notification.messageId === requestMessageId;
      }) ?? null;
    }

    const matchingRequests = notifications.filter((notification) => {
      return notification.context === QI_CONTEXT_REQUEST
        && notification.receiverBpn === localBpn
        && getQualityInvestigationNotificationContentString(notification, 'remotePartGlobalId') === globalId;
    });

    return matchingRequests.sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime())[0] ?? null;
  }, [globalId, notifications, requestMessageId]);

  const selectedFault = useMemo(() => {
    if (!selectedRequest) {
      return null;
    }

    return notifications.find((notification) => {
      return notification.context === QI_CONTEXT_FAULT
        && notification.senderBpn === localBpn
        && notification.relatedMessageId === selectedRequest.messageId;
    }) ?? null;
  }, [notifications, selectedRequest]);

  const selectedStatus = selectedFault ? 'OK' : 'OPEN';

  const [localTwin, setLocalTwin] = useState<SerializedPartTwinDetailsRead | null>(null);
  const [requesterTwin, setRequesterTwin] = useState<SerializedPartTwinDetailsRead | null>(null);

  useEffect(() => {
    const loadDetails = async () => {
      if (!selectedRequest) {
        setLocalTwin(null);
        setRequesterTwin(null);
        return;
      }

      const localPartGlobalId = getQualityInvestigationNotificationContentString(selectedRequest, 'remotePartGlobalId');
      const requesterPartGlobalId = getQualityInvestigationNotificationContentString(selectedRequest, 'localPartGlobalId');

      const [loadedLocalTwin, loadedRequesterTwin] = await Promise.all([
        localPartGlobalId ? fetchSerializedPartTwinDetails(localPartGlobalId).catch(() => null) : Promise.resolve(null),
        requesterPartGlobalId ? fetchSerializedPartTwinDetails(requesterPartGlobalId).catch(() => null) : Promise.resolve(null),
      ]);

      setLocalTwin(loadedLocalTwin);
      setRequesterTwin(loadedRequesterTwin);
    };

    loadDetails().catch(() => {
      setLocalTwin(null);
      setRequesterTwin(null);
    });
  }, [selectedRequest]);

  const view = useMemo<SelectedRequestView | null>(() => {
    if (!selectedRequest) {
      return null;
    }

    return {
      request: selectedRequest,
      fault: selectedFault ?? undefined,
      localTwin,
      requesterTwin,
    };
  }, [localTwin, requesterTwin, selectedFault, selectedRequest]);

  const handleSendFault = async () => {
    if (!selectedRequest || selectedStatus !== 'OPEN') {
      return;
    }

    const trimmedFaultMessage = faultMessage.trim();
    if (!trimmedFaultMessage) {
      setError('Please provide the fault notification message.');
      return;
    }

    try {
      setSending(true);
      setError(null);
      const faultMessageId = await sendQualityInvestigationFault({
        localBpn,
        remoteBpn: selectedRequest.senderBpn,
        relatedMessageId: selectedRequest.messageId,
        localPartGlobalId: getQualityInvestigationNotificationContentString(selectedRequest, 'remotePartGlobalId'),
        remotePartGlobalId: getQualityInvestigationNotificationContentString(selectedRequest, 'localPartGlobalId'),
        faultMessage: trimmedFaultMessage,
      });

      await refreshNotifications();
      setSuccess('Fault notification sent successfully. The request status is now OK.');
      navigate(
        `/traceability/quality-investigation/respond?globalId=${encodeURIComponent(globalId)}&requestMessageId=${encodeURIComponent(requestMessageId)}&faultMessageId=${encodeURIComponent(faultMessageId)}`
      );
    } catch (sendError) {
      const message = sendError instanceof Error ? sendError.message : 'Failed to send fault notification.';
      setError(message);
    } finally {
      setSending(false);
    }
  };

  return (
    <Container maxWidth="lg" sx={{ py: 3 }}>
      <Button
        startIcon={<ArrowBack />}
        variant="outlined"
        onClick={() => navigate('/traceability/quality-investigation/received')}
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
        Back To Received QI Requests
      </Button>

      <Card
        sx={{
          background: 'linear-gradient(135deg, rgba(30, 30, 30, 0.95) 0%, rgba(20, 20, 20, 0.95) 100%)',
          border: '1px solid rgba(255, 140, 0, 0.45)',
          borderRadius: 3,
          boxShadow: '0 10px 35px rgba(0, 0, 0, 0.4)',
        }}
      >
        <CardContent>
          <Typography variant="h4" sx={{ color: '#fff', mb: 1 }}>
            Quality Investigation Request Detail
          </Typography>
          <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.75)', mb: 2 }}>
            Review the received request, check the correlated global asset IDs, and send the matching fault notification when the request is still open.
          </Typography>

          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}

          {success && (
            <Alert severity="success" sx={{ mb: 2 }}>
              {success}
            </Alert>
          )}

          {!view && !error && (
            <Alert severity="info" sx={{ mb: 2 }}>
              No matching quality investigation request was found.
            </Alert>
          )}

          {view && (
            <Box sx={{ display: 'grid', gap: 2 }}>
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                <Chip
                  label={selectedStatus}
                  sx={{
                    fontWeight: 700,
                    background: getStatusStyles(selectedStatus).background,
                    color: getStatusStyles(selectedStatus).color,
                  }}
                />
                <Chip
                  label={`Opened: ${formatDateTime(view.request.createdAt)}`}
                  variant="outlined"
                  sx={{ color: '#fff', borderColor: 'rgba(255,255,255,0.25)' }}
                />
                <Chip
                  label={`Closed: ${formatDateTime(view.fault?.createdAt)}`}
                  variant="outlined"
                  sx={{ color: '#fff', borderColor: 'rgba(255,255,255,0.25)' }}
                />
              </Box>

              <Paper
                variant="outlined"
                sx={{
                  p: 2,
                  background: 'rgba(17, 17, 17, 0.92)',
                  borderColor: 'rgba(255,255,255,0.2)',
                }}
              >
                <Typography variant="body2" sx={{ color: '#fff', mb: 1 }}>
                  <strong>Requester BPN:</strong> {view.request.senderBpn}
                </Typography>
                <Typography variant="body2" sx={{ color: '#fff', mb: 1, fontFamily: 'monospace' }}>
                  <strong>Request Message ID:</strong> {view.request.messageId}
                </Typography>
                <Typography variant="body2" sx={{ color: '#fff', mb: 1, fontFamily: 'monospace' }}>
                  <strong>Local Global Asset ID:</strong> {getQualityInvestigationNotificationContentString(view.request, 'remotePartGlobalId') || 'n/a'}
                </Typography>
                <Typography variant="body2" sx={{ color: '#fff', mb: 1, fontFamily: 'monospace' }}>
                  <strong>Requester Global Asset ID:</strong> {getQualityInvestigationNotificationContentString(view.request, 'localPartGlobalId') || 'n/a'}
                </Typography>
                <Typography variant="body2" sx={{ color: '#fff', mb: 1 }}>
                  <strong>Local Manufacturer / Part Instance:</strong> {view.localTwin ? `${view.localTwin.manufacturerPartId} / ${view.localTwin.partInstanceId}` : 'n/a'}
                </Typography>
                <Typography variant="body2" sx={{ color: '#fff', mb: 1 }}>
                  <strong>Requester Manufacturer / Part Instance:</strong> {view.requesterTwin ? `${view.requesterTwin.manufacturerPartId} / ${view.requesterTwin.partInstanceId}` : 'n/a'}
                </Typography>
              </Paper>

              {selectedStatus === 'OK' && view.fault ? (
                <Alert
                  severity="success"
                  action={(
                    <Button
                      color="inherit"
                      size="small"
                      onClick={() => {
                        navigate(
                          `/traceability/quality-investigation/fault-detail?globalId=${encodeURIComponent(globalId)}&requestMessageId=${encodeURIComponent(view.request.messageId)}&faultMessageId=${encodeURIComponent(faultMessageIdParam || view.fault?.messageId || '')}`
                        );
                      }}
                    >
                      Open Fault Notification
                    </Button>
                  )}
                >
                  {typeof view.fault.content.information === 'string' ? view.fault.content.information : 'Fault notification received.'}
                </Alert>
              ) : (
                <>
                  <TextField
                    label="Fault notification message"
                    fullWidth
                    multiline
                    minRows={4}
                    value={faultMessage}
                    onChange={(event) => setFaultMessage(event.target.value)}
                    sx={{
                      mb: 2,
                      '& .MuiOutlinedInput-root': {
                        backgroundColor: '#fff',
                      },
                      '& .MuiInputBase-input': {
                        color: '#000',
                      },
                      '& .MuiInputLabel-root': {
                        color: '#000',
                      },
                    }}
                  />

                  <Button
                    variant="contained"
                    startIcon={<Send />}
                    onClick={handleSendFault}
                    disabled={sending}
                    sx={{
                      background: 'linear-gradient(135deg, #ff7a00 0%, #ff5a00 100%)',
                      color: '#fff',
                      textTransform: 'none',
                      '&:hover': {
                        filter: 'brightness(1.05)',
                      },
                    }}
                  >
                    {sending ? 'Sending Fault Notification...' : 'Send Fault Notification'}
                  </Button>
                </>
              )}
            </Box>
          )}
        </CardContent>
      </Card>
    </Container>
  );
};

export default TraceabilityQualityInvestigationReceiverResponsePage;

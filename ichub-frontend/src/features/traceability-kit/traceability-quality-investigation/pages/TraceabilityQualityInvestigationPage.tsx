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

import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Button,
  Card,
  CardContent,
  Container,
  Grid2,
  Typography,
} from '@mui/material';
import { ArrowForward, DownloadDone, Upload } from '@mui/icons-material';
import { getParticipantId } from '@/services/EnvironmentService';
import {
  ensureQualityInvestigationAcknowledgements,
} from '../api';

const localBpn = getParticipantId();

const TraceabilityQualityInvestigationPage: React.FC = () => {
  const navigate = useNavigate();

  useEffect(() => {
    ensureQualityInvestigationAcknowledgements(localBpn).catch(() => undefined);
  }, []);

  return (
    <Container maxWidth="xl" sx={{ py: 3 }}>
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
            Traceability Quality Investigation
          </Typography>
          <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.72)' }}>
            Choose whether you want to open a new investigation as sender or process Quality Investigation requests received from a partner.
          </Typography>
        </CardContent>
      </Card>

      <Grid2 container spacing={3} sx={{ mt: 1 }}>
        <Grid2 size={{ xs: 12, md: 6 }}>
          <Card
            sx={{
              height: '100%',
              background: 'linear-gradient(145deg, rgba(38, 38, 38, 0.96) 0%, rgba(18, 18, 18, 0.98) 100%)',
              border: '1px solid rgba(255, 122, 0, 0.28)',
              borderRadius: 3,
              boxShadow: '0 16px 40px rgba(0, 0, 0, 0.28)',
            }}
          >
            <CardContent sx={{ p: 3.5 }}>
              <Upload sx={{ color: '#ff8c00', fontSize: 34, mb: 2 }} />
              <Typography variant="h5" sx={{ color: '#fff', mb: 1.5 }}>
                OPEN Quality Investigation
              </Typography>
              <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.75)', mb: 3 }}>
                Work as the sender of the Traceability Quality Investigation request. Open the current BoMAsBuilt-based investigation page and start QI notifications from the linked child items.
              </Typography>
              <Button
                variant="contained"
                endIcon={<ArrowForward />}
                onClick={() => navigate('/traceability/quality-investigation/open')}
                sx={{
                  background: 'linear-gradient(135deg, #ff7a00 0%, #ff5a00 100%)',
                  color: '#fff',
                  textTransform: 'none',
                  '&:hover': {
                    filter: 'brightness(1.05)',
                  },
                }}
              >
                OPEN Quality Investigation
              </Button>
            </CardContent>
          </Card>
        </Grid2>

        <Grid2 size={{ xs: 12, md: 6 }}>
          <Card
            sx={{
              height: '100%',
              background: 'linear-gradient(145deg, rgba(38, 38, 38, 0.96) 0%, rgba(18, 18, 18, 0.98) 100%)',
              border: '1px solid rgba(255, 159, 28, 0.28)',
              borderRadius: 3,
              boxShadow: '0 16px 40px rgba(0, 0, 0, 0.28)',
            }}
          >
            <CardContent sx={{ p: 3.5 }}>
              <DownloadDone sx={{ color: '#ff9f1c', fontSize: 34, mb: 2 }} />
              <Typography variant="h5" sx={{ color: '#fff', mb: 1.5 }}>
                VIEW Received QI Requests
              </Typography>
              <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.75)', mb: 3 }}>
                Work as the receiver of Traceability QI requests. Review received requests, see the orange or green status button, and open the response page to prepare the correlated fault notification.
              </Typography>
              <Button
                variant="contained"
                endIcon={<ArrowForward />}
                onClick={() => navigate('/traceability/quality-investigation/received')}
                sx={{
                  background: 'linear-gradient(135deg, #ff9f1c 0%, #ff7a00 100%)',
                  color: '#fff',
                  textTransform: 'none',
                  '&:hover': {
                    filter: 'brightness(1.05)',
                  },
                }}
              >
                VIEW Received QI Requests
              </Button>
            </CardContent>
          </Card>
        </Grid2>
      </Grid2>
    </Container>
  );
};

export default TraceabilityQualityInvestigationPage;

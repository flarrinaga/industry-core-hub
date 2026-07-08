#################################################################################
# Eclipse Tractus-X - Industry Core Hub Backend
#
# Copyright (c) 2026 Contributors to the Eclipse Foundation
#
# See the NOTICE file(s) distributed with this work for additional
# information regarding copyright ownership.
#
# This program and the accompanying materials are made available under the
# terms of the Apache License, Version 2.0 which is available at
# https://www.apache.org/licenses/LICENSE-2.0.
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND,
# either express or implied. See the
# License for the specific language govern in permissions and limitations
# under the License.
#
# SPDX-License-Identifier: Apache-2.0
#################################################################################

from tractusx_sdk.industry.models.notifications import Notification

from managers.config.log_manager import LoggingManager
from services.notifications.notifications_management_service import NotificationsManagementService
from tools.exceptions import NotificationCreationError
from models.metadata_database.notification.models import NotificationDirection, NotificationEntity
from tools.constants import TRACEABILITY

logger = LoggingManager.get_logger(__name__)


class TraceabilityEventApiService:
    """
    Service class for handling Traceability Event notifications.
    """

    def __init__(self, notifications_management_service: NotificationsManagementService):
        self.notifications_management_service = notifications_management_service

    def receive_connect_to_parent(self, notification: Notification, direction: NotificationDirection) -> NotificationEntity:
        logger.info(f"Received traceability connect-to-parent notification with ID: {notification.header.message_id}")
        try:
            return self.notifications_management_service.create_notification(notification, direction, TRACEABILITY)
        except NotificationCreationError as e:
            logger.error(f"Failed to create traceability connect-to-parent notification: {e}")
            raise

    def receive_connect_to_child(self, notification: Notification, direction: NotificationDirection) -> NotificationEntity:
        logger.info(f"Received traceability connect-to-child notification with ID: {notification.header.message_id}")
        try:
            return self.notifications_management_service.create_notification(notification, direction, TRACEABILITY)
        except NotificationCreationError as e:
            logger.error(f"Failed to create traceability connect-to-child notification: {e}")
            raise

    def receive_submodel_update(self, notification: Notification, direction: NotificationDirection) -> NotificationEntity:
        logger.info(f"Received traceability submodel-update notification with ID: {notification.header.message_id}")
        try:
            return self.notifications_management_service.create_notification(notification, direction, TRACEABILITY)
        except NotificationCreationError as e:
            logger.error(f"Failed to create traceability submodel-update notification: {e}")
            raise

    def receive_feedback(self, notification: Notification, direction: NotificationDirection) -> NotificationEntity:
        logger.info(f"Received traceability feedback notification with ID: {notification.header.message_id}")
        try:
            return self.notifications_management_service.create_notification(notification, direction, TRACEABILITY)
        except NotificationCreationError as e:
            logger.error(f"Failed to create traceability feedback notification: {e}")
            raise

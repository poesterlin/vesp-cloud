"""Constants for vESP.cloud Notifications integration."""

DOMAIN = "esphome_display_notifications"
PLATFORMS = ["sensor"]

SERVICE_SEND = "send"
SERVICE_CLEAR = "clear"

ATTR_TITLE = "title"
ATTR_MESSAGE = "message"
ATTR_SEVERITY = "severity"
ATTR_DURATION = "duration"
ATTR_NOTIFICATION_ID = "notification_id"

STATE_IDLE = "idle"
STATE_NOTIFYING = "notifying"

SEVERITY_INFO = "info"
SEVERITY_WARNING = "warning"
SEVERITY_CRITICAL = "critical"
SEVERITY_OPTIONS = [SEVERITY_INFO, SEVERITY_WARNING, SEVERITY_CRITICAL]

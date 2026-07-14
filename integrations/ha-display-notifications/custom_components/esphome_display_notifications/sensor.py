"""Sensor platform for vESP.cloud Notifications."""

from __future__ import annotations

from homeassistant.components.sensor import SensorEntity
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant
from homeassistant.helpers.entity_platform import AddEntitiesCallback

from .const import ATTR_MESSAGE, ATTR_NOTIFICATION_ID, ATTR_SEVERITY, ATTR_TITLE, DOMAIN


async def async_setup_entry(
    hass: HomeAssistant,
    entry: ConfigEntry,
    async_add_entities: AddEntitiesCallback,
) -> None:
    """Set up notification sensor from config entry."""
    async_add_entities([NotificationBroadcastSensor(hass)])


class NotificationBroadcastSensor(SensorEntity):
    """Global notification broadcast sensor for all displays."""

    _attr_name = "ESPHome Display Notifications Broadcast"
    _attr_unique_id = "esphome_display_notifications_broadcast"
    _attr_icon = "mdi:bullhorn"
    _attr_should_poll = False

    def __init__(self, hass: HomeAssistant) -> None:
        self._runtime = hass.data[DOMAIN]
        self._unsub_listener = None

    @property
    def native_value(self) -> str:
        """Return current notification state."""
        return self._runtime["state"]

    @property
    def extra_state_attributes(self) -> dict[str, str]:
        """Expose notification payload for dashboards and ESPHome."""
        return {
            ATTR_TITLE: self._runtime["title"],
            ATTR_MESSAGE: self._runtime["message"],
            ATTR_SEVERITY: self._runtime["severity"],
            ATTR_NOTIFICATION_ID: self._runtime["notification_id"],
        }

    async def async_added_to_hass(self) -> None:
        """Register state update listener."""

        def _listener() -> None:
            self.async_write_ha_state()

        listeners = self._runtime["listeners"]
        listeners.add(_listener)

        def _remove() -> None:
            listeners.discard(_listener)

        self._unsub_listener = _remove

    async def async_will_remove_from_hass(self) -> None:
        """Unregister state update listener."""
        if self._unsub_listener is not None:
            self._unsub_listener()
            self._unsub_listener = None

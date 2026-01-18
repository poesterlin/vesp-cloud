"""To-Do Bridge Sensor - Translates HA To-Do API to PSV format for ESP32 display."""

import logging
from datetime import datetime
from typing import Any

from homeassistant.components.sensor import SensorEntity
from homeassistant.core import HomeAssistant, callback
from homeassistant.helpers.entity_platform import AddEntitiesCallback
from homeassistant.helpers.event import async_track_state_change_event

from .const import DOMAIN

_LOGGER = logging.getLogger(__name__)


async def async_setup_platform(
    hass: HomeAssistant,
    config: dict,
    async_add_entities: AddEntitiesCallback,
    discovery_info: dict = None,
) -> None:
    """Set up To-Do bridge sensors.

    This platform creates a sensor for each configured device with a to-do entity.
    The sensor watches the to-do entity and formats items as pipe-separated values
    for display on the ESPHome device.
    """
    if DOMAIN not in hass.data:
        return

    entities = []
    for device_name, device_config in hass.data[DOMAIN].get("devices", {}).items():
        todo_entity = device_config.get("todo_entity")
        if todo_entity:
            entities.append(TodoBridgeSensor(hass, device_name, todo_entity))

    if entities:
        async_add_entities(entities)


class TodoBridgeSensor(SensorEntity):
    """Sensor that bridges Home Assistant To-Do to ESPHome display.

    This sensor monitors a Home Assistant to-do list entity and provides:
    - `state`: Number of pending items
    - `all_items` attribute: PSV-formatted task list (Name|Date|Status)

    PSV Format: TaskName|DueDate|Status
    - TaskName: Task summary (pipes escaped as dashes)
    - DueDate: Due date in YYYY-MM-DD format or "no-date"
    - Status: "ok", "overdue", or "completed"

    Example attribute value:
        Milk|2024-01-20|ok
        Eggs|2024-01-19|overdue
        Bread|no-date|ok
    """

    def __init__(self, hass: HomeAssistant, device_name: str, todo_entity_id: str):
        """Initialize the sensor.

        Args:
            hass: Home Assistant instance
            device_name: Display device name (for entity naming)
            todo_entity_id: Home Assistant to-do entity ID to monitor
        """
        self.hass = hass
        self._device_name = device_name
        self._todo_entity_id = todo_entity_id

        # Entity metadata
        self._attr_name = f"{device_name} To-Do Items"
        self._attr_unique_id = f"esphome_display_todo_{device_name}"
        self._attr_icon = "mdi:clipboard-list"

        # State
        self._items_formatted = ""
        self._count = 0
        self._last_update = None

    async def async_added_to_hass(self) -> None:
        """Set up listeners when added to Home Assistant."""
        # Track state changes on the to-do entity
        self.async_on_remove(
            async_track_state_change_event(
                self.hass,
                [self._todo_entity_id],
                self._on_todo_changed,
            )
        )

        # Initial update
        await self._update_items()
        _LOGGER.debug(f"To-Do bridge initialized for {self._device_name}")

    @callback
    async def _on_todo_changed(self, event) -> None:
        """Handle to-do entity state change event."""
        await self._update_items()

    async def _update_items(self) -> None:
        """Fetch to-do items from service and format as PSV.

        Calls todo.get_items service to fetch pending items, then formats
        them as pipe-separated values suitable for parsing on the ESP32.
        """
        try:
            # Call the todo.get_items service to fetch all items
            response = await self.hass.services.async_call(
                "todo",
                "get_items",
                {
                    "status": ["needs_action"],  # Only fetch pending items
                },
                target={"entity_id": self._todo_entity_id},
                return_response=True,
            )

            # Extract items from service response
            items = response.get(self._todo_entity_id, {}).get("items", [])
            self._count = len(items)

            # Format items as PSV: TaskName|DueDate|Status
            lines = []
            for item in items:
                summary = item.get("summary", "Unknown").replace(
                    "|", "-"
                )  # Escape pipes
                due = item.get("due", "")

                # Determine status
                status = "ok"
                if due:
                    try:
                        due_date = datetime.fromisoformat(due)
                        today = datetime.now().replace(
                            hour=0, minute=0, second=0, microsecond=0
                        )
                        if (
                            due_date.replace(hour=0, minute=0, second=0, microsecond=0)
                            < today
                        ):
                            status = "overdue"
                        due_display = due  # Use ISO format for consistency
                    except (ValueError, TypeError):
                        due_display = due  # Fallback to raw value
                else:
                    due_display = "no-date"

                # Append formatted line
                lines.append(f"{summary}|{due_display}|{status}")

            # Join all lines
            self._items_formatted = "\n".join(lines)
            self._last_update = datetime.now()

            # Trigger state update
            self.async_write_ha_state()

            _LOGGER.debug(
                f"Updated to-do items for {self._device_name}: "
                f"{self._count} items, {len(self._items_formatted)} bytes"
            )

        except Exception as err:
            _LOGGER.error(
                f"Error fetching to-do items from {self._todo_entity_id}: {err}"
            )
            self._items_formatted = ""
            self._count = 0
            self.async_write_ha_state()

    @property
    def state(self) -> str | None:
        """Return the state (number of pending items).

        Returns:
            String representation of item count, or None if not ready.
        """
        return str(self._count) if self._count is not None else None

    @property
    def extra_state_attributes(self) -> dict[str, Any]:
        """Return sensor attributes.

        Attributes:
            all_items: PSV-formatted to-do list (for parsing on ESP32)
            count: Number of pending items (same as state)
            entity_id: The to-do entity being monitored
            last_update: Timestamp of last successful update
        """
        return {
            "all_items": self._items_formatted,
            "count": self._count,
            "entity_id": self._todo_entity_id,
            "last_update": self._last_update.isoformat() if self._last_update else None,
        }

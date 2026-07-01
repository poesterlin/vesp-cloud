"""TodoBridgeSensor — converts HA todo lists to PSV format for ESPHome displays."""

import logging
from datetime import datetime, timedelta
from typing import Any

from homeassistant.components.sensor import SensorEntity
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant, callback
from homeassistant.helpers.entity_platform import AddEntitiesCallback
from homeassistant.helpers.event import async_track_state_change_event

from .const import DOMAIN

_LOGGER = logging.getLogger(__name__)


async def async_setup_entry(
    hass: HomeAssistant,
    entry: ConfigEntry,
    async_add_entities: AddEntitiesCallback,
) -> None:
    """Set up TodoBridgeSensors from a config entry."""
    todo_entities: list[str] = entry.data.get("todo_entities", [])
    if not todo_entities:
        return

    entities = []
    for eid in todo_entities:
        name = _sensor_name(hass, eid)
        uid = f"esphome_display_todo_{eid.replace('.', '_')}"
        entities.append(TodoBridgeSensor(hass, name, uid, eid))

    async_add_entities(entities)


def _sensor_name(hass: HomeAssistant, entity_id: str) -> str:
    """Derive a human-readable sensor name from the todo entity."""
    state = hass.states.get(entity_id)
    friendly = state.attributes.get("friendly_name") if state else None
    return f"To-Do: {friendly}" if friendly else f"To-Do Bridge: {entity_id}"


def _format_due_date(due_str: str) -> str:
    """Convert an ISO date string to a relative display format."""
    try:
        due_date = datetime.fromisoformat(due_str)
    except (ValueError, TypeError):
        return due_str

    now = datetime.now()
    due_day = due_date.date()
    today = now.date()
    tomorrow = today + timedelta(days=1)
    yesterday = today - timedelta(days=1)

    time_str = due_date.strftime("%H:%M")

    if due_day == today:
        return time_str
    if due_day == tomorrow:
        return "tomorrow"
    if due_day == yesterday:
        return "yesterday"

    diff = (due_day - today).days
    if diff < 0:
        if diff >= -6:
            return f"{-diff}d ago"
        return due_date.strftime("%d %b")
    if diff <= 6:
        return f"in {diff}d"
    return due_date.strftime("%d %b")


class TodoBridgeSensor(SensorEntity):
    """Sensor that bridges Home Assistant To-Do lists to ESPHome."""

    def __init__(
        self,
        hass: HomeAssistant,
        name: str,
        unique_id: str,
        todo_entity_id: str,
    ):
        """Initialize the sensor."""
        self.hass = hass
        self._todo_entity_id = todo_entity_id

        self._attr_name = name
        self._attr_unique_id = unique_id
        self._attr_icon = "mdi:clipboard-list"

        self._items_formatted = ""
        self._count = 0
        self._last_update: datetime | None = None

    async def async_added_to_hass(self) -> None:
        """Subscribe to source todo entity changes."""
        self.async_on_remove(
            async_track_state_change_event(
                self.hass,
                [self._todo_entity_id],
                self._on_todo_changed,
            )
        )
        await self._update_items()

    @callback
    async def _on_todo_changed(self, event) -> None:
        """Handle todo entity state change."""
        await self._update_items()

    async def _update_items(self) -> None:
        """Fetch pending items and format as PSV."""
        try:
            response = await self.hass.services.async_call(
                "todo",
                "get_items",
                {"status": ["needs_action"]},
                target={"entity_id": self._todo_entity_id},
                blocking=True,
                return_response=True,
            )

            items = response.get(self._todo_entity_id, {}).get("items", [])
            self._count = len(items)

            lines = []
            for item in items:
                summary = item.get("summary", "Unknown").replace("|", "-")
                due = item.get("due", "")

                status = "ok"
                if due:
                    due_display = _format_due_date(due)
                    try:
                        due_date = datetime.fromisoformat(due)
                        today = datetime.now().replace(
                            hour=0, minute=0, second=0, microsecond=0
                        )
                        if (
                            due_date.replace(
                                hour=0, minute=0, second=0, microsecond=0
                            )
                            < today
                        ):
                            status = "overdue"
                    except (ValueError, TypeError):
                        pass
                else:
                    due_display = "no-date"

                lines.append(f"{summary}|{due_display}|{status}")

            self._items_formatted = "\n".join(lines)
            self._last_update = datetime.now()
            self.async_write_ha_state()

        except Exception as err:
            _LOGGER.error(
                "Error fetching items from %s: %s", self._todo_entity_id, err
            )
            self._items_formatted = ""
            self._count = 0
            self.async_write_ha_state()

    @property
    def state(self) -> str | None:
        """Return count of pending items."""
        return str(self._count) if self._count is not None else None

    @property
    def extra_state_attributes(self) -> dict[str, Any]:
        """Extra attributes consumed by ESPHome text sensors."""
        return {
            "all_items": self._items_formatted,
            "count": self._count,
            "entity_id": self._todo_entity_id,
            "last_update": (
                self._last_update.isoformat() if self._last_update else None
            ),
        }

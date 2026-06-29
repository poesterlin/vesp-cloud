"""ESPHome Display Integration — notification helpers & todo list bridging."""

import json
import logging
from datetime import datetime, timezone
from typing import Any

import voluptuous as vol
from homeassistant.components import websocket_api
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant
from homeassistant.helpers import (
    area_registry as ar,
    config_validation as cv,
    device_registry as dr,
    entity_registry as er,
)

from .const import DOMAIN
from .notification_entities import async_ensure_notification_entities
from .panel import async_register_panel, async_unregister_panel

_LOGGER = logging.getLogger(__name__)

CONF_NOTIFICATIONS = "notifications"
CONF_DEFAULT_SEVERITY = "default_severity"
CONF_TODO_ENTITIES = "todo_entities"
CONF_DEVICES = "devices"  # old v1 format

PLATFORMS = ["sensor"]

_METADATA_VERSION = "1.0.0"

_SENSITIVE_ATTRIBUTES = {
    "latitude", "longitude", "access_token", "ip_address",
    "mac_address", "serial_number", "password", "token", "api_key", "secret",
}

_DOMAIN_ACTIONS: dict[str, list[str]] = {
    "light": ["Turn On", "Turn Off", "Toggle", "Set Brightness", "Set Color"],
    "switch": ["Turn On", "Turn Off", "Toggle"],
    "cover": ["Open", "Close", "Stop", "Set Position"],
    "lock": ["Lock", "Unlock"],
    "fan": ["Turn On", "Turn Off", "Set Speed"],
    "climate": ["Set Temperature", "Set HVAC Mode", "Set Fan Mode"],
    "media_player": ["Play", "Pause", "Stop", "Volume Up", "Volume Down"],
    "button": ["Press"],
    "input_boolean": ["Turn On", "Turn Off", "Toggle"],
    "input_number": ["Set Value"],
    "input_select": ["Select Option"],
    "script": ["Run"],
    "scene": ["Activate"],
    "automation": ["Trigger", "Turn On", "Turn Off"],
    "vacuum": ["Start", "Pause", "Stop", "Return Home"],
    "camera": ["Turn On", "Turn Off", "Snapshot"],
}

_DOMAIN_STATE_OPTIONS: dict[str, list[str]] = {
    "light": ["on", "off"],
    "switch": ["on", "off"],
    "binary_sensor": ["on", "off"],
    "cover": ["open", "closed", "opening", "closing"],
    "lock": ["locked", "unlocked", "locking", "unlocking"],
    "fan": ["on", "off"],
    "climate": ["off", "heat", "cool", "heat_cool", "auto", "dry", "fan_only"],
    "media_player": ["off", "on", "playing", "paused", "idle", "standby"],
    "input_boolean": ["on", "off"],
    "vacuum": ["cleaning", "docked", "paused", "idle", "returning", "error"],
    "person": ["home", "not_home"],
    "device_tracker": ["home", "not_home"],
    "alarm_control_panel": [
        "disarmed", "armed_home", "armed_away", "armed_night", "triggered",
    ],
}

_SENSOR_DISPLAY_TYPES: dict[str, str] = {
    "temperature": "gauge", "humidity": "gauge", "pressure": "gauge",
    "battery": "gauge", "power": "graph", "energy": "graph",
    "voltage": "gauge", "current": "gauge", "illuminance": "gauge",
    "signal_strength": "gauge", "timestamp": "value", "duration": "value",
    "monetary": "value",
}

_SERVICE_METADATA: dict[str, dict[str, Any]] = {
    "turn_on":             {"icon": "mdi:power-on",              "targets": ["light", "switch", "fan", "media_player", "input_boolean", "automation", "camera"]},
    "turn_off":            {"icon": "mdi:power-off",             "targets": ["light", "switch", "fan", "media_player", "input_boolean", "automation", "camera"]},
    "toggle":              {"icon": "mdi:toggle-switch",         "targets": ["light", "switch", "fan", "input_boolean"]},
    "lock":                {"icon": "mdi:lock",                  "targets": ["lock"]},
    "unlock":              {"icon": "mdi:lock-open",             "targets": ["lock"]},
    "open_cover":          {"icon": "mdi:arrow-up-box",         "targets": ["cover"]},
    "close_cover":         {"icon": "mdi:arrow-down-box",       "targets": ["cover"]},
    "stop_cover":          {"icon": "mdi:stop",                  "targets": ["cover"]},
    "set_cover_position":  {"icon": "mdi:arrow-expand-vertical", "targets": ["cover"]},
    "set_temperature":     {"icon": "mdi:thermometer",           "targets": ["climate", "water_heater"]},
    "set_hvac_mode":       {"icon": "mdi:hvac",                  "targets": ["climate"]},
    "media_play":          {"icon": "mdi:play",                  "targets": ["media_player"]},
    "media_pause":         {"icon": "mdi:pause",                 "targets": ["media_player"]},
    "media_stop":          {"icon": "mdi:stop",                  "targets": ["media_player"]},
    "volume_up":           {"icon": "mdi:volume-plus",           "targets": ["media_player"]},
    "volume_down":         {"icon": "mdi:volume-minus",          "targets": ["media_player"]},
    "volume_set":          {"icon": "mdi:volume-high",           "targets": ["media_player"]},
    "select_source":       {"icon": "mdi:video-input-component", "targets": ["media_player"]},
    "start":               {"icon": "mdi:play",                  "targets": ["vacuum", "script"]},
    "pause":               {"icon": "mdi:pause",                 "targets": ["vacuum"]},
    "return_to_base":      {"icon": "mdi:home",                  "targets": ["vacuum"]},
    "press":               {"icon": "mdi:gesture-tap-button",    "targets": ["button"]},
    "set_value":           {"icon": "mdi:numeric",               "targets": ["input_number", "number"]},
    "select_option":       {"icon": "mdi:form-select",           "targets": ["input_select", "select"]},
    "activate":            {"icon": "mdi:play-circle",           "targets": ["scene"]},
    "trigger":             {"icon": "mdi:play",                  "targets": ["automation"]},
    "reload":              {"icon": "mdi:reload",                "targets": ["automation", "script", "scene"]},
}

# ── Metadata exporter (websocket) ──────────────────────────────────

class MetadataExporter:
    """Gathers HA metadata for the visual editor panel."""

    def __init__(self, hass: HomeAssistant) -> None:
        self.hass = hass
        self._entity_registry: er.EntityRegistry | None = None
        self._area_registry: ar.AreaRegistry | None = None
        self._device_registry: dr.DeviceRegistry | None = None
        self._area_lookup: dict[str, str] = {}

    async def async_gather_all(self) -> dict[str, Any]:
        self._entity_registry = er.async_get(self.hass)
        self._area_registry = ar.async_get(self.hass)
        self._device_registry = dr.async_get(self.hass)
        self._build_area_lookup()
        return {
            "version": _METADATA_VERSION,
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "entities": self._gather_entities(),
            "services": self._gather_services(),
            "devices": await self._gather_devices(),
            "areas": self._gather_areas(),
        }

    def _build_area_lookup(self) -> None:
        if not self._entity_registry or not self._area_registry or not self._device_registry:
            return
        for entity in self._entity_registry.entities.values():
            area_name = None
            if entity.area_id:
                area = self._area_registry.async_get_area(entity.area_id)
                if area:
                    area_name = area.name
            elif entity.device_id:
                device = self._device_registry.async_get(entity.device_id)
                if device and device.area_id:
                    area = self._area_registry.async_get_area(device.area_id)
                    if area:
                        area_name = area.name
            if area_name:
                self._area_lookup[entity.entity_id] = area_name

    def _gather_entities(self) -> list[dict[str, Any]]:
        entities = []
        for state in self.hass.states.async_all():
            entity_id = state.entity_id
            domain = entity_id.split(".")[0]
            safe_attrs = [
                a for a in state.attributes
                if a.lower() not in _SENSITIVE_ATTRIBUTES
                and not any(s in a.lower() for s in _SENSITIVE_ATTRIBUTES)
            ]
            data: dict[str, Any] = {
                "entity_id": entity_id,
                "domain": domain,
                "name": state.attributes.get("friendly_name", entity_id),
                "state": state.state,
                "attributes": safe_attrs,
                "last_changed": state.last_changed.isoformat() if state.last_changed else None,
                "last_updated": state.last_updated.isoformat() if state.last_updated else None,
            }
            try:
                if state.state not in ("unknown", "unavailable"):
                    data["numeric_state"] = float(state.state)
            except (ValueError, TypeError):
                pass
            if dc := state.attributes.get("device_class"):
                data["device_class"] = dc
            if unit := state.attributes.get("unit_of_measurement"):
                data["unit"] = unit
            if icon := state.attributes.get("icon"):
                data["icon"] = icon
            if area := self._area_lookup.get(entity_id):
                data["area"] = area
            if self._entity_registry:
                entry = self._entity_registry.async_get(entity_id)
                if entry and entry.device_id:
                    data["device_id"] = entry.device_id
            if domain in _DOMAIN_ACTIONS:
                data["suggested_actions"] = _DOMAIN_ACTIONS[domain]
            if domain in _DOMAIN_STATE_OPTIONS:
                data["state_options"] = _DOMAIN_STATE_OPTIONS[domain]
            if options := state.attributes.get("options"):
                data["state_options"] = options
            elif hvac_modes := state.attributes.get("hvac_modes"):
                data["state_options"] = hvac_modes
            elif preset_modes := state.attributes.get("preset_modes"):
                if "state_options" not in data:
                    data["state_options"] = preset_modes
            if domain == "sensor":
                if sc := state.attributes.get("state_class"):
                    data["state_class"] = sc
                dc = state.attributes.get("device_class")
                if dc and dc in _SENSOR_DISPLAY_TYPES:
                    data["suggested_display"] = _SENSOR_DISPLAY_TYPES[dc]
                elif state.attributes.get("state_class") == "measurement":
                    data["suggested_display"] = "gauge"
                elif state.attributes.get("state_class") == "total_increasing":
                    data["suggested_display"] = "graph"
                else:
                    data["suggested_display"] = "value"
            entities.append(data)
        return entities

    def _gather_services(self) -> dict[str, dict[str, Any]]:
        services: dict[str, dict[str, Any]] = {}
        for domain, domain_services in self.hass.services.async_services().items():
            services[domain] = {}
            for sname, sinfo in domain_services.items():
                sd: dict[str, Any] = {
                    "name": sname,
                    "friendly_name": sname.replace("_", " ").title(),
                }
                if sname in _SERVICE_METADATA:
                    meta = _SERVICE_METADATA[sname]
                    if "icon" in meta:
                        sd["icon"] = meta["icon"]
                    if "targets" in meta:
                        sd["common_targets"] = meta["targets"]
                schema = getattr(sinfo, "schema", None)
                if schema:
                    fields = self._extract_fields(schema)
                    if fields:
                        sd["fields"] = fields
                services[domain][sname] = sd
        return services

    @staticmethod
    def _extract_fields(schema: vol.Schema) -> dict[str, dict[str, Any]]:
        fields: dict[str, dict[str, Any]] = {}
        if not hasattr(schema, "schema"):
            return fields
        sd = schema.schema
        if not isinstance(sd, dict):
            return fields
        for key, validator in sd.items():
            fname = str(key.schema) if hasattr(key, "schema") else str(key)
            info: dict[str, Any] = {"name": fname}
            if isinstance(key, vol.Required):
                info["required"] = True
            elif isinstance(key, vol.Optional):
                info["required"] = False
                if key.default is not vol.UNDEFINED and not callable(key.default):
                    try:
                        json.dumps(key.default)
                        info["default"] = key.default
                    except (TypeError, ValueError):
                        pass
            selector = MetadataExporter._infer_selector(validator)
            if selector:
                info["selector"] = selector
            fields[fname] = info
        return fields

    @staticmethod
    def _infer_selector(validator: Any) -> dict[str, Any] | None:
        if validator is cv.string or validator is str:
            return {"text": {}}
        if validator is cv.boolean or validator is bool:
            return {"boolean": {}}
        if validator is cv.positive_int:
            return {"number": {"min": 0, "mode": "box"}}
        if validator is cv.entity_id:
            return {"entity": {}}
        if isinstance(validator, vol.In):
            return {"select": {"options": list(validator.container)}}
        return None

    def _gather_areas(self) -> list[dict[str, Any]]:
        areas = []
        if not self._area_registry:
            return areas
        for area in self._area_registry.async_list_areas():
            ad: dict[str, Any] = {"id": area.id, "name": area.name}
            if area.icon:
                ad["icon"] = area.icon
            count = sum(1 for aname in self._area_lookup.values() if aname == area.name)
            if count:
                ad["entity_count"] = count
            areas.append(ad)
        return areas

    async def _gather_devices(self) -> list[dict[str, Any]]:
        devices = []
        registry = dr.async_get(self.hass)
        for device in registry.devices.values():
            if device.disabled:
                continue
            dd: dict[str, Any] = {
                "id": device.id,
                "name": device.name or device.id,
                "friendly_name": device.name_by_user or device.name or device.id,
            }
            if device.area_id:
                dd["area_id"] = device.area_id
                if self._area_registry:
                    area = self._area_registry.async_get_area(device.area_id)
                    if area:
                        dd["area_name"] = area.name
            if device.manufacturer:
                dd["manufacturer"] = device.manufacturer
            if device.model:
                dd["model"] = device.model
            if device.sw_version:
                dd["sw_version"] = device.sw_version
            if self._entity_registry:
                eids = [
                    entry.entity_id
                    for entry in self._entity_registry.entities.values()
                    if entry.device_id == device.id and not entry.disabled
                ]
                if eids:
                    dd["entity_ids"] = eids
            devices.append(dd)
        return devices


@websocket_api.websocket_command({vol.Required("type"): "esphome_display/export"})
@websocket_api.async_response
async def websocket_export_metadata(
    hass: HomeAssistant,
    connection: websocket_api.ActiveConnection,
    msg: dict[str, Any],
) -> None:
    """Handle websocket request for metadata export."""
    exporter = MetadataExporter(hass)
    metadata = await exporter.async_gather_all()
    connection.send_result(msg["id"], metadata)


# ── complete_item service ──────────────────────────────────────────

COMPLETE_ITEM_SCHEMA = vol.Schema(
    {
        vol.Required("item"): cv.string,
        vol.Optional("status", default="completed"): vol.In(
            ["completed", "needs_action"]
        ),
    }
)


async def _handle_complete_item(service: cv.ServiceCall) -> None:
    """Mark a to-do item as complete on the source todo list.

    The target entity must be a :class:`TodoBridgeSensor` (exposes the
    ``entity_id`` attribute pointing at the real todo list entity).
    """
    hass = service.hass
    entity_id = service.data.get("entity_id")
    item = service.data.get("item")
    status = service.data.get("status", "completed")

    if not entity_id:
        _LOGGER.error("complete_item: no target entity_id provided")
        return

    state = hass.states.get(entity_id)
    if state is None:
        _LOGGER.error("complete_item: entity %s not found", entity_id)
        return

    todo_entity = state.attributes.get("entity_id")
    if not todo_entity:
        _LOGGER.error(
            "complete_item: entity %s has no 'entity_id' attribute — "
            "not a TodoBridgeSensor",
            entity_id,
        )
        return

    await hass.services.async_call(
        "todo",
        "update_item",
        {
            "entity_id": todo_entity,
            "item": item,
            "status": status,
        },
        blocking=True,
    )

    _LOGGER.info(
        "complete_item: marked '%s' as %s on %s", item, status, todo_entity
    )


def _register_services(hass: HomeAssistant) -> None:
    """Register integration services (idempotent)."""
    if hass.services.has_service(DOMAIN, "complete_item"):
        return
    hass.services.async_register(
        DOMAIN, "complete_item", _handle_complete_item, schema=COMPLETE_ITEM_SCHEMA,
    )


def _unregister_services(hass: HomeAssistant) -> None:
    """Remove integration services."""
    for name in ("complete_item",):
        if hass.services.has_service(DOMAIN, name):
            hass.services.async_remove(DOMAIN, name)


# ── setup / teardown ───────────────────────────────────────────────


async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Set up from a config entry."""
    if DOMAIN not in hass.data:
        hass.data[DOMAIN] = {"http_registered": False}

    # One-time infrastructure: websocket + panel
    if not hass.data[DOMAIN].get("http_registered"):
        websocket_api.async_register_command(hass, websocket_export_metadata)
        await async_register_panel(hass)
        hass.data[DOMAIN]["http_registered"] = True

    _register_services(hass)

    if entry.data.get(CONF_NOTIFICATIONS, True):
        await async_ensure_notification_entities(hass)

    await hass.config_entries.async_forward_entry_setups(entry, PLATFORMS)

    return True


async def async_unload_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Unload a config entry."""
    await hass.config_entries.async_unload_platforms(entry, PLATFORMS)
    async_unregister_panel(hass)
    _unregister_services(hass)
    return True


async def async_migrate_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Migrate config entry from version 1 (devices dict) to version 2 (flat)."""
    if entry.version == 1:
        devices = entry.data.get(CONF_DEVICES, {})

        todo_entities: list[str] = []
        for device_config in devices.values():
            for eid in device_config.get("todo_entities", []):
                if eid not in todo_entities:
                    todo_entities.append(eid)
            single = device_config.get("todo_entity")
            if single and single not in todo_entities:
                todo_entities.append(single)

        first_device = next(iter(devices.values()), {})
        default_severity = first_device.get("default_severity", "info")

        hass.config_entries.async_update_entry(
            entry,
            data={
                "notifications": True,
                "default_severity": default_severity,
                "todo_entities": todo_entities,
            },
            version=2,
        )
        _LOGGER.info(
            "Migrated config entry to v2 (todo_entities=%s)", todo_entities
        )

    return True

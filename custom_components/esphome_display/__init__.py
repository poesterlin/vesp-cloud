"""ESPHome Display Integration - Notification & Data Bridge."""

import json
import logging
import os
from datetime import datetime, timezone
from typing import Any

import voluptuous as vol
from aiohttp import web
from homeassistant.components import websocket_api
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant, ServiceCall, callback
from homeassistant.helpers import (
    config_validation as cv,
    device_registry as dr,
    entity_registry as er,
    area_registry as ar,
)
from homeassistant.const import CONF_NAME

from .const import DOMAIN
from .panel import async_register_panel, async_unregister_panel

METADATA_VERSION = "1.0.0"

# Sensitive attributes to strip from entity metadata
SENSITIVE_ATTRIBUTES = {
    "latitude",
    "longitude",
    "access_token",
    "ip_address",
    "mac_address",
    "serial_number",
    "password",
    "token",
    "api_key",
    "secret",
}

_LOGGER = logging.getLogger(__name__)

# Domain-specific suggested actions
DOMAIN_ACTIONS: dict[str, list[str]] = {
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

# Domain-specific state options
DOMAIN_STATE_OPTIONS: dict[str, list[str]] = {
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
        "disarmed",
        "armed_home",
        "armed_away",
        "armed_night",
        "triggered",
    ],
}

# Sensor display type inference based on device_class
SENSOR_DISPLAY_TYPES: dict[str, str] = {
    "temperature": "gauge",
    "humidity": "gauge",
    "pressure": "gauge",
    "battery": "gauge",
    "power": "graph",
    "energy": "graph",
    "voltage": "gauge",
    "current": "gauge",
    "illuminance": "gauge",
    "signal_strength": "gauge",
    "timestamp": "value",
    "duration": "value",
    "monetary": "value",
}

# Common service icons and metadata
SERVICE_METADATA: dict[str, dict[str, str | list[str]]] = {
    "turn_on": {
        "icon": "mdi:power-on",
        "targets": [
            "light",
            "switch",
            "fan",
            "media_player",
            "input_boolean",
            "automation",
            "camera",
        ],
    },
    "turn_off": {
        "icon": "mdi:power-off",
        "targets": [
            "light",
            "switch",
            "fan",
            "media_player",
            "input_boolean",
            "automation",
            "camera",
        ],
    },
    "toggle": {
        "icon": "mdi:toggle-switch",
        "targets": ["light", "switch", "fan", "input_boolean"],
    },
    "lock": {"icon": "mdi:lock", "targets": ["lock"]},
    "unlock": {"icon": "mdi:lock-open", "targets": ["lock"]},
    "open_cover": {"icon": "mdi:arrow-up-box", "targets": ["cover"]},
    "close_cover": {"icon": "mdi:arrow-down-box", "targets": ["cover"]},
    "stop_cover": {"icon": "mdi:stop", "targets": ["cover"]},
    "set_cover_position": {"icon": "mdi:arrow-expand-vertical", "targets": ["cover"]},
    "set_temperature": {
        "icon": "mdi:thermometer",
        "targets": ["climate", "water_heater"],
    },
    "set_hvac_mode": {"icon": "mdi:hvac", "targets": ["climate"]},
    "media_play": {"icon": "mdi:play", "targets": ["media_player"]},
    "media_pause": {"icon": "mdi:pause", "targets": ["media_player"]},
    "media_stop": {"icon": "mdi:stop", "targets": ["media_player"]},
    "volume_up": {"icon": "mdi:volume-plus", "targets": ["media_player"]},
    "volume_down": {"icon": "mdi:volume-minus", "targets": ["media_player"]},
    "volume_set": {"icon": "mdi:volume-high", "targets": ["media_player"]},
    "select_source": {"icon": "mdi:video-input-component", "targets": ["media_player"]},
    "start": {"icon": "mdi:play", "targets": ["vacuum", "script"]},
    "pause": {"icon": "mdi:pause", "targets": ["vacuum"]},
    "return_to_base": {"icon": "mdi:home", "targets": ["vacuum"]},
    "press": {"icon": "mdi:gesture-tap-button", "targets": ["button"]},
    "set_value": {"icon": "mdi:numeric", "targets": ["input_number", "number"]},
    "select_option": {"icon": "mdi:form-select", "targets": ["input_select", "select"]},
    "activate": {"icon": "mdi:play-circle", "targets": ["scene"]},
    "trigger": {"icon": "mdi:play", "targets": ["automation"]},
    "reload": {"icon": "mdi:reload", "targets": ["automation", "script", "scene"]},
}

CONF_DEVICES = "devices"
CONF_ESPHOME_DEVICE = "esphome_device"
CONF_DEFAULT_SEVERITY = "default_severity"
CONF_TODO_ENTITY = "todo_entity"

# Device configuration schema (for YAML setup)
DEVICE_SCHEMA = vol.Schema(
    {
        vol.Required(CONF_NAME): cv.string,
        vol.Required(CONF_ESPHOME_DEVICE): cv.string,
        vol.Optional(CONF_DEFAULT_SEVERITY, default="info"): vol.In(
            ["info", "warn", "alert", "question"]
        ),
        vol.Optional(CONF_TODO_ENTITY): cv.entity_id,
    }
)

# Integration configuration schema (for YAML setup)
CONFIG_SCHEMA = vol.Schema(
    {
        DOMAIN: vol.Schema(
            {
                vol.Required(CONF_DEVICES): vol.All(cv.ensure_list, [DEVICE_SCHEMA]),
            }
        ),
    },
    extra=vol.ALLOW_EXTRA,
)

PLATFORMS = ["sensor"]


class MetadataExporter:
    """Helper class to export Home Assistant metadata."""

    def __init__(self, hass: HomeAssistant) -> None:
        """Initialize the exporter."""
        self.hass = hass
        self._entity_registry: er.EntityRegistry | None = None
        self._area_registry: ar.AreaRegistry | None = None
        self._device_registry: dr.DeviceRegistry | None = None
        self._area_lookup: dict[str, str] = {}  # entity_id -> area_name

    async def async_gather_all(self) -> dict[str, Any]:
        """Gather all metadata asynchronously."""
        # Load registries
        self._entity_registry = er.async_get(self.hass)
        self._area_registry = ar.async_get(self.hass)
        self._device_registry = dr.async_get(self.hass)

        # Build entity -> area lookup
        self._build_area_lookup()

        return {
            "version": METADATA_VERSION,
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "entities": self._gather_entities(),
            "services": self._gather_services(),
            "devices": await self._gather_devices(),
        }

    def _build_area_lookup(self) -> None:
        """Build a lookup from entity_id to area name."""
        if (
            not self._entity_registry
            or not self._area_registry
            or not self._device_registry
        ):
            return

        for entity in self._entity_registry.entities.values():
            area_name = None

            # First check if entity has direct area assignment
            if entity.area_id:
                area = self._area_registry.async_get_area(entity.area_id)
                if area:
                    area_name = area.name
            # Otherwise check if device has area assignment
            elif entity.device_id:
                device = self._device_registry.async_get(entity.device_id)
                if device and device.area_id:
                    area = self._area_registry.async_get_area(device.area_id)
                    if area:
                        area_name = area.name

            if area_name:
                self._area_lookup[entity.entity_id] = area_name

    def _gather_entities(self) -> list[dict[str, Any]]:
        """Gather entity metadata with privacy filtering and enhanced data."""
        entities = []

        for state in self.hass.states.async_all():
            entity_id = state.entity_id
            domain = entity_id.split(".")[0]

            # Filter out sensitive attributes
            safe_attributes = [
                attr
                for attr in state.attributes.keys()
                if attr.lower() not in SENSITIVE_ATTRIBUTES
                and not any(s in attr.lower() for s in SENSITIVE_ATTRIBUTES)
            ]

            entity_data: dict[str, Any] = {
                "entity_id": entity_id,
                "domain": domain,
                "name": state.attributes.get("friendly_name", entity_id),
                "attributes": safe_attributes,
            }

            # Add optional metadata if present
            if device_class := state.attributes.get("device_class"):
                entity_data["device_class"] = device_class
            if unit := state.attributes.get("unit_of_measurement"):
                entity_data["unit"] = unit

            # Enhanced metadata: icon
            if icon := state.attributes.get("icon"):
                entity_data["icon"] = icon

            # Enhanced metadata: area (from lookup)
            if area := self._area_lookup.get(entity_id):
                entity_data["area"] = area

            # Enhanced metadata: suggested actions (domain-based)
            if domain in DOMAIN_ACTIONS:
                entity_data["suggested_actions"] = DOMAIN_ACTIONS[domain]

            # Enhanced metadata: state options (domain-based)
            if domain in DOMAIN_STATE_OPTIONS:
                entity_data["state_options"] = DOMAIN_STATE_OPTIONS[domain]

            # Sensor-specific metadata
            if domain == "sensor":
                if state_class := state.attributes.get("state_class"):
                    entity_data["state_class"] = state_class

                # Infer suggested display type from device_class
                if device_class and device_class in SENSOR_DISPLAY_TYPES:
                    entity_data["suggested_display"] = SENSOR_DISPLAY_TYPES[
                        device_class
                    ]
                elif state_class == "measurement":
                    entity_data["suggested_display"] = "gauge"
                elif state_class == "total_increasing":
                    entity_data["suggested_display"] = "graph"
                else:
                    entity_data["suggested_display"] = "value"

            entities.append(entity_data)

        return entities

    def _gather_services(self) -> dict[str, dict[str, Any]]:
        """Gather service metadata with enhanced information."""
        services: dict[str, dict[str, Any]] = {}

        for domain, domain_services in self.hass.services.async_services().items():
            services[domain] = {}

            for service_name, service_info in domain_services.items():
                # Generate friendly name from snake_case
                friendly_name = service_name.replace("_", " ").title()

                service_data: dict[str, Any] = {
                    "name": service_name,
                    "friendly_name": friendly_name,
                }

                # Add icon and common targets from SERVICE_METADATA if available
                if service_name in SERVICE_METADATA:
                    meta = SERVICE_METADATA[service_name]
                    if "icon" in meta:
                        service_data["icon"] = meta["icon"]
                    if "targets" in meta:
                        service_data["common_targets"] = meta["targets"]

                # Try to get schema if available (structure varies by HA version)
                schema = getattr(service_info, "schema", None)
                if schema:
                    fields = self._extract_fields_from_schema(schema)
                    if fields:
                        service_data["fields"] = fields

                services[domain][service_name] = service_data

        return services

    def _extract_fields_from_schema(
        self, schema: vol.Schema
    ) -> dict[str, dict[str, Any]]:
        """Extract field metadata from a voluptuous schema."""
        fields: dict[str, dict[str, Any]] = {}

        if not hasattr(schema, "schema"):
            return fields

        schema_dict = schema.schema
        if not isinstance(schema_dict, dict):
            return fields

        for key, validator in schema_dict.items():
            field_name = str(key)
            if hasattr(key, "schema"):
                field_name = str(key.schema)

            field_info: dict[str, Any] = {"name": field_name}

            # Determine if field is required
            if isinstance(key, vol.Required):
                field_info["required"] = True
            elif isinstance(key, vol.Optional):
                field_info["required"] = False
                # Only include default if it's JSON-serializable (not a function)
                if key.default is not vol.UNDEFINED and not callable(key.default):
                    try:
                        json.dumps(key.default)  # Test if serializable
                        field_info["default"] = key.default
                    except (TypeError, ValueError):
                        pass  # Skip non-serializable defaults

            # Extract selector info from validator if possible
            selector = self._infer_selector(validator)
            if selector:
                field_info["selector"] = selector

            fields[field_name] = field_info

        return fields

    def _infer_selector(self, validator: Any) -> dict[str, Any] | None:
        """Infer selector type from validator."""
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

    async def _gather_devices(self) -> list[dict[str, str]]:
        """Gather device metadata."""
        devices = []
        device_registry = dr.async_get(self.hass)

        for device in device_registry.devices.values():
            if device.disabled:
                continue

            device_data = {
                "name": device.name or device.id,
                "friendly_name": device.name_by_user or device.name or device.id,
            }

            if device.area_id:
                device_data["area_id"] = device.area_id

            devices.append(device_data)

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


async def async_setup(hass: HomeAssistant, config: dict[str, Any]) -> bool:
    """Set up the ESPHome Display integration from YAML."""
    if DOMAIN not in hass.data:
        hass.data[DOMAIN] = {"devices": {}, "http_registered": False}

    # Register HTTP views and panel (only once)
    if not hass.data[DOMAIN].get("http_registered"):
        # Register websocket command
        websocket_api.async_register_command(hass, websocket_export_metadata)

        # Register panel
        await async_register_panel(hass)

        hass.data[DOMAIN]["http_registered"] = True
        _LOGGER.debug("Registered metadata export websocket command and panel")

    if DOMAIN not in config:
        return True

    # Load devices from YAML configuration
    conf = config[DOMAIN]
    for device in conf.get(CONF_DEVICES, []):
        device_name = device[CONF_NAME]
        hass.data[DOMAIN]["devices"][device_name] = device

    _LOGGER.info(
        f"ESPHome Display: Loaded {len(hass.data[DOMAIN]['devices'])} device(s) from YAML"
    )

    # Setup notification service (works for both YAML and config flow)
    await _async_setup_services(hass)

    return True


async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Set up from a config entry."""
    if DOMAIN not in hass.data:
        hass.data[DOMAIN] = {"devices": {}, "http_registered": False}

    # Register HTTP views and panel (only once)
    if not hass.data[DOMAIN].get("http_registered"):
        # Register websocket command
        websocket_api.async_register_command(hass, websocket_export_metadata)

        hass.data[DOMAIN]["http_registered"] = True
        _LOGGER.debug("Registered metadata export websocket command")

    # Load devices from config entry
    devices = entry.data.get(CONF_DEVICES, {})
    for device_name, device_config in devices.items():
        hass.data[DOMAIN]["devices"][device_name] = device_config

    _LOGGER.info(f"ESPHome Display: Loaded {len(devices)} device(s) from config entry")

    # Setup notification service
    await _async_setup_services(hass)

    # Setup sensor platform for to-do bridge
    await hass.config_entries.async_forward_entry_setups(entry, PLATFORMS)

    return True


async def async_unload_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Unload a config entry."""
    await hass.config_entries.async_unload_platforms(entry, PLATFORMS)

    # Remove panel
    async_unregister_panel(hass)

    return True


async def _async_setup_services(hass: HomeAssistant) -> None:
    """Set up notification services."""

    async def handle_notify_service(call: ServiceCall) -> None:
        """Handle the notify service call."""
        device_name = call.data.get("device")
        title = call.data.get("title", "")
        message = call.data.get("message", "")
        severity = call.data.get("severity", "info")
        timeout = call.data.get("timeout")

        if DOMAIN not in hass.data:
            _LOGGER.error("ESPHome Display integration not initialized")
            return

        devices = hass.data[DOMAIN].get("devices", {})

        if device_name not in devices:
            _LOGGER.error(f"Device '{device_name}' not found in configuration")
            return

        device_config = devices[device_name]
        esphome_device = device_config.get(CONF_ESPHOME_DEVICE)

        # Validate severity
        if severity not in ["info", "warn", "alert", "question"]:
            severity = device_config.get(CONF_DEFAULT_SEVERITY, "info")

        _LOGGER.debug(
            f"Sending notification to {esphome_device}: "
            f"title='{title}', severity='{severity}'"
        )

        # Call the ESPHome service
        try:
            await hass.services.async_call(
                "esphome",
                "service",
                {
                    "device_id": esphome_device,
                    "service": "notify",
                    "variables": {
                        "title": title,
                        "message": message,
                        "severity": severity,
                    },
                },
            )

            # If timeout specified, schedule a clear notification call
            if timeout and timeout > 0:

                async def clear_notification() -> None:
                    await hass.services.async_call(
                        "esphome",
                        "service",
                        {
                            "device_id": esphome_device,
                            "service": "clear_notification",
                        },
                    )

                hass.loop.call_later(timeout, clear_notification)

        except Exception as err:
            _LOGGER.error(f"Error sending notification: {err}")

    # Only register service once
    if hass.services.has_service(DOMAIN, "notify"):
        return

    # Register the notify service
    hass.services.async_register(
        DOMAIN,
        "notify",
        handle_notify_service,
        schema=vol.Schema(
            {
                vol.Required("device"): cv.string,
                vol.Optional("title", default=""): cv.string,
                vol.Required("message"): cv.string,
                vol.Optional("severity", default="info"): vol.In(
                    ["info", "warn", "alert", "question"]
                ),
                vol.Optional("timeout"): cv.positive_int,
            }
        ),
    )

    _LOGGER.info("ESPHome Display notification service registered")

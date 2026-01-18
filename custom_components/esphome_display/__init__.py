"""ESPHome Display Integration - Notification & Data Bridge."""

import logging
from typing import Dict, Any, Optional

import voluptuous as vol
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant, ServiceCall, callback
from homeassistant.helpers import config_validation as cv
from homeassistant.const import CONF_NAME

from .const import DOMAIN

_LOGGER = logging.getLogger(__name__)

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


async def async_setup(hass: HomeAssistant, config: Dict[str, Any]) -> bool:
    """Set up the ESPHome Display integration from YAML."""
    if DOMAIN not in hass.data:
        hass.data[DOMAIN] = {"devices": {}}

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
        hass.data[DOMAIN] = {"devices": {}}

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

"""Config flow for ESPHome Display integration."""

import logging
from typing import Any, Dict, Optional

import voluptuous as vol
from homeassistant import config_entries, data_entry_flow
from homeassistant.core import HomeAssistant, callback
from homeassistant.data_entry_flow import FlowResult
from homeassistant.helpers import config_validation as cv
from homeassistant.helpers.selector import (
    EntitySelector,
    EntitySelectorConfig,
    SelectSelector,
    SelectSelectorConfig,
    SelectSelectorMode,
    TextSelector,
    TextSelectorConfig,
    TextSelectorType,
)

from .const import DOMAIN

_LOGGER = logging.getLogger(__name__)

# Validation schemas
DEVICE_SCHEMA = vol.Schema(
    {
        vol.Required("name"): TextSelector(
            TextSelectorConfig(type=TextSelectorType.TEXT)
        ),
        vol.Required("esphome_device"): TextSelector(
            TextSelectorConfig(type=TextSelectorType.TEXT)
        ),
        vol.Optional("default_severity", default="info"): SelectSelector(
            SelectSelectorConfig(
                options=["info", "warn", "alert", "question"],
                mode=SelectSelectorMode.DROPDOWN,
            )
        ),
        vol.Optional("todo_entity"): EntitySelector(
            EntitySelectorConfig(domain=["todo"])
        ),
    }
)


class ESPHomeDisplayConfigFlow(config_entries.ConfigFlow, domain=DOMAIN):
    """Handle a config flow for ESPHome Display."""

    VERSION = 1
    CONNECTION_CLASS = config_entries.CONN_CLASS_LOCAL_PUSH

    def __init__(self) -> None:
        """Initialize the config flow."""
        self.devices: Dict[str, Dict[str, Any]] = {}
        self.current_device_index: int = 0

    async def async_step_user(
        self, user_input: Optional[Dict[str, Any]] = None
    ) -> FlowResult:
        """Handle the initial step - welcome screen."""
        if user_input is not None:
            return await self.async_step_add_device()

        return self.async_show_form(
            step_id="user",
            description_placeholders={
                "doc_url": "https://github.com/your-username/esphome_display"
            },
        )

    async def async_step_add_device(
        self, user_input: Optional[Dict[str, Any]] = None
    ) -> FlowResult:
        """Handle adding a new device."""
        errors = {}

        if user_input is not None:
            # Validate inputs
            name = user_input.get("name", "").strip()
            esphome_device = user_input.get("esphome_device", "").strip()

            if not name:
                errors["name"] = "name_required"
            elif name in self.devices:
                errors["name"] = "name_exists"

            if not esphome_device:
                errors["esphome_device"] = "esphome_device_required"

            if not errors:
                # Store device config
                self.devices[name] = {
                    "esphome_device": esphome_device,
                    "default_severity": user_input.get("default_severity", "info"),
                    "todo_entity": user_input.get("todo_entity"),
                }

                # Ask if adding more devices
                return await self.async_step_add_more_devices()

        return self.async_show_form(
            step_id="add_device",
            data_schema=DEVICE_SCHEMA,
            errors=errors,
            description_placeholders={
                "devices_added": len(self.devices),
            },
        )

    async def async_step_add_more_devices(
        self, user_input: Optional[Dict[str, Any]] = None
    ) -> FlowResult:
        """Ask if user wants to add more devices."""
        if user_input is not None:
            if user_input.get("add_another"):
                return await self.async_step_add_device()
            else:
                # Finish setup
                return self.async_create_entry(
                    title=f"ESPHome Display ({len(self.devices)} device{'s' if len(self.devices) != 1 else ''})",
                    data={"devices": self.devices},
                )

        return self.async_show_form(
            step_id="add_more_devices",
            data_schema=vol.Schema(
                {
                    vol.Required("add_another", default=False): cv.boolean,
                }
            ),
            description_placeholders={
                "devices_added": len(self.devices),
            },
        )

    @staticmethod
    @callback
    def async_get_options_flow(
        config_entry: config_entries.ConfigEntry,
    ) -> config_entries.OptionFlow:
        """Create the options flow."""
        return ESPHomeDisplayOptionsFlow(config_entry)


class ESPHomeDisplayOptionsFlow(config_entries.OptionFlow):
    """Handle ESPHome Display options flow."""

    async def async_step_init(
        self, user_input: Optional[Dict[str, Any]] = None
    ) -> FlowResult:
        """Manage the options."""
        if user_input is not None:
            return self.async_create_entry(title="", data=user_input)

        return self.async_show_form(
            step_id="init",
            data_schema=vol.Schema(
                {
                    vol.Optional(
                        "default_timeout",
                        default=self.config_entry.options.get("default_timeout", 10),
                    ): vol.All(vol.Coerce(int), vol.Range(min=0, max=300)),
                }
            ),
        )

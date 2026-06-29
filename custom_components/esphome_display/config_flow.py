"""Config flow for ESPHome Display integration."""

from __future__ import annotations

import logging
from typing import Any

import voluptuous as vol
from homeassistant import config_entries
from homeassistant.core import callback
from homeassistant.data_entry_flow import FlowResult
from homeassistant.helpers.selector import (
    BooleanSelector,
    EntitySelector,
    EntitySelectorConfig,
    SelectSelector,
    SelectSelectorConfig,
    SelectSelectorMode,
)

from .const import DOMAIN

_LOGGER = logging.getLogger(__name__)


class ConfigFlow(config_entries.ConfigFlow, domain=DOMAIN):
    """Handle a config flow for ESPHome Display."""

    VERSION = 2

    async def async_step_user(
        self, user_input: dict[str, Any] | None = None
    ) -> FlowResult:
        """Single-screen setup: pick which helpers to enable."""

        if user_input is not None:
            return self.async_create_entry(
                title="ESPHome Display Helpers",
                data={
                    "notifications": user_input.get("notifications", True),
                    "default_severity": user_input.get("default_severity", "info"),
                    "todo_entities": user_input.get("todo_entities", []),
                },
            )

        return self.async_show_form(
            step_id="user",
            data_schema=vol.Schema(
                {
                    vol.Required("notifications", default=True): BooleanSelector(),
                    vol.Optional("default_severity", default="info"): SelectSelector(
                        SelectSelectorConfig(
                            options=[
                                ("Info (blue)", "info"),
                                ("Warning (amber)", "warn"),
                                ("Alert (red)", "alert"),
                                ("Question (green)", "question"),
                            ],
                            mode=SelectSelectorMode.DROPDOWN,
                        )
                    ),
                    vol.Optional("todo_entities"): EntitySelector(
                        EntitySelectorConfig(domain="todo", multiple=True)
                    ),
                }
            ),
        )

    @staticmethod
    @callback
    def async_get_options_flow(
        config_entry: config_entries.ConfigEntry,
    ) -> ESPHomeDisplayOptionsFlow:
        """Create the options flow."""
        return ESPHomeDisplayOptionsFlow(config_entry)


class ESPHomeDisplayOptionsFlow(config_entries.OptionsFlow):
    """Handle ESPHome Display options."""

    def __init__(self, config_entry: config_entries.ConfigEntry) -> None:
        """Initialize options flow."""
        self._config_entry = config_entry

    async def async_step_init(
        self, user_input: dict[str, Any] | None = None
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
                        default=self._config_entry.options.get("default_timeout", 10),
                    ): vol.All(vol.Coerce(int), vol.Range(min=0, max=300)),
                }
            ),
        )

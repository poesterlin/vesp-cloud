"""Panel registration for ESPHome Display."""

import logging
from pathlib import Path
from homeassistant.core import HomeAssistant
from homeassistant.components import frontend, panel_custom
from homeassistant.components.http import StaticPathConfig

_LOGGER = logging.getLogger(__name__)


async def async_register_panel(hass: HomeAssistant) -> None:
    """Register the custom panel (idempotent)."""
    www_path = Path(__file__).parent / "www"

    await hass.http.async_register_static_paths(
        [StaticPathConfig("/esphome-display-static", str(www_path), False)]
    )

    try:
        await panel_custom.async_register_panel(
            hass,
            webcomponent_name="esphome-display-panel",
            frontend_url_path="esphome-display",
            module_url="/esphome-display-static/panel.js",
            sidebar_title="ESPHome Display",
            sidebar_icon="mdi:monitor-export",
            require_admin=False,
            config={},
        )
        _LOGGER.info("ESPHome Display panel registered at /esphome-display")
    except ValueError:
        _LOGGER.debug("ESPHome Display panel already registered")


def async_unregister_panel(hass: HomeAssistant) -> None:
    """Unregister the custom panel."""
    frontend.async_remove_panel(hass, "esphome-display")
    _LOGGER.info("ESPHome Display panel removed")

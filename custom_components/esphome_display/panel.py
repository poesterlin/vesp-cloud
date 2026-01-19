"""Panel registration for ESPHome Display."""

import logging
from pathlib import Path
from homeassistant.core import HomeAssistant
from homeassistant.components import frontend, panel_custom
from homeassistant.components.http import StaticPathConfig

_LOGGER = logging.getLogger(__name__)


async def async_register_panel(hass: HomeAssistant) -> None:
    """Register the custom panel."""
    # 1. Serve static files from the integration's www folder
    # We use /esphome-display-static as the URL path to avoid conflicts
    www_path = Path(__file__).parent / "www"

    # Check if the path is already registered is handled by HA, but we log for debug
    _LOGGER.debug("Registering static path %s for panel", www_path)

    await hass.http.async_register_static_paths(
        [StaticPathConfig("/esphome-display-static", str(www_path), False)]
    )

    # 2. Register the panel programmatically
    # Note: frontend_url_path is the part in the browser URL (e.g. /esphome-display)
    # webcomponent_name must match the customElements.define in JS
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


def async_unregister_panel(hass: HomeAssistant) -> None:
    """Unregister the custom panel."""
    frontend.async_remove_panel(hass, "esphome-display")
    _LOGGER.info("ESPHome Display panel removed")

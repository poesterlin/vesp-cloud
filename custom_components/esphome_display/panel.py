"""Panel registration for HA Metadata Exporter."""

import logging
from pathlib import Path

from homeassistant.components import frontend, panel_custom
from homeassistant.components.http import StaticPathConfig
from homeassistant.core import HomeAssistant

_LOGGER = logging.getLogger(__name__)


async def async_register_panel(hass: HomeAssistant) -> None:
    """Register the custom panel (idempotent)."""
    www_path = Path(__file__).parent / "www"

    await hass.http.async_register_static_paths(
        [StaticPathConfig("/display-metadata-static", str(www_path), False)]
    )

    try:
        await panel_custom.async_register_panel(
            hass,
            webcomponent_name="display-metadata-panel",
            frontend_url_path="display-metadata",
            module_url="/display-metadata-static/panel.js",
            sidebar_title="HA Metadata Exporter",
            sidebar_icon="mdi:monitor-export",
            require_admin=False,
            config={},
        )
        _LOGGER.info("Metadata Export panel registered at /display-metadata")
    except ValueError:
        _LOGGER.debug("Metadata Export panel already registered")


def async_unregister_panel(hass: HomeAssistant) -> None:
    """Unregister the custom panel."""
    frontend.async_remove_panel(hass, "display-metadata")
    _LOGGER.info("Metadata Export panel removed")

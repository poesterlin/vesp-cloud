"""vESP.cloud Notifications integration."""

from __future__ import annotations

import asyncio

import voluptuous as vol

from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant, ServiceCall
import homeassistant.helpers.config_validation as cv

from .const import (
    ATTR_DURATION,
    ATTR_MESSAGE,
    ATTR_NOTIFICATION_ID,
    ATTR_SEVERITY,
    ATTR_TITLE,
    DOMAIN,
    PLATFORMS,
    SERVICE_CLEAR,
    SERVICE_SEND,
    SEVERITY_INFO,
    SEVERITY_OPTIONS,
    STATE_IDLE,
    STATE_NOTIFYING,
)

SERVICE_SEND_SCHEMA = vol.Schema(
    {
        vol.Required(ATTR_NOTIFICATION_ID): cv.string,
        vol.Optional(ATTR_TITLE, default="Alert"): cv.string,
        vol.Required(ATTR_MESSAGE): cv.string,
        vol.Optional(ATTR_SEVERITY, default=SEVERITY_INFO): vol.In(SEVERITY_OPTIONS),
        vol.Optional(ATTR_DURATION, default=0): vol.All(
            vol.Coerce(int),
            vol.Range(min=0, max=86400),
        ),
    }
)

SERVICE_CLEAR_SCHEMA = vol.Schema(
    {
        vol.Required(ATTR_NOTIFICATION_ID): cv.string,
    }
)


def _async_reset_notification(runtime: dict[str, object]) -> None:
    runtime["state"] = STATE_IDLE
    runtime["title"] = ""
    runtime["message"] = ""
    runtime["severity"] = SEVERITY_INFO
    runtime["notification_id"] = ""
    runtime["clear_task"] = None


def _async_notify_listeners(hass: HomeAssistant) -> None:
    for listener in tuple(hass.data[DOMAIN]["listeners"]):
        listener()


async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Set up from a config entry."""
    if DOMAIN not in hass.data:
        hass.data[DOMAIN] = {
            "state": STATE_IDLE,
            "title": "",
            "message": "",
            "severity": SEVERITY_INFO,
            "notification_id": "",
            "listeners": set(),
            "clear_task": None,
        }

    if not hass.services.has_service(DOMAIN, SERVICE_SEND):

        async def async_handle_send(call: ServiceCall) -> None:
            runtime = hass.data[DOMAIN]

            clear_task: asyncio.Task | None = runtime["clear_task"]
            if clear_task is not None and not clear_task.done():
                clear_task.cancel()

            title = call.data[ATTR_TITLE]
            message = call.data[ATTR_MESSAGE]
            severity = call.data[ATTR_SEVERITY]
            duration = call.data[ATTR_DURATION]
            notification_id = call.data[ATTR_NOTIFICATION_ID]

            runtime["title"] = title
            runtime["message"] = message
            runtime["severity"] = severity
            runtime["notification_id"] = notification_id
            runtime["state"] = STATE_NOTIFYING if message else STATE_IDLE

            _async_notify_listeners(hass)

            if duration > 0 and message:

                async def async_clear_later() -> None:
                    try:
                        await asyncio.sleep(duration)
                    except asyncio.CancelledError:
                        return

                    _async_reset_notification(runtime)
                    _async_notify_listeners(hass)

                runtime["clear_task"] = hass.async_create_task(async_clear_later())
            else:
                runtime["clear_task"] = None

        hass.services.async_register(
            DOMAIN,
            SERVICE_SEND,
            async_handle_send,
            schema=SERVICE_SEND_SCHEMA,
        )

    if not hass.services.has_service(DOMAIN, SERVICE_CLEAR):

        async def async_handle_clear(call: ServiceCall) -> None:
            runtime = hass.data[DOMAIN]

            notification_id = call.data[ATTR_NOTIFICATION_ID]
            if runtime["state"] != STATE_NOTIFYING:
                return

            if runtime["notification_id"] != notification_id:
                return

            clear_task: asyncio.Task | None = runtime["clear_task"]
            if clear_task is not None and not clear_task.done():
                clear_task.cancel()

            _async_reset_notification(runtime)
            _async_notify_listeners(hass)

        hass.services.async_register(
            DOMAIN,
            SERVICE_CLEAR,
            async_handle_clear,
            schema=SERVICE_CLEAR_SCHEMA,
        )

    await hass.config_entries.async_forward_entry_setups(entry, PLATFORMS)
    return True


async def async_unload_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Unload a config entry."""
    unload_ok = await hass.config_entries.async_unload_platforms(entry, PLATFORMS)
    if not unload_ok:
        return False

    if len(hass.config_entries.async_entries(DOMAIN)) == 1:
        if hass.services.has_service(DOMAIN, SERVICE_SEND):
            hass.services.async_remove(DOMAIN, SERVICE_SEND)
        if hass.services.has_service(DOMAIN, SERVICE_CLEAR):
            hass.services.async_remove(DOMAIN, SERVICE_CLEAR)

        clear_task: asyncio.Task | None = hass.data[DOMAIN]["clear_task"]
        if clear_task is not None and not clear_task.done():
            clear_task.cancel()

        hass.data.pop(DOMAIN, None)

    return True

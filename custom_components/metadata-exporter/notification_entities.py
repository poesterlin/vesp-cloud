"""Auto-create notification overlay helper entities for display integrations."""

import logging
from homeassistant.core import HomeAssistant
from homeassistant.helpers.storage import Store

_LOGGER = logging.getLogger(__name__)

STORAGE_VERSION = 1

NOTIFICATION_ENTITIES: dict[str, list[dict]] = {
    "input_text": [
        {
            "id": "notification_title",
            "name": "Notification Title",
            "min": 0,
            "max": 255,
            "mode": "text",
            "initial": "",
        },
        {
            "id": "notification_body",
            "name": "Notification Body",
            "min": 0,
            "max": 255,
            "mode": "text",
            "initial": "",
        },
    ],
    "input_select": [
        {
            "id": "notification_severity",
            "name": "Notification Severity",
            "options": ["info", "warning", "question", "critical"],
            "initial": "info",
        },
    ],
}


async def async_ensure_notification_entities(hass: HomeAssistant) -> None:
    """Auto-create input_text and input_select helper entities for notification overlay.

    Creates the following entities if they do not already exist:
      - input_text.notification_title
      - input_text.notification_body
      - input_select.notification_severity

    Uses the same storage mechanism as the Home Assistant UI, so entities
    persist across restarts and appear in Settings > Devices & Services > Helpers.
    """
    for domain, entities_config in NOTIFICATION_ENTITIES.items():
        store = Store(hass, STORAGE_VERSION, domain)
        stored = await store.async_load()

        if stored is None:
            stored = {"items": []}

        existing_ids: set[str] = {item["id"] for item in stored.get("items", [])}
        created = False

        for entity_config in entities_config:
            entity_id_str = entity_config["id"]
            if entity_id_str not in existing_ids:
                stored.setdefault("items", []).append(entity_config)
                existing_ids.add(entity_id_str)
                created = True
                _LOGGER.info(
                    "Created %s.%s helper entity for notification overlay",
                    domain,
                    entity_id_str,
                )

        if created:
            await store.async_save(stored)
            # Reload the component so the new entities become active immediately
            if hass.services.has_service(domain, "reload"):
                await hass.services.async_call(domain, "reload", blocking=True)
                _LOGGER.debug("Reloaded %s component to activate new entities", domain)

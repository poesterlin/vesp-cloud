import { browser } from "$app/environment";
import type {
  HomeAssistantDump,
  Entity,
  Device,
  Area,
  Services,
  ServiceAction,
} from "@esphome-designer/schema/homeassistant";

const STORAGE_KEY = "esphome-designer-homeassistant-dump";

function createHomeAssistantStore() {
  let dump = $state<HomeAssistantDump | null>(null);

  // Derived state for convenient access
  const entities = $derived(dump?.entities ?? []);
  const devices = $derived(dump?.devices ?? []);
  const areasList = $derived(dump?.areas ?? []);
  const services = $derived(dump?.services ?? ({} as Services));

  // Entity lookups
  const entitiesByDomain = $derived(
    entities.reduce<Record<string, Entity[]>>(
      (acc: Record<string, Entity[]>, entity: Entity) => {
        if (!acc[entity.domain]) acc[entity.domain] = [];
        acc[entity.domain].push(entity);
        return acc;
      },
      {}
    )
  );

  const entityById = $derived(
    entities.reduce<Record<string, Entity>>(
      (acc: Record<string, Entity>, entity: Entity) => {
        acc[entity.entity_id] = entity;
        return acc;
      },
      {}
    )
  );

  // Device lookups
  const deviceByName = $derived(
    devices.reduce<Record<string, Device>>(
      (acc: Record<string, Device>, device: Device) => {
        acc[device.name] = device;
        return acc;
      },
      {}
    )
  );

  const deviceById = $derived(
    devices.reduce<Record<string, Device>>(
      (acc: Record<string, Device>, device: Device) => {
        acc[device.id] = device;
        return acc;
      },
      {}
    )
  );

  const devicesByArea = $derived(
    devices.reduce<Record<string, Device[]>>(
      (acc: Record<string, Device[]>, device: Device) => {
        const area = device.area_name ?? device.area_id ?? "unassigned";
        if (!acc[area]) acc[area] = [];
        acc[area].push(device);
        return acc;
      },
      {}
    )
  );

  // Area lookups
  const areaById = $derived(
    areasList.reduce<Record<string, Area>>(
      (acc: Record<string, Area>, area: Area) => {
        acc[area.id] = area;
        return acc;
      },
      {}
    )
  );

  // Available domains from entities
  const domains = $derived([...new Set(entities.map((e: Entity) => e.domain))].sort());

  // Available areas - prefer the areas list if available, fall back to entity areas
  const areas = $derived(
    areasList.length > 0
      ? areasList.map((a: Area) => a.name).sort()
      : [...new Set(entities.map((e: Entity) => e.area).filter((a): a is string => !!a))].sort()
  );

  // Persistence
  function save() {
    if (!browser) return;
    if (dump) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(dump));
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  }

  function load(): boolean {
    if (!browser) return false;
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        dump = JSON.parse(stored);
        return true;
      } catch {
        console.error("Failed to parse stored HomeAssistant dump");
        return false;
      }
    }
    return false;
  }

  // Actions
  function setDump(data: HomeAssistantDump) {
    dump = data;
    save();
  }

  function clear() {
    dump = null;
    save();
  }

  function importFromJson(json: string): boolean {
    try {
      const data = JSON.parse(json) as HomeAssistantDump;
      if (!data.entities || !data.devices || !data.services) {
        throw new Error("Invalid HomeAssistant dump format");
      }
      setDump(data);
      return true;
    } catch (err: unknown) {
      console.error("Failed to import HomeAssistant dump:", err);
      return false;
    }
  }

  // Query helpers
  function getEntity(entityId: string): Entity | undefined {
    return entityById[entityId];
  }

  function getEntitiesByDomain(domain: string): Entity[] {
    return entitiesByDomain[domain] ?? [];
  }

  function getEntitiesByArea(area: string): Entity[] {
    return entities.filter((e: Entity) => e.area === area);
  }

  function getDevice(name: string): Device | undefined {
    return deviceByName[name];
  }

  function getDeviceById(id: string): Device | undefined {
    return deviceById[id];
  }

  function getEntitiesByDevice(deviceId: string): Entity[] {
    return entities.filter((e: Entity) => e.device_id === deviceId);
  }

  function getArea(id: string): Area | undefined {
    return areaById[id];
  }

  function getServiceActions(domain: string): ServiceAction[] {
    const domainServices = services[domain];
    if (!domainServices) return [];
    return Object.values(domainServices);
  }

  function searchEntities(query: string): Entity[] {
    const q = query.toLowerCase();
    return entities.filter(
      (e: Entity) =>
        e.entity_id.toLowerCase().includes(q) ||
        e.name.toLowerCase().includes(q) ||
        e.area?.toLowerCase().includes(q)
    );
  }

  // Initialize from storage
  load();

  return {
    // State (read-only getters)
    get dump() {
      return dump;
    },
    get entities() {
      return entities;
    },
    get devices() {
      return devices;
    },
    get services() {
      return services;
    },
    get domains() {
      return domains;
    },
    get areas() {
      return areas;
    },
    get devicesByArea() {
      return devicesByArea;
    },
    get areasList() {
      return areasList;
    },
    get isLoaded() {
      return dump !== null;
    },
    get version() {
      return dump?.version;
    },
    get generatedAt() {
      return dump?.generated_at;
    },

    // Actions
    setDump,
    clear,
    importFromJson,
    load,

    // Query helpers
    getEntity,
    getEntitiesByDomain,
    getEntitiesByArea,
    getDevice,
    getDeviceById,
    getEntitiesByDevice,
    getArea,
    getServiceActions,
    searchEntities,
  };
}

export const homeAssistantStore = createHomeAssistantStore();

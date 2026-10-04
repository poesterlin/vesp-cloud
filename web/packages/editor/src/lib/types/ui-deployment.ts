import type { UiFirmwareCapabilities } from '../codegen/ui-capabilities';

export interface UiDeploymentStatus {
  ready: boolean;
  installationConfirmed: boolean;
  firmwareBuilds: Array<{ id: string; capabilities: UiFirmwareCapabilities }>;
  published: { revision: number; fingerprint: string; createdAt: string | Date } | null;
  devices: Array<{ deviceId: string; firmwareBuildId: string | null; source: string; fingerprint: string;
    activeRevision: number | null; canLoadPublished: boolean; reportedAt: string | Date; error: string | null }>;
}

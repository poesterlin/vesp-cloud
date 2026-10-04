-- Additive migration for the reboot-only manifest publishing workflow.
-- Apply before starting the updated editor and compilation worker.
BEGIN;
CREATE TABLE IF NOT EXISTS ui_firmware_build (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid UNIQUE REFERENCES compilation_jobs(id) ON DELETE SET NULL,
  source_export boolean NOT NULL DEFAULT false,
  available boolean NOT NULL DEFAULT false,
  project_id uuid NOT NULL REFERENCES project(id) ON DELETE CASCADE ON UPDATE CASCADE,
  capabilities jsonb NOT NULL,
  manifest_base64 text NOT NULL,
  sha256 varchar(64) NOT NULL,
  fingerprint varchar(16) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS ui_manifest_release (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES project(id) ON DELETE CASCADE ON UPDATE CASCADE,
  revision integer NOT NULL,
  requirements jsonb NOT NULL,
  manifest_base64 text NOT NULL,
  sha256 varchar(64) NOT NULL,
  fingerprint varchar(16) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS ui_manifest_release_project_revision ON ui_manifest_release(project_id, revision);
CREATE TABLE IF NOT EXISTS ui_device_boot (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES project(id) ON DELETE CASCADE ON UPDATE CASCADE,
  device_id varchar(64) NOT NULL,
  firmware_build_id uuid REFERENCES ui_firmware_build(id) ON DELETE SET NULL,
  fingerprint varchar(16) NOT NULL,
  source varchar(16) NOT NULL,
  error varchar(512),
  reported_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS ui_device_boot_project_device ON ui_device_boot(project_id, device_id);
COMMIT;

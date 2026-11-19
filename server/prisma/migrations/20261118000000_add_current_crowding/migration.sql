CREATE TABLE "crowding_areas" (
  "id" TEXT PRIMARY KEY, "name" TEXT NOT NULL, "boundary_version" TEXT NOT NULL,
  "boundary_url" TEXT NOT NULL, "active" BOOLEAN NOT NULL DEFAULT true,
  "enabled" BOOLEAN NOT NULL DEFAULT false, "interval_minutes" INTEGER NOT NULL DEFAULT 30,
  "revision" INTEGER NOT NULL DEFAULT 1, "next_due_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lease_token" TEXT, "lease_until" TIMESTAMP(3), "last_attempt_at" TIMESTAMP(3),
  "last_success_at" TIMESTAMP(3), "last_error" TEXT, "failures" INTEGER NOT NULL DEFAULT 0,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "crowding_interval_valid" CHECK ("interval_minutes" BETWEEN 1 AND 1440)
);
CREATE INDEX "crowding_areas_enabled_active_next_due_at_idx" ON "crowding_areas" ("enabled", "active", "next_due_at");
CREATE TABLE "crowding_observations" (
  "area_id" TEXT NOT NULL REFERENCES "crowding_areas"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "boundary_version" TEXT NOT NULL,
  "observed_at" TIMESTAMP(3) NOT NULL,
  "level" TEXT NOT NULL,
  "quality" TEXT,
  "fetched_at" TIMESTAMP(3) NOT NULL,
  PRIMARY KEY ("area_id", "boundary_version", "observed_at"),
  CONSTRAINT "crowding_observation_level_valid" CHECK ("level" IN ('여유', '보통', '약간 붐빔', '붐빔'))
);
CREATE TABLE "crowding_mappings" (
  "event_id" TEXT PRIMARY KEY REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "area_id" TEXT NOT NULL REFERENCES "crowding_areas"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "fingerprint" TEXT NOT NULL, "evidence" TEXT NOT NULL, "verified_by" TEXT NOT NULL,
  "verified_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "crowding_mappings_area_id_idx" ON "crowding_mappings" ("area_id");
CREATE TABLE "crowding_audits" (
  "id" TEXT PRIMARY KEY, "actor_id" TEXT NOT NULL, "action" TEXT NOT NULL,
  "details" JSONB NOT NULL, "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

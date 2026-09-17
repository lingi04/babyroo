ALTER TABLE "push_devices" ADD COLUMN "provider" TEXT NOT NULL DEFAULT 'fcm';
DROP INDEX "push_devices_token_key";
CREATE UNIQUE INDEX "push_devices_provider_token_key" ON "push_devices"("provider", "token");

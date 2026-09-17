CREATE TABLE "push_devices" (
  "installation_id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "token" TEXT NOT NULL,
  "platform" TEXT NOT NULL,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "push_devices_pkey" PRIMARY KEY ("installation_id"),
  CONSTRAINT "push_devices_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "push_devices_token_key" ON "push_devices"("token");
CREATE INDEX "push_devices_user_id_idx" ON "push_devices"("user_id");

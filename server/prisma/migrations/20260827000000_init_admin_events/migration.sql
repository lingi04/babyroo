ALTER TABLE "events"
    ALTER COLUMN "csv_sequence" DROP NOT NULL,
    ADD COLUMN "publication_status" TEXT NOT NULL DEFAULT 'published',
    ADD COLUMN "admin_updated_at" TIMESTAMP(3);

ALTER TABLE "events"
    ALTER COLUMN "publication_status" SET DEFAULT 'draft';

CREATE INDEX "events_publication_status_idx" ON "events"("publication_status");

CREATE TABLE "admin_users" (
    "id" TEXT NOT NULL,
    "google_sub" TEXT,
    "email" TEXT NOT NULL,
    "display_name" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "admin_users_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "admin_users_google_sub_key" ON "admin_users"("google_sub");
CREATE UNIQUE INDEX "admin_users_email_key" ON "admin_users"("email");

CREATE TABLE "event_audit_logs" (
    "id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "admin_user_id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "before" JSONB,
    "after" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "event_audit_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "event_audit_logs_event_id_created_at_idx" ON "event_audit_logs"("event_id", "created_at");
CREATE INDEX "event_audit_logs_admin_user_id_created_at_idx" ON "event_audit_logs"("admin_user_id", "created_at");

ALTER TABLE "event_audit_logs"
    ADD CONSTRAINT "event_audit_logs_admin_user_id_fkey"
    FOREIGN KEY ("admin_user_id") REFERENCES "admin_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "event_audit_logs"
    ADD CONSTRAINT "event_audit_logs_event_id_fkey"
    FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

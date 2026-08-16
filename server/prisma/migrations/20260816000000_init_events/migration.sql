CREATE TABLE "events" (
  "id" TEXT NOT NULL,
  "csv_sequence" INTEGER NOT NULL,
  "title" TEXT NOT NULL,
  "venue_name" TEXT NOT NULL,
  "venue_detail" TEXT,
  "address" TEXT,
  "image_url" TEXT,
  "locality" TEXT NOT NULL,
  "region" TEXT NOT NULL,
  "category" TEXT NOT NULL,
  "source" TEXT NOT NULL,
  "source_event_id" TEXT,
  "starts_at" DATE NOT NULL,
  "ends_at" DATE NOT NULL,
  "age_min_months" INTEGER,
  "age_max_months" INTEGER,
  "indoor" BOOLEAN,
  "price_text" TEXT,
  "price_type" TEXT NOT NULL DEFAULT 'unknown',
  "reservation_required" BOOLEAN,
  "reservation_status" TEXT NOT NULL DEFAULT 'unknown',
  "guardian_required" BOOLEAN,
  "stroller_friendly" BOOLEAN,
  "nursing_room" BOOLEAN,
  "parking" BOOLEAN,
  "tags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "summary" TEXT NOT NULL,
  "source_url" TEXT NOT NULL,
  "last_checked_at" DATE,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "events_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "events_csv_sequence_key" ON "events"("csv_sequence");
CREATE UNIQUE INDEX "events_source_source_event_id_key" ON "events"("source", "source_event_id");
CREATE INDEX "events_region_locality_idx" ON "events"("region", "locality");
CREATE INDEX "events_category_idx" ON "events"("category");
CREATE INDEX "events_starts_at_ends_at_idx" ON "events"("starts_at", "ends_at");
CREATE INDEX "events_price_type_idx" ON "events"("price_type");
CREATE INDEX "events_reservation_status_idx" ON "events"("reservation_status");
CREATE INDEX "events_source_idx" ON "events"("source");
CREATE INDEX "events_tags_gin_idx" ON "events" USING GIN ("tags");

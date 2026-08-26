CREATE TABLE "google_play_purchases" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "package_name" TEXT NOT NULL,
    "purchase_token" TEXT NOT NULL,
    "order_id" TEXT,
    "purchase_state" INTEGER,
    "consumption_state" INTEGER,
    "acknowledgement_state" INTEGER,
    "credits" INTEGER NOT NULL,
    "credited_ledger_entry_id" TEXT NOT NULL,
    "raw_response" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "google_play_purchases_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "google_play_purchases_purchase_token_key" ON "google_play_purchases"("purchase_token");
CREATE INDEX "google_play_purchases_user_id_created_at_idx" ON "google_play_purchases"("user_id", "created_at");

ALTER TABLE "google_play_purchases"
    ADD CONSTRAINT "google_play_purchases_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "google_play_purchases"
    ADD CONSTRAINT "google_play_purchases_credited_ledger_entry_id_fkey"
    FOREIGN KEY ("credited_ledger_entry_id") REFERENCES "credit_ledger_entries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

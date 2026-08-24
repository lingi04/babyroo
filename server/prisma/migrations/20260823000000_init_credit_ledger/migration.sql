CREATE TABLE "credit_accounts" (
  "user_id" TEXT NOT NULL,
  "available" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "credit_accounts_pkey" PRIMARY KEY ("user_id")
);

CREATE TABLE "credit_ledger_entries" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "amount" INTEGER NOT NULL,
  "reason" TEXT NOT NULL,
  "metadata" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "credit_ledger_entries_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "credit_ledger_entries_user_id_created_at_idx"
  ON "credit_ledger_entries"("user_id", "created_at");

ALTER TABLE "credit_accounts"
  ADD CONSTRAINT "credit_accounts_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "credit_ledger_entries"
  ADD CONSTRAINT "credit_ledger_entries_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

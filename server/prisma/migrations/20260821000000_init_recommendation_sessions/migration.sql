CREATE TABLE "recommendation_sessions" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "selected_child_ids" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "selected_children_snapshot" JSONB NOT NULL,
    "answers" JSONB NOT NULL,
    "preferences" JSONB NOT NULL,
    "results" JSONB NOT NULL,
    "credit_cost" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "recommendation_sessions_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "recommendation_sessions_user_id_created_at_idx"
    ON "recommendation_sessions"("user_id", "created_at");

ALTER TABLE "recommendation_sessions"
    ADD CONSTRAINT "recommendation_sessions_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

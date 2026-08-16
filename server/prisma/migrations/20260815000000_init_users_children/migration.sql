CREATE TABLE "users" (
  "id" TEXT NOT NULL,
  "displayName" TEXT NOT NULL,
  "homeRegion" TEXT NOT NULL DEFAULT '서울',
  "homeAddress" JSONB,
  "preferredLocalities" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "activeChildIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "children" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "nickname" TEXT NOT NULL,
  "birthDate" TEXT NOT NULL,
  "gender" TEXT NOT NULL DEFAULT 'unknown',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "children_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "children_userId_idx" ON "children"("userId");

ALTER TABLE "children"
  ADD CONSTRAINT "children_userId_fkey"
  FOREIGN KEY ("userId")
  REFERENCES "users"("id")
  ON DELETE CASCADE
  ON UPDATE CASCADE;

CREATE TABLE "app_policies" (
  "platform" TEXT PRIMARY KEY CHECK ("platform" IN ('android', 'ios')),
  "minimum_build" INTEGER NOT NULL DEFAULT 0 CHECK ("minimum_build" >= 0),
  "latest_build" INTEGER NOT NULL DEFAULT 0 CHECK ("latest_build" >= "minimum_build"),
  "store_url" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "app_policies" ("platform", "store_url", "message") VALUES
('android', 'https://play.google.com/store/apps/details?id=com.babyroo', '새로운 버전으로 업데이트 후 이용해 주세요.'),
('ios', '', '새로운 버전으로 업데이트 후 이용해 주세요.');

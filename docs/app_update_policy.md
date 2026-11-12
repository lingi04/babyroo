# Minimum supported app builds

`GET /api/app-policy?platform=android|ios` is public and returns `minimumBuild`, `latestBuild`, `storeUrl`, and `message`. HTTP responses use `Cache-Control: no-store`. Invalid platforms return 400; a missing policy row returns 503.

Policies are stored in the `app_policies` table, keyed by platform. The migration creates Android and iOS rows with both builds set to `0` (enforcement disabled), the default Korean message, the Android Play Store URL, and an empty iOS URL. Configure the actual iOS App Store URL before enabling updates. Environment variables named `APP_POLICY_*` are no longer used and existing environment settings are not imported automatically.

Apply the migration with `cd server && npm run db:deploy` before deploying the updated API. In the admin app, open **앱 업데이트 정책** to view and save each platform independently. Saving takes effect on the next API request without a restart. The public response shape remains unchanged.

Authenticated admin endpoints:

- `GET /api/admin/app-policies`: list platform policies, including their update timestamps.
- `PUT /api/admin/app-policies/:platform`: save `minimumBuild`, `latestBuild`, `storeUrl`, and `message` as a complete policy. Builds must be integers from 0 through 2147483647, latest must be at least minimum, and enabled updates require the platform's HTTPS store URL. Invalid input returns 400.

Example: minimum Android build `26` blocks `25` and allows `26` or later. `latestBuild` is reserved for future optional-update UI; it does not trigger mandatory updates.

Native entry points supply `nativeBuild` using Android `BuildConfig.VERSION_CODE` and iOS `CFBundleVersion`. Use positive, monotonically increasing integer build numbers on both platforms (iOS currently uses `CURRENT_PROJECT_VERSION = 1`). Marketing versions and package.json versions are not used. Dotted iOS build numbers are unsupported. Missing or invalid native metadata shows a blocking diagnostic screen.

The gate runs before mounting the main app and checks again on foreground or manual retry. Unsupported builds see a full-screen update view with store and retry actions, without a dismiss action. Store errors stay on this screen. A five-second request timeout bounds startup network checking.

The last valid policy is cached separately per platform. Offline, a cached mandatory policy still blocks; without one, access is allowed. A fresh valid response replaces the cache, including lowering the minimum to undo enforcement. Corrupt or invalid responses cannot overwrite valid cached policy. Storage failure does not invalidate a successful fetch.

## Release sequence

1. Release the gate with the server minimum still `0`.
2. Publish the replacement and verify that all affected users can download it, including country and OS availability. Do not raise the minimum during a rollout that excludes affected users.
3. Save the minimum and latest builds in the admin policy page. Keep `latestBuild >= minimumBuild`.
4. Verify older builds block, the minimum build opens normally, store navigation works, and foregrounding rechecks.
5. To undo enforcement, lower the minimum or set it to `0` in the admin page. Devices need a successful refresh to receive the rollback.

This is an app UI gate. Business API requests are not rejected, and versions released before the gate cannot show it. Client-reported build numbers would not form a security boundary even with API enforcement. Native launch property changes require rebuilding the installed app; Metro reload alone does not add them.

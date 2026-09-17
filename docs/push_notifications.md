# Recommendation completion notifications

Every terminal recommendation outcome (`success`, `failed`, `timeout`, including
empty results) is saved before delivery is attempted. Push failures cannot change
the saved outcome or consume another credit. Requests rejected before a job is
created do not produce completion notifications.

The notification service creates a provider-independent message containing the
user ID, session ID, and status. The selected delivery adapter sends it; FCM is
the currently implemented provider. Android displays system notifications in the background or after a
normal app close. In the foreground, the app shows an alert instead. Tapping
either opens the saved result, including an explanation for unsuccessful outcomes.
No child names, preferences, or provider error details are sent in the push payload.

## Provider boundary and replacement

```text
RecommendationJobProcessor (save outcome)
  → PushNotificationPort
    → RecommendationNotificationService (message, devices, failure isolation)
      → PushDeliveryPort.send(device, notification)
        → FcmPushNotificationAdapter
        → another provider adapter (future)
```

The recommendation processor has no provider-specific imports or configuration.
Delivery adapters handle only authentication, API payload mapping, and provider
error translation. The common service owns wording, routing data, recipient
selection and expired-token cleanup.

To replace the provider:

1. Implement `PushDeliveryPort` with a unique `provider` ID and `send` method.
   Return `sent` or `invalid_token`; throw for other failures.
2. Register its factory in `server/src/modules/notifications/push-delivery.factory.ts`
   and set `BABYROO_PUSH_PROVIDER` to its ID. The default is `fcm`; unsupported
   IDs fail at startup instead of silently falling back to Firebase.
3. Implement the mobile `PushClient` adapter for the provider's SDK and normalize
   received messages to `PushMessage`. Select it in `pushClient.android.ts` (and
   later `pushClient.ios.ts`), including its background handler. Firebase-specific
   code currently lives in `fcmPushClient.android.ts`.
4. Update native SDK dependencies/configuration and release the app if needed.
   The shared notification hook, alerts, navigation and recommendation code do
   not need provider-specific changes.

Registrations include the provider ID; the selected adapter receives only matching
tokens. Token uniqueness and invalid-token removal are scoped to that provider.
The additional migration labels existing registrations as `fcm`; older app builds
that omit `provider` still register as FCM. When replacing a provider, old clients
will not receive pushes through the new adapter until updated and registered.
Simultaneous delivery through multiple providers is not implemented.

A replacement adapter is exercised in server and mobile tests. No second external
provider has been selected or integrated yet.

## Android and server setup

1. Create or select a Firebase project. Register Android package `com.babyroo`.
2. Download its `google-services.json` to `app/android/app/google-services.json`
   (ignored by Git). The Gradle plugin is applied when this file exists. Without
   this configuration the app still runs, but push is disabled.
3. Enable the Firebase Cloud Messaging API (HTTP v1). Give the sending service
   account the Firebase Cloud Messaging API Admin role in that project.
4. Set these variables on the API server (e.g. Vercel environment settings):
   - `BABYROO_PUSH_PROVIDER=fcm`
   - `FIREBASE_PROJECT_ID`
   - `FIREBASE_CLIENT_EMAIL`
   - `FIREBASE_PRIVATE_KEY` (actual newlines or escaped `\n` are supported)
   Alternatively, use Google Application Default Credentials with the project ID.
   Never bundle a service-account key in the app or commit it.
5. Run `npm run db:deploy` in `server` to add the push-device table, then deploy
   the server. Rebuild/install Android with `npm run android` in `app`.
6. Sign in and grant the notification permission on Android 13+. Token registration
   runs after sign-in, on token refresh, and on app resume. Logout removes this
   installation's registration and revokes the FCM token. Other devices stay registered.

Delivery requires a configured project, a registered device and working network.
OS permission/channel settings can suppress system notifications. Android
force-stop also prevents delivery until the app is reopened. Denying system
notification permission does not disable foreground message handling.

Delivery is currently best-effort: failures are logged and expired tokens are
removed. There is no durable outbox or background retry worker; a process exit
between saving and sending, or a provider outage, can lose a notification. The
saved result remains accessible in the app. The existing recommendation job
dispatcher itself also runs in-process / Vercel `waitUntil`.

## iOS extension

The server registration API and FCM sender already accept `platform: "ios"`.
The client lifecycle depends on `PushClient`, not Android APIs. To enable iOS:

1. Register the iOS app in the same Firebase project and configure Firebase in the
   native project. Add the APNs authentication key in Firebase and the required
   Push Notifications / Background Modes capabilities.
2. Remove the iOS exclusions in `app/react-native.config.js` and install native
   dependencies following the React Native Firebase instructions.
3. Add `app/src/notifications/pushClient.ios.ts` implementing `PushClient`, including
   iOS permission handling, registration and background handling. Ensure foreground
   system presentation is disabled so the shared in-app alert is the only alert.

## Verification

- `cd server && npm test`: saved-before-send ordering for success, no results,
  failures and timeouts; push/save failure isolation; repeat-job skipping;
  device ownership and token rotation.
- `cd app && npm test -- --runInBand`: client tests, including notification lifecycle.
- `cd app && npx tsc --noEmit`: TypeScript checks.
- On a configured Android device: request recommendations while foregrounded,
  backgrounded, and normally closed. Check each outcome and tap through to its
  saved result. Also check permission denial, token rotation, logout and two accounts.

References: [React Native Firebase setup](https://rnfirebase.io/),
[message lifecycle](https://rnfirebase.io/messaging/usage),
[FCM HTTP v1](https://firebase.google.com/docs/cloud-messaging/send/v1-api),
[Android setup](https://firebase.google.com/docs/cloud-messaging/android/get-started),
[iOS setup](https://rnfirebase.io/messaging/usage/ios-setup).

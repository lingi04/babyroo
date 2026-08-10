# Babyroo Server

NestJS backend for the Babyroo MVP.

The current server exposes the first backend surface for:

- Google login placeholder
- user profile
- children
- published events
- saved events
- recommendation credits
- recommendation sessions

Events are read from the existing `../public/events.json` file. User, saved event, credit, and recommendation data are currently stored in memory, so they reset when the server restarts.

## Architecture

The server follows Hexagonal Architecture / Ports and Adapters.

Each feature module is organized like this:

```text
module-name/
  domain/
    *.entity.ts
    domain services / policies

  application/
    ports/
      in/
        *.use-case.ts
      out/
        *.port.ts
    services/
      use case implementations

  adapters/
    in/
      HTTP controllers
    out/
      persistence / external service adapters

  module-name.module.ts
```

Dependency direction:

```text
Inbound adapter
  -> inbound port
    -> application service
      -> outbound port
        -> outbound adapter
```

NestJS controllers, modules, guards, and filters stay at the outside edge. Domain and application code should not depend on NestJS.

## Requirements

- Node.js
- npm

## Install

From the repository root:

```sh
cd server
npm install
```

## Run In Development

```sh
cd server
npm run start:dev
```

Default API URL:

```text
http://127.0.0.1:3000/api
```

Use a different port if needed:

```sh
PORT=3100 npm run start:dev
```

## Build And Run

```sh
cd server
npm run build
npm run start
```

## Checks

```sh
npm run typecheck
npm run build
```

## Environment Variables

Optional:

```text
PORT=3000
HOST=127.0.0.1
EVENT_DATA_PATH=../public/events.json
DEFAULT_RECOMMENDATION_CREDITS=3
```

`EVENT_DATA_PATH` is useful if the server is started from a different working directory or if you want to test another event JSON file.

## Quick Smoke Test

Start the server first:

```sh
PORT=3100 npm run start:dev
```

List events:

```sh
curl 'http://127.0.0.1:3100/api/events?limit=2'
```

Log in with the temporary development Google endpoint:

```sh
curl -X POST 'http://127.0.0.1:3100/api/auth/google' \
  -H 'Content-Type: application/json' \
  -d '{"idToken":"local-test-token","displayName":"Test Dad"}'
```

The response includes an `accessToken` like:

```text
dev.google_bG9jYWwtdGVzdC10b2tlbg
```

Use that token for authenticated requests:

```sh
TOKEN='dev.google_bG9jYWwtdGVzdC10b2tlbg'
```

Create a child:

```sh
curl -X POST 'http://127.0.0.1:3100/api/users/me/children' \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"nickname":"Roo","birthDate":"2024-08-05","gender":"unknown"}'
```

Check credit balance:

```sh
curl 'http://127.0.0.1:3100/api/credits/balance' \
  -H "Authorization: Bearer $TOKEN"
```

Save an event:

```sh
curl -X POST 'http://127.0.0.1:3100/api/saved-events/nfm-kids-1ba6be3101a8' \
  -H "Authorization: Bearer $TOKEN"
```

Create a recommendation session:

```sh
curl -X POST 'http://127.0.0.1:3100/api/recommendation-sessions' \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{
    "preferences": {
      "startRegion": "seoul",
      "price": "free",
      "place": "indoor",
      "reservation": "reservation_ok",
      "activity": "experience"
    },
    "answers": {
      "startRegion": "region_seoul"
    }
  }'
```

List recommendation sessions:

```sh
curl 'http://127.0.0.1:3100/api/recommendation-sessions' \
  -H "Authorization: Bearer $TOKEN"
```

## API Summary

Public:

- `POST /api/auth/google`
- `GET /api/events`
- `GET /api/events/:id`

Authenticated:

- `GET /api/users/me`
- `PATCH /api/users/me`
- `DELETE /api/users/me`
- `POST /api/users/me/children`
- `PATCH /api/users/me/children/:childId`
- `DELETE /api/users/me/children/:childId`
- `GET /api/saved-events`
- `POST /api/saved-events/:eventId`
- `DELETE /api/saved-events/:eventId`
- `GET /api/credits/balance`
- `GET /api/credits/ledger`
- `POST /api/recommendation-sessions`
- `GET /api/recommendation-sessions`
- `GET /api/recommendation-sessions/:sessionId`

## Current Limitations

- Google auth is a development placeholder. Real Google token verification still needs to be added.
- Persistence is in memory except event data.
- Prisma/PostgreSQL has not been connected yet.
- Recommendation ranking is rule-based, not LLM-backed.
- `npm audit` reports NestJS transitive dependency warnings that need a separate dependency upgrade pass.

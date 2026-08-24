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

Events, users, children, recommendation sessions, and recommendation credits are stored in Neon Postgres when `DATABASE_URL` is set. Events can be imported from `data/events.json` under this server directory. Without `DATABASE_URL`, events fall back to the JSON file and users, children, recommendation sessions, and credits fall back to memory for local smoke testing. Saved event data still uses in-memory repositories for now.

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
EVENT_DATA_PATH=data/events.json
DEFAULT_RECOMMENDATION_CREDITS=3
BABYROO_DEBUG_LOGS=true
BABYROO_RECOMMENDATION_ENGINE=rule-based
OPENAI_API_KEY=replace-me-openai-api-key
OPENAI_RECOMMENDATION_MODEL=gpt-5-mini
OPENAI_RECOMMENDATION_MAX_CANDIDATES=20
OPENAI_RECOMMENDATION_TIMEOUT_MS=120000
DATABASE_URL=postgresql://...
```

`EVENT_DATA_PATH` is useful if the server is started from a different working directory or if you want to test another event JSON file.

`DATABASE_URL` is optional for local smoke testing. If it is not set, the server uses in-memory user and recommendation-session storage plus JSON-backed events. Set it to a Neon Postgres development branch URL to persist users, children, events, and recommendation sessions locally.

Vercel Storage may prefix Neon variables with the connected project/store name. The server accepts these database URL names:

```text
DATABASE_URL
babyroo_DATABASE_URL
POSTGRES_PRISMA_URL
babyroo_POSTGRES_PRISMA_URL
POSTGRES_URL
babyroo_POSTGRES_URL
```

The server loads env files in this order, with earlier files taking priority:

```text
.env.development.local
.env.local
.env
```

Debug logs are enabled by default. Disable them with:

```sh
BABYROO_DEBUG_LOGS=false npm run start:dev
```

Recommendation ranking uses the rule-based engine by default. To try the OpenAI-backed adapter:

```sh
HOST=0.0.0.0 \
PORT=3000 \
BABYROO_RECOMMENDATION_ENGINE=openai \
OPENAI_API_KEY=replace-me-openai-api-key \
OPENAI_RECOMMENDATION_TIMEOUT_MS=120000 \
npm run start:dev
```

Replace `OPENAI_API_KEY` with a real key before expecting successful LLM responses. `OPENAI_RECOMMENDATION_MODEL` defaults to `gpt-5-mini`.

## Recommendation Credits

Credits are modeled as a persisted account plus ledger:

- `credit_accounts` stores the current available recommendation-credit balance per user.
- `credit_ledger_entries` records grants and debits.
- `DEFAULT_RECOMMENDATION_CREDITS` controls the first balance created for a user. It defaults to `3`.

Recommendation flow:

1. The app requests `POST /recommendation-sessions`.
2. The server checks that the user has at least 1 credit.
3. If credit is available, the server creates a `running` recommendation session and dispatches the recommendation job.
4. If the recommendation completes successfully with at least one result, the server deducts 1 credit and records a ledger debit with reason `recommendation_session`.
5. Failed, timed-out, or empty-result recommendations do not deduct credit.

Credit APIs:

```text
GET /api/credits/status
GET /api/credits/balance
GET /api/credits/ledger
POST /api/credits/purchases
```

`GET /api/credits/status` returns the balance, recent ledger entries, and available packages for the app's credit status screen.

`POST /api/credits/purchases` currently creates a test/manual credit grant with reason `manual_credit_purchase`. It is intentionally not a real payment integration yet. A future payment provider should only grant credits from a verified payment webhook or app-store receipt validation path.

If a user has no credits, `POST /api/recommendation-sessions` returns:

```json
{
  "statusCode": 402,
  "code": "INSUFFICIENT_CREDITS",
  "message": "Not enough recommendation credits"
}
```

## Database

The persistent DB slice stores events, users, children, recommendation sessions, and credits in Neon Postgres through Prisma. Other data, such as saved events, still uses in-memory repositories for now.

For local development, create a Neon development branch and pull the Vercel-managed environment variables into the server directory:

```sh
cd server
npx vercel link
npx vercel env pull .env.development.local
```

If you are not using Vercel envs locally, put `DATABASE_URL` in `server/.env.local` instead.

Generate Prisma Client:

```sh
npm run db:generate
```

Apply schema changes to the Neon development branch:

```sh
npm run db:migrate
```

Apply committed migrations in deployment or production-like environments:

```sh
npm run db:deploy
```

Inspect data:

```sh
npm run db:studio
```

Import the current JSON event catalog into Postgres:

```sh
npm run db:seed:events
```

The event import reads `server/data/events.json` and upserts rows by event `id`.

`npm run typecheck` and `npm run build` run `prisma generate` automatically.

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

Check credit status:

```sh
curl 'http://127.0.0.1:3100/api/credits/status' \
  -H "Authorization: Bearer $TOKEN"
```

Create a test/manual credit purchase:

```sh
curl -X POST 'http://127.0.0.1:3100/api/credits/purchases' \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"packageId":"starter_5"}'
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
- `GET /api/credits/status`
- `GET /api/credits/balance`
- `GET /api/credits/ledger`
- `POST /api/credits/purchases`
- `POST /api/recommendation-sessions`
- `GET /api/recommendation-sessions`
- `GET /api/recommendation-sessions/:sessionId`

## Current Limitations

- Google auth is a development placeholder. Real Google token verification still needs to be added.
- Saved events still use in-memory persistence.
- Credit purchases are currently manual/test grants. Real payment verification still needs a provider-specific webhook or receipt-validation integration.
- Recommendation ranking is rule-based by default. OpenAI-backed ranking is available behind `BABYROO_RECOMMENDATION_ENGINE=openai`.
- `npm audit` reports NestJS transitive dependency warnings that need a separate dependency upgrade pass.

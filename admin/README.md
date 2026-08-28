# Babyroo Admin

Authenticated event-management web app for Babyroo operators.

The admin app is a Vite + React + TypeScript frontend. It talks to the Babyroo API and requires Google social login with an active `AdminUser` row in the database.

## Features

- Google admin login
- Draft-first event table
- Event create and edit pages
- Publish, hide, and archive actions
- Field-level validation display
- Image URL editing
- Event image upload

## Local Use

Install dependencies:

```text
npm install
```

Create a local env file:

```text
VITE_BABYROO_API_BASE_URL=http://localhost:3000/api
VITE_GOOGLE_CLIENT_ID=your-google-web-client-id.apps.googleusercontent.com
```

Run the admin app:

```text
npm run dev
```

Open:

```text
http://localhost:5173
```

The API server should be running at:

```text
http://localhost:3000/api
```

Google OAuth / Google Identity Services must allow `http://localhost:5173` as a JavaScript origin.

## Backend Requirements

The API must have:

```text
AUTH_JWT_SECRET=...
GOOGLE_WEB_CLIENT_ID=your-google-web-client-id.apps.googleusercontent.com
BLOB_READ_WRITE_TOKEN=...
```

An admin user must be inserted manually before login. The first insert can use email only; the server fills `google_sub` on first successful Google login.

Example shape:

```sql
INSERT INTO admin_users (id, email, active, created_at, updated_at)
VALUES ('admin_your_name', 'you@example.com', true, now(), now());
```

## Build

```text
npm run build
```

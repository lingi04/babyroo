# Babyroo Admin

Static review/admin page for Instagram hashtag discovery and managed event review.

Target review URL:

```text
https://babyroo.vercel.app/
```

## Features

### Instagram Event Discovery

- Connect Instagram / Facebook button
- Connected Instagram Business or Creator account display
- Hashtag input
- Search button
- Instagram Graph API result list
- Save as event candidate button
- Candidate JSON download

### Managed Events

- Reads the CSV embedded in `admin/index.html`
- Shows the normalized event list managed by Babyroo
- Supports search by title, venue, address, region, source, and tags
- Filters by category and reservation status
- Links back to each source URL

## Local use

Open `admin/index.html` directly in a browser, or serve the repository root with any static server and open `/admin/`.

For example:

```text
python3 -m http.server 8000
```

Then open:

```text
http://localhost:8000/admin/
```

The Managed Events page embeds its CSV payload directly in `admin/index.html`, so it can run from a direct browser file open without a static server.

The page never stores an app secret. It only uses a browser-side Graph API access token during review/testing. For production, token exchange and long-lived token handling should move to a backend.

## Meta setup notes

The connected Facebook account must have access to a Facebook Page linked to an Instagram Business or Creator account. Hashtag search also requires the appropriate Instagram Graph API permissions and App Review before production use.

# Babyroo Admin

Static review/admin page for Instagram hashtag discovery and managed event review.

Design guidance lives in [`../docs/design_system.md`](../docs/design_system.md). The admin stylesheet mirrors those tokens so new UI should reuse the same color, radius, shadow, card, tag, and status patterns.

Recent UI direction: the admin should feel closer to Product Hunt's launch lists than a plain table. The primary pattern is a scannable ranked list with thumbnails, concise titles, metadata pills, tags, facts, and one clear action.

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
- Displays events by added order, newest first
- Supports search by title, venue, address, region, source, and tags
- Filters by category and reservation status
- Links back to each source URL

## Display Order

The embedded CSV is treated as append-only review data:

- Top CSV records are older.
- Bottom CSV records are newer.
- The Managed Events screen renders newer records first.
- Card sequence badges preserve the original CSV row order, so five records render as `5, 4, 3, 2, 1`.

This is intentional. If a new event is appended to the bottom of the CSV, it should appear at the top of the Managed Events list after reload.

## Visual Notes

The current UI applies the Product Hunt-inspired design system directly in `admin/styles.css`:

- Warm page band and stronger top navigation
- Panel-based workflow sections
- Ranked card rows for search results and managed events
- Thumbnail-first cards with title, summary, tags, key facts, and source action
- Pill treatments for media type, category, source, and status metadata
- Hover/focus states for clickable rows and controls

Changes made locally will not appear at `https://babyroo.vercel.app/` until the site is deployed. For local review, open `admin/index.html` directly or run the static server command below.

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

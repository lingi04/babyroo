# Babyroo Admin

Static review/admin page for Instagram hashtag discovery.

Target review URL:

```text
https://babyroo.vercel.app/
```

## Features

- Connect Instagram / Facebook button
- Connected Instagram Business or Creator account display
- Hashtag input
- Search button
- Instagram Graph API result list
- Save as event candidate button
- Candidate JSON download

## Local use

Open `admin/index.html` in a browser, or serve the directory with any static server.

The page never stores an app secret. It only uses a browser-side Graph API access token during review/testing. For production, token exchange and long-lived token handling should move to a backend.

## Meta setup notes

The connected Facebook account must have access to a Facebook Page linked to an Instagram Business or Creator account. Hashtag search also requires the appropriate Instagram Graph API permissions and App Review before production use.

# Detail UI redesign — stage 1

Status: Implementation authorized and completed locally. Functional checks passed with unchanged baseline suite failures. Native visual verification remains pending due to environment restrictions.

## Model usage

| Workflow stage | Model used | Reasoning level | Evidence |
| --- | --- | --- | --- |
| Plan | Unknown | Unknown | Active model name and reasoning settings are not exposed by confirmed runtime metadata. |
| Review the plan | Unknown | Unknown | Inspected mobile event/API types, detail rendering, server domain/Prisma mapping and local fixture. |
| Implement | Unknown | Unknown | User explicitly requested starting stage 1; active model/reasoning metadata remains unavailable. |
| Verify | Unknown | Unknown | TypeScript, full app ESLint, targeted component tests, full-suite comparison against HEAD, and icon inspection; active settings unavailable. |

## Requirements and assumptions

- Deliver the detail-page visual redesign first; crowding is a separate second stage.
- Use the reviewed visual direction: distinct back header, contained hero image, clear event identity, compact practical fact cards, description and bottom reservation/source action.
- Stage 1 uses the existing API and mobile data structure. It needs no database migration or new public API fields.
- User confirmed the data rule: populate only values available from the current API. Leave unavailable values empty; do not add sample values, infer missing facts, or extend the API to fill the mockup. For retained fact slots, keep the label and leave the value blank rather than inventing content. Unsupported optional sections stay unpopulated. Existing intentional status labels for explicit API values such as `unknown` remain distinct from missing data.
- Preserve full titles/venue names, real image URLs, image fallback, existing age/date/price/reservation formatting, optional detailed location and tags. Do not replace existing information with shortened or invented mockup values.
- User approved starting stage 1 after confirming current API fields only and blank missing values. General design approval and this explicit implementation authorization supersede the earlier pending implementation gate.

## Field audit

| Mockup content | Existing data | Stage-1 treatment |
| --- | --- | --- |
| Hero image | `imageUrl` optional | Use real image; preserve fallback for missing/failed images. |
| Category | `category`, existing category formatter | Reuse existing display mapping. |
| Title | `title` | Display full actual title with wrapping. |
| Region and locality | `region`, `locality` | Reuse existing location metadata. |
| Event date range | `startsAt`, `endsAt` | These are dates, not operating hours. Preserve missing-date behavior. |
| Age | `ageMinMonths`, `ageMaxMonths` | Reuse existing age formatter and unknown state. |
| Price | `priceText`, `priceType` | Preserve real descriptions and unknown state; never assume free. |
| Reservation | `reservationRequired`, `reservationStatus` | Reuse existing reservation formatter. |
| Venue and detailed location | `venueName`, `venueDetail` optional | Preserve both; allow long values to wrap. |
| Description | `summary` | Show actual summary; no generated replacement copy. |
| Guardian accompaniment | `guardianRequired` optional, already in mobile/API/server contract | Can display without schema/API changes; true/false/unknown must remain distinct. Recommend a row only when explicitly true, labeled as a requirement. |
| Operating time e.g. 10:00–17:00 | No structured field in Prisma/domain/mobile/API | Leave unpopulated. If the reviewed layout retains this slot, its value is blank. Do not infer from event dates or parse arbitrary summary text into a claimed schedule. |
| Tags | `tags` | Preserve existing tags although absent from some generated mockups. |
| Reservation/source action | `sourceUrl` | Preserve link behavior and failure alert. |
| Full street address | Exists in Prisma/admin and local JSON, absent from public server mapping/mobile API contract | Omit as a separate field to keep the API contract unchanged. `venueDetail` is not a substitute address. |
| Stroller accessibility, nursing room, parking | Nullable Prisma/admin fields, absent from public/mobile contract | Omit in stage 1. Existing DB fields alone do not make them available to this screen. |
| Crowding, area/time/history/access prices | Not present in event contract | Entirely deferred to stage 2; no dummy card, teaser or unlock control. |

Evidence: `app/src/data/events.ts`, `app/src/api/babyrooApi.ts`, `app/App.tsx` (`EventDetail`), `server/src/modules/events/domain/event.entity.ts`, `server/src/modules/events/adapters/out/prisma-event.repository.ts`, `server/prisma/schema.prisma`, `server/data/events.json`. The local fixture is not proof of production completeness.

## Proposed implementation steps

1. Produce matching current/proposed previews using an existing real record with crowding removed and unsupported operating hours omitted. Also preview missing image, long venue/title, unknown age/price and an explicit guardian requirement.
2. Review the revised stage-1 scope and images with the user; obtain explicit implementation approval.
3. Restructure only detail layout and local styles/components, reusing existing theme and formatters. Add familiar consistent fact icons with labels where appropriate. Avoid changing shared styles used by other screens unintentionally.
4. Preserve back/hardware-back behavior, scrolling, source action and safe-area padding. Render optional guardian requirement only from explicit true data. Per the user's blank-value instruction, retain the operating-time label with no value; do not invent opening hours.
5. Run relevant app checks and inspect rendered screen states; update this plan with results before delivery.

## Acceptance and verification

- No changes to Prisma schema, server/API contracts, data imports, credits or crowding behavior.
- Every displayed fact comes from existing event fields; no hardcoded example venue, time, date, age, price or guardian requirement.
- Missing API values remain empty in retained slots. Do not use generated mockup values or introduce data/API changes to fill them.
- Information currently displayed, including detailed location and tags, remains accessible.
- Balanced hero/facts/body hierarchy, coherent icon stroke/size, readable contrast and 48-unit interactive targets. Long values wrap without clipping, including narrow screens and enlarged text.
- Check real-image and fallback states, sparse metadata and optional guardian requirement. Operating time stays blank; no placeholder crowding gap.
- Relevant detail/source-link/back navigation tests; app TypeScript and lint. Broaden checks only for meaningful shared-component changes/failures.
- Current/proposed comparison before implementation; actual rendered visual review after implementation. ImageGen concepts alone do not verify the running UI.

## Implementation and verification results

- Detail-only changes in `app/App.tsx`: distinct 48-unit back/header action, rounded contained hero without dark scrim, image-error fallback, warm compact 2×2 fact cards, matching outline icons, untruncated text, description, usage rows, preserved tags and detailed location, and a local rectangular source/reservation button. Narrow screens below 350 units and font scaling of at least 1.4 use single-column facts.
- No API, database, event-data, credit or crowding changes. Missing age/reservation values stay blank; explicit unknown price retains the existing confirmation label. Guardian requirement is shown only when true. Operating hours remain blank.
- Added editable SVG fact/back artwork plus native PNG assets at 1×/2×/3×; inspected recognizability, consistent stroke and optical size together. No new dependencies.
- Four focused tests pass: missing data has no invented facts; explicit guardian/long venue rendering; image failure fallback; back/source action and source failure alert.
- Full suite: 69 passing, 12 failing. Compared with unchanged HEAD: 65 passing, the exact same 12 failing test names, zero new failures. Existing App tests include stale screen labels and references to the empty local event array. Existing open handles require Jest force exit; unrelated test-suite repair is out of scope.
- Full app TypeScript and ESLint passed. Git whitespace check passed. Formatting changes outside the detail scope were removed.
- [Source-based HTML preview](previews/app-detail-ui-redesign.html) uses existing local fixture records, including a missing image, long venue name and sparse age/reservation values, at 390px, 320px and enlarged-text 390px. Regenerate using `node docs/plans/previews/render-detail-ui-preview.cjs`. It is a browser reconstruction, not a native screenshot; font/layout may differ, and it has not been visually inspected in a browser here.
- Running native visual review and Android build remain unverified. ADB cannot start its local socket in this environment, including after using a workspace log directory. Apple command-line tools are missing. Browser preview startup also failed earlier; system Korean fonts are inaccessible to the local raster renderer. Do not treat these limitations as visual approval.
- Remaining visual checks on a simulator/device: hero real-image crop/failure, long titles/venues, scroll access to tags/CTA, narrow/enlarged text, safe areas, actual icon size, and final spacing. Stage 2 remains unimplemented.

## Follow-up: reported image, safe-area and icon defects

- Authorized by the user's request to fix the three defects within stage 1. Existing Model usage entries still apply; no new confirmed model/reasoning settings are available.
- Image diagnosis: the remote hero used absolute offsets without explicit dimensions. It now has explicit 100% width/height, fills a stretched rounded frame and keeps centered `cover` scaling. Removed unnecessary frame padding, including for the category fallback.
- Safe-area diagnosis: the absolute detail overlay starts at its parent's origin rather than consuming the parent's safe-area padding. Pass the existing measured `topInset` into `EventDetail` and pad the overlay itself, keeping the header/scroll content below the status bar.
- Redrew the baby-face, stacked-coins, calendar-check and location-pin SVGs to more closely follow the approved sample; regenerated all native densities. Reviewed [corrected icon sheet](previews/app-detail-icons-corrected.png) at 24px and 3× for recognition, consistent stroke and optical balance. These are hand-drawn vector equivalents, not pixel-identical extractions from the generated concept image.
- Added a regression check for a nonzero top inset and explicit full-frame image dimensions/cover mode. Five focused detail tests pass; TypeScript, changed-file ESLint and Git whitespace checks pass. Full suite was not repeated because its unchanged baseline failures were already established and no shared flow changed.
- Native visual verification is still pending. Do not describe the image alignment or status-bar position as device-verified until inspected in a running app.

## Follow-up: measured hero and sample icon sizing

- User requested another hero-alignment adjustment, larger fact icons matching the sample, and clock/people icons before usage labels. These are authorized corrections within stage 1.
- Replaced the percentage/absolute hero approach with an explicitly centered frame and normal-flow image sharing numeric dimensions. Width comes from the measured detail overlay minus equal 20-unit side margins, and height follows the existing 2.3 aspect ratio. This responds to actual container width changes rather than relying on intrinsic image dimensions or screen width alone. Centered `cover` cropping remains in use.
- Fact icons now render at 28 units; usage clock/people icons at 22 units. Both sets have matching stroke/color and 1×/2×/3× native assets. Usage icons are decorative and accompany visible labels; guardian information remains conditional on an explicit requirement, and missing operating hours stay blank.
- Updated the HTML reconstruction and inspected the six-icon sheet at actual and enlarged sizes. Running-app inspection is still pending for the same environment limitations.
- Six focused tests pass, including measured-width hero sizing and decorative usage icons. TypeScript, changed-file ESLint (no warnings), and whitespace checks pass. No API/data/credit changes.

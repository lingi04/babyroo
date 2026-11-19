# Current surrounding-area crowding — stage 2

Status: Reduced scope explicitly authorized and implemented locally; committed as f059368, with review fixes in 9643883. Current crowding is free after login; history UI/payment remain deferred. The user subsequently authorized [raw observation archival](server-crowding-observation-history.md), superseding latest-only storage. Production rollout, live-source/database integration and rendered device/admin visual verification remain pending.

## Model usage

| Workflow stage | Model used | Reasoning level | Evidence |
| --- | --- | --- | --- |
| Plan | Unknown | Unknown | Runtime does not expose confirmed model/reasoning settings. |
| Review the plan | Unknown | Unknown | Rechecked reduced scope against public event controllers/domain, user/admin guards, current mobile detail and preserved history specification. No confirmed runtime settings available. |
| Implement | Unknown | Unknown | Explicit user authorization; implemented server, admin, mobile and migration. Active runtime model/settings not confirmed. |
| Verify | Unknown | Unknown | Server build/tests, three-project TypeScript, mobile lint/tests and baseline comparison; live/database/visual gaps recorded below. Active settings not confirmed. |
| Implement — review fixes | Unknown | Unknown | User authorized committing the implementation and fixing all three review findings. Runtime settings remain unconfirmed. |
| Verify — review fixes | Unknown | Unknown | Server build/full suite, server/admin TypeScript and admin static rendering checks; isolated PostgreSQL and browser visual checks remain pending. |

## Review fixes — 2026-11-19

Authorized scope: fix the three implementation-review findings after committing the existing feature on `feature/crowding` (`f059368`). No product-scope changes.

- Interactive refresh must obey an area's failure retry deadline, while successful refreshes retain the shared 60-second cooldown. Enforce this atomically in lease claiming; add an isolated PostgreSQL regression covering refusal before the deadline and acquisition at the deadline.
- Report successful, failed and skipped collection outcomes separately. Provider/database failures must not count as completed. The scheduler command exits nonzero if any collection fails, including partial failures; other areas still complete independently.
- Allow admin disconnection by event ID without requiring active-area selection or verification. Keep the confirmation and disable the action for an empty event ID or while busy. The existing verification/save flow remains intact.
- Verification: server build and server/admin TypeScript pass; full server suite: 32 passed, zero failed, one isolated PostgreSQL test skipped. Static React rendering confirms disconnection is present without verification/active-area selection and disabled for an empty ID. This is a markup check, not browser visual approval. Existing browser/runtime restrictions and the absence of an isolated PostgreSQL URL leave those checks pending.

## Confirmed current scope

- Keep stage 1's existing detail layout and current event data contract except for additive crowding support metadata.
- Show one compact surrounding-area crowding card for places manually verified to lie inside an official covered area.
- User explicitly selected **current crowding for free**, replacing yesterday's preview as the remaining card content.
- Card copy: replace 어제 이 시간 with 현재 혼잡도. Show the latest source observation time (for example, 14:30 기준), not yesterday's same-hour reading or the phone's current time presented as a measurement. If only an old reading exists during an outage, identify it as the last observation with its actual date/time.
- Preserve the previously agreed login requirement. Signed-in users view current crowding directly, without credits, a 0-credit unlock, or a 24-hour entitlement. Guests get a login entry rather than crowding readings.
- Display area name, full crowding label, actual source observation time, area-versus-venue distinction and source attribution/link. Do not pretend a fresh fetch is a fresh observation.
- If the source marks REPLACE_YN=Y, label it 참고 혼잡도 and disclose that it is a recent four-week same-weekday/time average. This is source-quality disclosure, not the deferred historical-reference feature.
- Refresh on entering/reopening detail and allow retry on failure, coalescing provider requests to respect quotas. Retain a clearly dated last observation during outages; no valid reading means unavailable.
- Add a verified-area teaser in Explore that opens detail; this teaser does not exist yet. Unsupported/unverified places have no teaser or crowding card.
- Keep 30-minute collection default, per-area configurable intervals and selected/all bulk changes in the existing admin app, together with manual mapping and collection health.
- Weather, air quality and parking remain outside this release.

## Removed from this release

- The circled credit/24-hour button and its current/history sales subtitle.
- Seven-day history, 기록 보기 action and dedicated history screen.
- Eight-row comparison, manual historical hour selection and last-week next-hour reference.
- Yesterday-only free-preview branch, paid history restrictions and history completeness/discount calculations.
- Payment switch, unlock prices, quotes, entitlements and crowding credit deductions.
- Tenfold credit-system migration and recommendation/purchase changes. Existing recommendation credits remain as they are.

The current card has no empty space reserved for those deferred controls.

## Preservation of previous work

The **entire previous reviewed plan** is preserved in [deferred history and paid-access specification](app-area-crowding-history-deferred.md), with a scope banner. Do not delete its agreed behavior, arithmetic corrections, source evidence, edge cases or unresolved proposals. It is future design input, not current implementation authorization.

The glossary retains historical-reference/target/unlock terms as future feature terminology. Earlier mockups with history/payment controls remain design references for that deferred feature, not the current UI.

## Review findings and implementation rules

### Data and API boundaries

- Existing public event routes remain public. Their optional/additive support metadata may identify availability and verified area, but MUST NOT contain crowding levels, source observation times or other condition readings. Do not add a login requirement to ordinary event browsing.
- Proposed current-condition route: GET /api/events/:id/crowding, protected by the existing user AuthGuard. Resolve the currently published event and verified assignment server-side; do not trust an area ID supplied by the client. Hidden/deleted/unverified events must not expose condition readings through direct requests.
- Response identifies event/area and mapping revision, serverNow, level, source observedAt, last successful fetch, refresh status and attribution. An absent observation has a null level and unavailable state, never an invented low-crowding value. Keep unsupported mapping distinct from a temporarily unavailable provider.
- Current observations are latest known estimates, not guaranteed live measurements. If observedAt precedes the current Korea hour, show 마지막 관측 and the actual date/time rather than implying a new current-hour measurement. Same-hour readings also show actual observedAt. This is presentation, not a freshness cutoff that hides valid data.
- Never infer crowding from the venue's category, weather, price, tags or proximity. Use only the mapped official source level.

### Minimum persistence and collection

- Persist a versioned source-area catalog/boundary reference; verified event assignments with verifier/evidence/location fingerprint; one latest valid observation per area; and collection state with interval, due time, lease, last attempt/success and last error.
- Preserve shared area identity across multiple mapped venues. Location changes in admin or imports and boundary revisions invalidate verification; unchanged reimports must not erase valid assignments. A disabled/removed source area cannot silently map to another area.
- Latest-observation writes must be ordered by source observedAt: a slower old response cannot overwrite a newer observation. Repeated timestamps update fetch health without inventing a new measurement. Treat same-timestamp corrections explicitly; reject malformed dates, impossible future readings and unknown level values.
- Raw observations now accumulate under the separately authorized observation-storage plan, preserving current observations for future history work. No nine-day expiry, hourly buckets, coverage counters or retention job is introduced. Current reads select the latest observation for the current boundary version. Historical values discarded before this change are not backfilled.
- Scheduler/admin changes remain per-area with selected/all bulk edits. Define positive interval validation against actual deployed cadence and quotas, validate all bulk targets before changing any, audit changes and avoid an immediate simultaneous request burst.
- Use durable leases, bounded batches/concurrency/timeouts and retry backoff, isolating provider failure per area. Source credentials and scheduler secrets stay server-side; admin mutations use AdminAuthGuard. Redact keys and key-bearing URLs in logs.
- Implementation transport correction: Seoul's [official response](https://data.seoul.go.kr/together/notice/inquireView.do?bbsCd=10003&ditcCd=QNA01&seq=1d2186fcde0d53cbbb2814bec743624a) confirms HTTP-only source access and the replacement-average meaning. Permit HTTP only to openapi.seoul.go.kr:8088, with redirects forbidden and no key-bearing logging. The app/admin/scheduler API uses HTTPS. A verified HTTPS proxy can override the server's source template; unavailable official HTTPS is not a prerequisite.

### Refresh, login and UI behavior

- Entering/reopening detail loads authenticated current data and attempts a bounded provider refresh when the area's shared cooldown permits. Screen reopening is not permission for an unlimited upstream call. Routine batch size, timeout and cooldown values can be selected during implementation from validated quotas/latency.
- Return stored valid data when a refresh times out/fails; expose the actual source time and retry state. With no stored reading, show unavailable and retry. A successful fetch returning the same observation must not advance its observation time.
- Key responses/cache by user, event, verified area and mapping revision. Cancel or ignore old requests after venue changes, remapping, logout or account switching; clear displayed readings on logout. No shared/CDN cache of authenticated condition responses.
- Login returns to the same detail screen and then loads current crowding directly. There is no quote, purchase confirmation, unlock step, credit check or expiration state.
- Preserve all stage-1 detail content and safe areas. The compact card contains one current/last-known level and timestamp, area/scope, attribution and refresh/retry where relevant. No second historical column, history action or blank space for deferred controls.

### Evidence and release dependencies

- Research references: [Seoul OA-21285](https://data.seoul.go.kr/dataList/OA-21285/A/1/datasetView.do), [official manual](https://data.seoul.go.kr/SeoulRtd/downloads/실시간_도시데이터_매뉴얼.pdf), [Seoul terms](https://data.seoul.go.kr/etc/accessTerms.do), and [KOGL Type 1](https://www.kogl.or.kr/info/licenseType1.do). Prior verification recorded 121 areas and KOGL Type 1; revalidate the exact feed, current boundaries, authenticated payload and permitted attribution before production use. Do not assume the separate population feed has the same contract/terms.
- Select a deployment-compatible scheduler, confirm its minimum cadence/request quotas, and prepare initial verified mappings. The repository has no recurring collection job configured. Do not rely on in-process timers in a serverless request.
- Provider credentials and a live scheduler are production rollout requirements, not prerequisites to writing/test-driving isolated adapters with fixtures. Local tests must not modify production data or expose keys.

## Proposed implementation direction

1. Implementation was explicitly authorized by the user. Previous history/payment mockups do not establish rendered verification of the final reduced-scope UI; that visual review remains pending.
2. Validate the feed contract and record architecture/settings decisions. Build verified mappings, latest-observation persistence, provider adapter and collection state using existing ports/adapters conventions. No historical API/query or financial migration.
3. Implement the protected collector with leases, bounded requests, retry/backoff and scheduling integration. Add admin mapping/interval/bulk/health controls.
4. Implement additive public support metadata and authenticated current-condition reads with the boundaries above. Keep provider credentials server-side and avoid per-card upstream requests.
5. Implement the compact current card, login-return/retry states and supported-area Explore teaser, preserving stage-1 layout fixes. No unlock or history navigation.
6. Verify locally and in rendered UI, then prepare source-key/scheduler/mapping setup and deployment runbook. Activate production collection only after rollout prerequisites and authorization are met.

These are scoped planning steps, not permission to deploy or a claim that operational credentials/scheduler are available. Observation archival was subsequently authorized in the linked storage plan; historical presentation and payment remain deferred.

## Acceptance and verification

- Signed-in current-condition access requires no credit balance, payment, unlock or expiry; guest access requires login.
- No crowding/history payment UI, record-history entry, last-week comparison, yesterday preview or tenfold credit changes.
- Current readings always identify the official area and actual observation time; never imply venue occupancy or substitute an invented reading.
- Mapping validation/invalidation covers location changes through admin and imports, as well as revised official boundaries.
- Current-source parsing, deduplication, missing/malformed data, stale/repeated observations and provider failures have meaningful server checks.
- Regression cases include old response arriving after a newer one, repeated timestamps, same-time corrections, failed refresh with/without a snapshot, logout/venue change during a pending request, and unpublished/remapped direct event access.
- Anonymous/public responses never leak condition readings; user/admin token kinds cannot substitute for one another. Server-protected endpoints enforce login rather than relying on the UI.
- Scheduling covers per-area changes, selected/all bulk validation, leases, retry/isolation and quota-safe refreshes. Persistent storage and real scheduling are verified before collection rollout.
- UI review includes supported/unsupported, guest/signed-in, loading/current/stale/unavailable/retry states at narrow widths/enlarged text, with the previously fixed detail safe-area and image alignment preserved.
- Run relevant server tests/typecheck, admin build and mobile TypeScript/lint/tests, comparing known baseline failures. Source attribution and key redaction are verified.
- Implementation authorization has been received. Reduced-scope rendered mobile/admin visual verification is still pending. Scheduler capability, initial verified mappings, provider credentials and a successful live smoke check precede production rollout; these operational items do not block isolated local implementation.

## Review outcome

The current release is current-condition-only, free after login. History, historical references, access entitlements and credit changes are fully isolated in the deferred document. The review corrected the nonexistent-teaser wording, review/implementation ordering, public-versus-authenticated API boundaries, source-time/stale semantics, snapshot races and rollout prerequisites. No new product decision was required by these corrections. Implementation followed the user's authorization; the results and remaining verification gaps are recorded below.

## Implementation result

- Added a current-crowding module with application ports, source adapter, Prisma persistence, user/admin controllers and a dedicated secret-protected collection endpoint. Event responses add only verified-area metadata, never observations.
- Added a migration for area/catalog/collection/snapshot state, verified event mappings and admin audit. Fingerprints invalidate moved/import-changed venues and updated boundary versions automatically at read time. No production migration was applied.
- Collector defaults: 30-minute area interval, five concurrent due areas per invocation, 4-second provider timeout, 4-MiB response cap, 30-second lease, 60-second shared refresh cooldown and failure backoff up to 15 minutes. The initial implementation did not archive observations; archival is now implemented under the separately authorized storage plan. No credit storage was added.
- Admin now supports catalog create/edit, per-area or selected/all interval changes, explicit optional status changes, health, boundary-reference review, evidence-backed event assignment and unmapping. Interval-only bulk edits preserve each area's existing statuses. Event editor links to the mapping page.
- Mobile now shows the supported-area teaser and compact current card, direct authenticated free reads, login return, expired-session reauthentication, last-known/unavailable/retry states, replacement-quality disclosure and source attribution. State identity/request generations prevent logout/account/venue response leakage.
- Added scheduler runner and [operation/runbook](../current_crowding.md). It is ready for an externally configured recurring job; no production scheduler or credentials were installed.

## Verification result and gaps

- Prisma generated successfully; Nest server build and server TypeScript pass.
- Server suite: 30 pass, zero failures, one Postgres integration test skipped because no dedicated BABYROO_CROWDING_TEST_DATABASE_URL was supplied. The isolated test covers concurrent leases, stale completion and atomic bulk rollback when run against a migrated test database.
- Mobile: 14 focused detail/card tests pass; full suite 79 pass and 12 fail. Compared failed names against unchanged HEAD's App suite: exact same 12 failures, no new failures. Mobile TypeScript and full ESLint pass.
- Admin TypeScript passes. Admin bundle build is blocked before source compilation because the bundled Node runtime rejects the existing Rolldown native binding's signing identity; the installed alternative Node runtime is inaccessible. Dependencies/lockfile were not altered to work around the environment.
- [Component HTML preview](previews/app-current-crowding.html) is generated from actual test-renderer output for guest/current/last-known/unavailable/replacement states with illustrative fixtures. It is a DOM reconstruction, not a native screenshot. Regenerate by running the focused card tests with BABYROO_CROWDING_PREVIEW_DIR set, then the preview converter in that directory.
- Native/browser preview runtime failed to start. Neither mobile nor admin rendered visual approval is claimed. Inspect compactness, timestamps, source/refresh touch targets, normal/narrow/large text, detail safe areas and admin bulk/mapping interactions on a running environment.
- Live authenticated Seoul payload compatibility, production migration, actual scheduler cadence and initial manually verified mappings remain rollout tasks. Public sample retrieval was attempted but the web tool could not resolve the endpoint. No secret/live production data was used for fixture tests.
- Whitespace checks pass. Initial stage-2 implementation/review fixes are committed as f059368 and 9643883; the subsequent archival change remains local. Nothing deployed. Deferred history UI/payment specification remains preserved.

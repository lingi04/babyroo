# Deferred: crowding history and paid area access

This file preserves the complete reviewed specification from before the scope reduction. The user deferred seven-day history and its credit-unlock flow; the current release instead shows current crowding for free after login. See [active scope](app-area-crowding.md).

The original document below is retained as future design context, including confirmed decisions, implementation proposals and unresolved review items. It is NOT the current implementation scope or approval to enable payments, scale credits, build history, or show last-week comparisons.

Preserved for future use: eight relative-time targets, latest-at-or-before lookup, hourly completeness and 10/5 pricing, 24-hour per-area access, tenfold credit migration, manual time selection, collection/storage considerations, transaction safeguards, source evidence and visual-review requirements.

2026-11-19 scope update: the user separately authorized accumulating raw observations while current screens still show only the latest reading. See [observation storage plan](server-crowding-observation-history.md). This does not activate the history UI, pricing, hourly completeness or the proposed nine-day retention policy below.

---

# Surrounding-area crowding — stage 2 (preserved specification)

Status: Reviewed draft. Stage 1 UI is committed as f18fdce. Stage 2 implementation is not approved. This document replaces the earlier contradictory forecast/chart/retention proposals.

## Model usage

| Workflow stage | Model used | Reasoning level | Evidence |
| --- | --- | --- | --- |
| Plan | Unknown | Unknown | Active model/reasoning settings are not exposed by confirmed runtime metadata. |
| Review the plan | Unknown | Unknown | Compared conversation with current mobile, admin, Prisma, import, credit and recommendation code; re-read official manual. Settings remain unconfirmed. |
| Implement | Pending | Pending | No stage 2 code written. |
| Verify | Pending | Pending | Document/code review only; no implementation verification. |

## Review findings

| Issue in prior draft | Correction |
| --- | --- |
| Official forecast remained after switching to last week's reference. | Historical observation only; no prediction or forecast integration. |
| Embedded list/chart/grid contradicted compact approved detail design. | Compact detail card, separate history screen via 기록 보기. |
| Claimed reference required almost eight-day-old data. | Arithmetic error: next hour minus seven days is 167 hours ago. Extra retention is a buffer, not a requirement. |
| Rolling 168 hours can touch eight dates; mockup showed seven rows. | User selected eight comparison targets: now and now minus 24 hours × 1 through 7. D1 is resolved. |
| Collection age was confused with complete data. | User confirmed reduced pricing if any of the previous 168 completed Korea-time hours lacks a valid observation; exclude the current unfinished hour. D2 is resolved. |
| Existing credit consume method cannot save an entitlement atomically. | Shared transaction boundary for conditional debit, ledger and entitlement. |
| Debit checks balance then decrements without a conditional balance guard. | Protect shared accounts against concurrent area AND recommendation charges. |
| Minimum-build policy was treated as sufficient for unit migration. | It is UI-only; require server-side compatibility/rejection and drain old workers. |
| Imported venue moves could retain verified mappings. | Invalidate location verification on relevant admin edits and imports. |
| Collector deployment, refresh quotas and cache handling were incomplete. | Add scheduler selection, bounded jobs, shared cooldown and user/expiry-scoped caches. |

## Agreed requirements

- Add surrounding-area crowding to supported existing places/events. Weather, air quality and parking remain future work.
- Administrators verify a venue lies within an official coverage boundary before assigning its area. District names/proximity alone are insufficient. Unsupported/unverified venues have no teaser/card.
- Keep the approved stage-1 layout: crowding is one compact secondary card with area, source time and a clear distinction from venue occupancy. Explore teaser opens detail.
- After unlock, show current crowding and a reference for the next hour from the same weekday last week. Label the actual historical date/time; never call it a forecast.
- Record history is a separate screen opened by 기록 보기. Select an hour and compare dated weekdays, full category labels and actual observation times. No typical-weekday averages or best-day claims inferred from one week's samples.
- Default history comparison has exactly eight target rows in newest-first order: server now, then server now minus 24 hours multiplied by 1 through 7. The oldest target is exactly 168 hours earlier. Do not drop an endpoint to force seven rows, or introduce a separate boundary-date control. Display target date/time and actual source observation time distinctly. Missing readings remain missing.
- Login is required for free/paid unlocks. A single global payment switch starts off. Off means explicit 0-credit access for 24 hours, with no positive balance requirement.
- With payment required, users without access get yesterday's hourly history; highlight yesterday's corresponding current hour. Detail preview is clearly dated yesterday. Full access adds current crowding, historical reference and rolling seven-day history.
- Access belongs to user + source area, works across mapped venues, and lasts exactly 24 hours from purchase inclusive to expiry exclusive. Use server time. Existing access keeps its original expiry after price/policy changes; no auto-renewal or stacking.
- Reuse shared credits with tenfold units and unchanged purchasing power: balances/grants ×10, recommendations 1→10, packages 5/12→50/120, unchanged cash prices/product IDs.
- Normal area price initially 10 credits. Full-price eligibility requires at least one valid source observation in EACH of the previous 168 completed Korea-time hours. Any missing hour, including after a later outage, means half the configured normal price rounded to a whole credit, positive halves up; initially 5. Exclude the current unfinished hour. Collection age and the eight displayed comparison rows alone cannot establish completeness. No discount percentage/wording. Payment-off final price is always 0.
- Confirm actual final cost, available history and duration before debit, including partial history. No collected readings means unlock disabled with a collection notice.
- Refresh after unlock and on re-entry during access. Failed refresh retains dated history and offers a free retry. Stale data alone does not block purchase; no fixed freshness cutoff was approved.
- Poll every 30 minutes initially, configurable per area, with selected-area/all-area bulk changes in admin.
- Korea time for dates/hours/yesterday. Hourly value is the latest valid source observation inside that hour. Missing hours stay missing; never interpolate or relabel old observations as fresh.

## Sources and validation

- Prior metadata check on 2026-11-18: [OA-21285](https://data.seoul.go.kr/dataList/OA-21285/A/1/datasetView.do) listed 121 areas, official catalog/boundary files, KOGL Type 1, one area/request and sample-key restriction to Gwanghwamun/Deoksugung. This does not establish actual Babyroo overlap or authenticated availability everywhere.
- Prior terms review: [KOGL Type 1](https://www.kogl.or.kr/info/licenseType1.do) and [Seoul API terms](https://data.seoul.go.kr/etc/accessTerms.do). Preserve attribution, source links and free-source disclosure; keep keys server-side and avoid implying endorsement. Recheck the exact feed/files used before rollout.
- Re-read [manual V8.5, April 2026](https://data.seoul.go.kr/SeoulRtd/downloads/실시간_도시데이터_매뉴얼.pdf): population estimates have processing latency. A fresh HTTP request does not imply a just-observed measurement.
- Prior dataset FAQ review found no historical API retrieval. Accumulate prospectively; dashboard past-trend graphics are not proof of an API backfill endpoint.
- Before implementing provider: validate authenticated payload, XML/JSON availability, observation timezone, level vocabulary, replacement/quality flags, quotas and HTTPS route. Do not silently change to the separate population/English feed without checking its terms.
- Collect only needed population fields. Official forecast fields are outside this MVP.

## Proposed architecture and safeguards

These are implementation proposals, not additional confirmed product decisions.

### Catalog and mapping

- Version source area IDs/names/boundaries and record provenance. Deactivate removed areas rather than reusing identities.
- Store verified assignment on existing event records; no new venue catalog for MVP. Track verifier, time, boundary version, evidence and location fingerprint.
- Relevant location changes through admin OR crawler/import invalidate verification; unrelated summary/price edits do not. Import defaults must not erase verified assignments. Boundary changes also require re-verification.
- If boundaries overlap, admin explicitly chooses an area. Existing entitlements remain tied to the original area when a venue is remapped; no automatic transfer.
- Hidden/draft/deleted events cannot become discoverable through crowding endpoints. An existing area's entitlement is not permission to expose unpublished event data.

### Storage, time and historical reference

- Separate source observedAt from fetchedAt. Persist source/area/time/category and applicable quality flags. Deduplicate source observations, handle corrections explicitly, reject malformed/unknown/future measurements.
- Retain ALL collected valid observation timestamps for the retention period. A latest-per-hour-only table is insufficient: a 14:35 comparison must still find 14:30 even after a 14:55 reading arrives. Hour aggregates/coverage counters are derived indexes, not replacements for raw observations. Key observations by source-area identity plus observedAt, index area + observedAt for latest-at-or-before queries, and recompute affected coverage/aggregate entries on source correction/removal.
- Latest fetch status is independent of latest observation. Do not create fresh hourly records just because an old response was fetched again. Preserve quality/replacement flags.
- Store instants consistently in UTC, interpreting source timestamps in their documented zone. Compute Korea bucket boundaries server-side.
- Hourly lookup selects the latest observation inside the requested Korea hour and permitted access range, never after server now. Return actual timestamp and bucket bounds.
- User confirmed: default eight-row targets share a single server-now anchor for the response. Each precise target uses the latest observation at or before that target within its Korea hour. Show actual observedAt; no eligible observation means “No data.” Never use a later observation or carry an earlier hour forward. This precise-target rule differs from a completed hour's latest-per-hour aggregate. Manual time selection still needs D4's range/target-minute rule.
- Endpoint handling: the target exactly 168 hours ago may use an observation a few minutes earlier within that same hour. Permit a bounded look-behind from that target to the start of its hour for this endpoint lookup only; otherwise strict timestamp filtering would incorrectly remove an eligible sample. Example: target 14:35 seven days ago may use 14:30 that day. Do not expose an unrestricted older-history range. Retention must preserve that boundary bucket.
- Reference target: server now + one hour - seven calendar days in Korea time. Apply the SAME precise-target rule: latest observation at or before that target within its hour, not a later reading from that hour. Example: target 15:05 last week cannot use a 15:30 observation. Show actual date/time; midnight can change the target weekday. Missing eligible reading means unavailable, not a substitute day/official forecast.
- Corrected arithmetic: reference is about 167 hours old. Propose nine-day raw/bucket retention as operational buffer; it does not expand the purchased history or imply eight days are necessary. Financial/access retention is separate.
- Track first valid observation, latest observation, successful fetch, failures and populated-hour count. Source repeats/downtime must not appear as complete collection.
- Completeness window: let H be the start of the current Korea hour. Count distinct valid observation buckets in [H - 168 hours, H). Exactly 168 populated buckets means full price; otherwise half price. A repeated fetch of one timestamp counts only in its actual source hour. Oldest completed-hour coverage may precede the moving 168-hour display boundary by less than one hour; preserve it for pricing and the bounded endpoint lookup, without exposing an unrestricted older range.
- Example: at 14:35, pricing counts the 168 hours ending at today's 14:00, excluding 14:00–14:59 today. One valid observation per completed hour suffices; no requirement for both planned half-hour samples. A configured collection interval longer than one hour can legitimately make full completeness impossible; warn administrators of this pricing consequence rather than inventing readings.
- Current summary and comparison row have different semantics: the compact current card may retain the latest dated observation through an outage, as agreed. If it is from a previous hour, label it as the last observation instead of suggesting a new measurement. The precise now-row remains “No data” if its own hour contains no eligible reading.
- A 30-minute polling interval cannot promise readings precisely at :30. Display actual source times.

### Collector and admin

- Start collecting explicitly enabled areas linked to verified venues. Admin offers pause/enable and health alongside per-area intervals, mapping, global payment mode and normal price.
- No recurring scheduler is configured in the repo. Select a real deployment-compatible scheduler before rollout; no in-process timers or unbounded serverless background promises.
- Protected due-area jobs use database leases, bounded batches/concurrency, timeouts, lease recovery and retry backoff/jitter. Failures are isolated per area; no invented backfill after downtime.
- Offered intervals must match deployed tick frequency and quotas. Proposed validation is whole minutes, minimum equal to deployed tick, maximum 24 hours; only the 30-minute default is currently agreed. Define next-due semantics when changing intervals.
- Bulk updates validate targets/revisions before mutation, avoid lost updates, audit actor/old/new values and clearly distinguish selected versus all areas. Stagger collection to avoid bursts.
- Dedicated scheduler secret, HTTPS, bounded XML parsing and redacted key-bearing URLs/logs. Separate scheduler/admin/user authorization.
- Coalesce user refreshes with a configurable provider cooldown shared by area, so screen reopening cannot bypass quotas. Re-entry refreshes permitted UI data and attempts provider updates when allowed; the same observation can legitimately be returned.
- Monitor source age, last successful fetch, failures, missing hours, leases and next due. Prune independently of financial records. Production collection/access needs Postgres; memory adapters are test-only.
- Use explicit operational defaults in the implementation/runbook for batch size, provider timeout, cooldown, lease lifetime and retry ceiling. Select values from measured latency and confirmed quotas; they are routine engineering settings, not new product approval questions. Keep non-sensitive defaults documented and injectable for tests. Distinguish collection-enabled from publicly purchasable so initial warming can run before the feature is released.

### API, access and transactions

- Guests see area availability/explanation and login entry. Proposed conservative interpretation of required login: no readings before authentication; yesterday preview is free after login. Guest previews require a deliberate decision.
- Public event/list metadata adds availability/verified area only, no protected readings. Avoid provider calls per card; use dedicated authorized area endpoints.
- Define contracts before implementation: support metadata; preview/full read + selected hour; server quote; unlock confirmation/idempotency; protected collector; admin catalog/mapping/settings/scheduling.
- Responses include server time, entitlement expiry, allowed range, actual observations, collection/source status and attribution. Enforce permissions on every read/refresh, including after expiry, independent of client clock/UI.
- Cache by user + area + expiry; prevent shared CDN leakage. Clear/restrict paid data on logout, account switching, expiration and relevant mapping/policy changes. Retained screens must not bypass expiry.
- Quote binds user/area/policy revision/cost/disclosure/available range and short expiry. Validate again at commit; changed price or material disclosure requires reconfirmation. Payment-off overrides partial-history pricing.
- Compute completeness server-side using the quote's explicit anchor/window and revalidate at confirmation. Crossing an hour boundary, source correction, pruning or new data can change price. Return the revised quote for confirmation rather than silently charging a new amount. An already purchased unlock is never repriced or shortened when completeness later changes.
- Freeze quote serverNow, target times, coverage window and disclosure snapshot for a short documented TTL (proposed two minutes). Natural advancement of now or fetchedAt alone is NOT a changed disclosure and must not cause a reconfirmation loop. Reconfirm on expiration, cost/policy changes or material loss/correction of promised data. Distinguish confirmation of a purchase from subsequent live reads, whose anchors may move normally.
- Completeness is not the number of visible rows: 168 populated completed hours can still produce a missing exact-target row near the start of an hour. Quote disclosures show actual comparison availability and source times as well as hourly coverage. Never promise eight nonempty rows solely because the full-price coverage check passes.
- Use one transaction boundary to check existing access, conditionally debit sufficient balance, insert linked ledger and create entitlement. Existing standalone consume followed by a separate entitlement save is unsafe.
- Serialize same-user/area buys; durable unique idempotency keys replay original results, including after expiry. Account-wide conditional debit protects different areas AND recommendation purchases. No negative balances, duplicate debits, orphan ledger/access or fresh unlock from an old replay.
- Scope idempotency by authenticated user and key; bind the stored request to area/quote, reject reuse with a different payload, and authenticate before replaying an outcome. Returning another user's entitlement/ledger is forbidden. An existing active user/area entitlement is returned without a second debit even with a new idempotency key. Store access state under a stable user/area key plus an immutable purchase log; do not try to express unexpired access solely as a time-dependent unique index. Use consistent locking order and bounded transaction retries.
- Retry after uncertain response returns committed access. Ledger links area, entitlement, quote/charge and unit version. A 0-credit unlock persists access without positive balance or a paid debit.
- No provider fetch inside financial transaction. Refresh after commit; refresh failure neither recharges nor invalidates committed access. Transaction failure rolls debit/access back together.
- Purchase eligibility follows the existing stale-data decision: allow purchase if a valid retained reading can be shown, even when it is only a dated last-known observation and seven-day history is empty. Disclose the actual time and absent history before purchase and charge the incomplete-history price when payment is on. Do not introduce an unapproved freshness cutoff. If no valid retained readings exist at all, disable unlock. An old last-known reading does not authorize browsing arbitrary older history.
- Payment policy lookup failure must not default to payment-off or grant access. Existing access is checked from persistent records; when policy/quote state cannot be validated, return a retryable error without debit/new unlock. A timeout after commit is handled through idempotent recovery, never a guessed success or a second purchase.

### Minimum persistent model and API contract

- Area: immutable source ID, name, boundary provenance/version, active/public status and timestamps.
- Verified assignment: event ID, area ID, verifier/evidence/time and checked location/boundary fingerprint.
- Collection state: area ID, enabled, interval, nextDueAt, lease owner/expiry, last attempt/success/source time, first valid observation and last error. Observation retention is independent of first-start metadata.
- Observation: area/source identity, observedAt, fetchedAt, category, quality and correction revision. All timestamps needed by point lookups remain queryable.
- Policy: global payment-required flag (default false), nonnegative integer normal price (default 10), policy revision and admin audit. Prices must fit database/API integer limits. Zero normal price remains zero after rounding.
- User/area access state plus immutable unlock records: purchasedAt, expiresAt, charged credits, credit-unit/policy version and optional linked ledger entry. Account deletion removes or anonymizes user-linked access/quotes consistently with existing account deletion; it does not remove shared area observations.
- Quote/idempotency outcome records: user, area, immutable request binding, anchor, window/coverage/disclosure snapshot, cost, expiry and durable outcome. Index ownership/range lookups and enforce user/area/ledger relationships in persistence, not only controller checks.
- Event support metadata is optional/additive for existing clients. History requests accept a selected hour (0–23), not arbitrary client-supplied dates/windows or a trusted client clock. Server returns one anchor, explicit target/observed times and per-row states: available, no_data, future or outside_range. Selected-hour pricing is never recomputed from only those rows.
- Locked history uses a different explicitly authorized yesterday-only response shape/range; never return eight real rows and merely mask seven in the UI. Payment-off still requires an unlock before full access. An active entitlement always wins over the locked preview branch.
- Quote/confirm and history responses carry source attribution and cache restrictions. Specify concrete HTTP paths/error payloads during slice implementation while preserving these required fields and permission boundaries; internal endpoint naming is not a product decision.

### Tenfold unit migration

- Centralize costs/units. Update recommendation balance threshold, debit AND saved session creditCost; signup defaults/environment configuration; packages; labels; historical amounts. Current default signup grant is 3→30, not the illustrative mockup's 5.
- Audit hardcodes: mobile gates recommendations only at balance <= 0; copy uses 1회; hidden-package filter compares credits to 12. Use real costs and stable IDs so scaling does not accidentally reveal the family package.
- Versioned exactly-once migration scales balance, ledger, purchase credit quantities, session cost and known credit metadata only. Never scale cash prices, immutable provider responses or unrelated numeric JSON.
- Pause/drain credit writers and recommendation workers during cutover; snapshot/reconcile balances/ledger, migrate and deploy compatible writers before resuming. Check integer bounds, signup races and new/old purchases.
- Existing minimum-build gate is UI-only. Select server-side legacy unit conversion/versioning OR rejection of incompatible credit operations. UI update prompts cannot secure old clients. Never roll back unit-1 code onto scaled balances.
- Preserve Google product IDs/cash prices and token idempotency, including purchases initiated before but verified after migration.
- Because recommendation and credit units change together, inspect all recommendation adapters (remote, mock and in-memory) and failure paths as well as the production debit. Signup env overrides, purchase replay and saved history must declare the unit version; do not infer a version from the numeric amount.

## Delivery slices

1. **Collect first:** verify provider/boundaries/quotas; add area catalog, observations, collection metadata, leases/retention, protected scheduler and minimum admin mapping/interval/health controls. No credit migration is needed to accumulate history. Deployment still needs explicit rollout authorization.
2. **Read-only queries:** authorized preview/full-history buckets and historical reference; implement confirmed D1/D2, document manual-selection boundaries under D4 and validate real timestamps/gaps. No release outside agreed unlock permissions.
3. **Credits and access:** rehearse unit cutover, concurrency-safe shared debits, server quotes, idempotent free/paid unlocks and ledger links. Payment starts off; collection continues independently.
4. **Mobile/admin completion:** Explore teaser, compact locked/unlocked detail, login return, dedicated history/time selection, 0/5/10 confirmations, expiry/cache/retry and final admin settings. No new unrelated event facts.
5. **Verify/roll out:** database concurrency/cutover tests, real-device visual states, attribution/runbook, initial history and staged deployment. Payment activation is a separate decision, not automatic at seven days.

## Acceptance and verification

- Time/source: processing latency, repeated/corrected readings, Korea midnight, missing/future buckets, 167-hour reference and midnight/week boundary cases.
- Display/API: D1 range behavior, actual dated values, no fabricated rows, yesterday preview cannot leak current/full history/reference.
- Mapping: admin/import/boundary invalidation, same-area shared access, explicit remapping and unpublished-event protection.
- Collection: leases/crash recovery, isolated failures, pauses, intervals/bulk updates, next-due changes, cooldown/quotas, pruning and persistent storage.
- Money, using real Postgres concurrency: same/different areas and recommendation versus area spend; insufficient balance; duplicate/late replay; quote/policy changes; pre/post-commit failures; exact expiry. No negative account/double charge/orphan access.
- Pricing: zero-balance 0-credit unlock with login; all 168 completed hours populated versus a single missing hour; current unfinished hour excluded; repeated stale timestamps cannot fill gaps; 5/10 charges/disclosures; odd-price rounding; no percentage copy. Verify hour-boundary quote changes, and no repricing of existing access.
- Observation/quote regressions: keep a 14:30 reading usable at target 14:35 after 14:55 is ingested; do not use 14:55 prematurely. Quote anchor does not drift during confirmation; ordinary polling does not cause reconfirm loops. Full hourly coverage does not fabricate missing precise-target rows.
- Idempotency/access regressions: key reused for another area/quote, another authenticated user, new key during active access, replay after expiry, conflicting account spend and policy lookup failure. All must preserve ownership and the agreed no-double-debit behavior.
- Migration: purchasing power/ledger reconciliation; signup/package visibility/session costs; old/new clients; in-flight jobs/purchases; token replay and safe rollback.
- Authorization/cache: guests, expired access, logout/account switch, hidden events, direct endpoints and no shared-cache exposure.
- Visual: normal/narrow/enlarged text; safe areas/image alignment/icons; guest/locked/free/paid/active/expired/partial/empty/loading/outage states; history hour selection; admin selected/all editing and validation states.
- Checks: server tests/typecheck, admin build, app TypeScript/lint/relevant/full tests. Re-establish baseline if repository changes; prior full app comparison had 12 existing failures, current stage-1 focused suite has six passing tests.
- Local model behavior and mocks do not replace database concurrency tests or rendered device inspection.

## Decisions and release gates

**D1 — resolved: eight relative-time rows.** User selected current time and current time minus 24 hours × 1 through 7, newest first. User also explicitly confirmed latest observation at or before each target within the same hour, actual observation time shown, and “No data” when absent. Include the bounded look-behind for the oldest target as specified above; never fabricate exact-time samples.

**D2 — resolved: completed-hour completeness.** User explicitly agreed that ANY missing hour among the previous 168 completed Korea-time hours triggers half price, excluding the current unfinished hour. At least one valid observation per hour is enough. Initial full/partial prices remain 10/5 credits; rounding and no-discount-copy rules remain. This supersedes elapsed-collection-age pricing and any implied gap tolerance.

**D3 — clarified using the existing stale-data decision.** Allow a purchase with an available dated last-known observation, even if history is empty; disclose this before purchase and use incomplete-history pricing. No valid retained observations at all means no unlock. There is no new freshness restriction or additional approval question.

**D4 — manual time selection (concrete implementation proposal for final plan approval).** Default remains now minus 24 hours × 0–7. Manual hour selection replaces only the hour on the anchor's Korea date, preserving its minute/second, then subtracts 24 hours × 0–7 for the other rows. Keep the original server anchor and authorized rolling range; refresh/re-entry explicitly establishes a new anchor. A future top-row target is marked future, and older targets outside the permitted window are marked outside_range. The oldest default target retains only its agreed same-hour bounded look-behind; selection must not widen the authorized range to another hour/day. Labels become actual dates/times or today, not now when another hour is selected. The compact current card and next-hour historical reference remain anchored to actual server now, independently of history selection. This preserves both chosen-time comparison and the latest eight-row decision without silently dropping the selector or expanding access.

**Operational:** select scheduler/minimum interval and initial areas; validate key/payload/quotas; choose legacy credit-unit strategy; review final eight-row and admin state images. D4 is an implementation proposal to include in final plan review, not consent to drop time selection or expand history. Stage-2 implementation still requires explicit approval.

## Review scope

Compared conversation, glossary, stage-1 plan, public/admin event contracts, Prisma/imports, credit repository/service, recommendation processor, credit UI and minimum-build policy. No feature code, migrations or deployments changed during review. Generated mockups are design references, not implemented behavior/live-data evidence.

Latest review also checked raw-versus-hourly data sufficiency, quote drift, active-access/idempotency storage, policy failure behavior, public versus enabled collection state and exact manual-selection semantics. Confirmed product decisions are distinct from engineering defaults; routine timeout/batch/endpoint naming choices do not require a new requirements interview.

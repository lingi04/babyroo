# Surrounding-area crowding

Status: Draft — implementation not approved. Visual review pending.

## Delivery sequence

1. UI redesign of existing detail view using the current app/API event contract only. No crowding UI, area assignments, credit scaling, data migrations or new event fields in this stage. See `app-detail-ui-redesign.md` for the field audit and proposed scope.
2. Add crowding, history, collection/admin controls and associated access/credit changes after stage 1. This document covers that later feature; it does not authorize implementing it during the UI redesign.

## Latest design review decisions

- User approved the compact full-detail layout and separate “혼잡도 기록” screen. The before-unlock state is under review. Design approval is not approval to implement the complete plan.
- Keep crowding secondary to venue information: one compact card on detail, with “기록 보기” opening the dedicated selected-hour weekday/date comparison screen. Do not embed the seven-day list in place detail.
- Replace the earlier proposed official forecast with a historical reference: for one hour ahead, show the observation from the same weekday last week at that target hour. Label the actual date/time and that it is a historical reference; never present it as a prediction. Missing corresponding observations show unavailable. Earlier official-forecast proposals below are superseded and forecast integration is out of scope.
- This historical reference can require observations almost eight days old. Retain at least nine days internally while exposing the agreed rolling seven-day history. Do not fabricate missing historical references.
- Paid mode before unlock: current data and full history remain locked; show yesterday's same-hour observation clearly dated, plus the actual price and 24-hour duration. Button opens confirmation before spending. Normal 10-credit, partial-history 5-credit and payment-disabled 0-credit states share the layout; sign-in remains required. Free preview may also open yesterday-only history.
- The generated broader detail redesign is a visual proposal. Museum imagery, operating times, guardian details and example descriptions are illustrative; production UI must use existing verified event fields and omit unavailable facts. No invented facts may be introduced to match a mockup.

## Model usage

| Workflow stage | Model used | Reasoning level | Evidence |
| --- | --- | --- | --- |
| Plan | Unknown | Unknown | Runtime exposes no confirmed active model name or reasoning setting. |
| Review the plan | Unknown | Unknown | Repository and source review performed in this session; active settings unavailable. Visual review pending. |
| Implement | Pending | Pending | Requires explicit plan approval. |
| Verify | Pending | Pending | Implementation has not started. |

## Agreed requirements

- Start with Seoul surrounding-area crowding. Weather, air quality, and parking are future work, subject to source validation.
- Supported Explore cards show a crowding teaser opening their existing detail screen. The detail screen hosts conditions and access controls.
- Administrators manually verify a venue lies within an official area boundary before mapping it. Unsupported/unverified venues have no teaser. Area conditions never imply venue occupancy.
- Login is required for all unlocks, including free unlocks. Anonymous browsing and other existing detail content remain available.
- A global payment-required setting starts disabled. Disabled means an explicit 0-credit, 24-hour area unlock, not automatic unrestricted access. No positive credit balance is required.
- With payment enabled, free access shows yesterday's hourly history, with yesterday's corresponding current hour highlighted. An area unlock adds current crowding and rolling seven-day history.
- Unlocks are per user and area, reusable across mapped venues, valid from purchase inclusive until purchase + 24 hours exclusive. Existing unlocks keep their expiry when prices/settings change.
- Use existing credits. Scale all credit units by ten while preserving cash prices and purchasing power: recommendations cost 10, packages grant 50/120, existing balances and historical credit quantities scale consistently. Product IDs and purchase-token idempotency remain stable.
- Initial normal area price is 10 credits. Before collection spans the previous 168 hours, charge half the configured price, rounded to the nearest integer (positive halves round up); initially 5. Display actual available period and final cost before confirmation, without discount wording or percentage.
- Confirm before debit. No readings means purchase/unlock disabled with a collection notice. Partial history is disclosed before purchase.
- Refresh immediately after an unlock and whenever detail reopens during active access. If refresh fails, show available history, observation times, and retry; retry never charges. Do not reject payment solely because current data is old. No separate freshness cutoff was approved.
- Collect every 30 minutes initially, independently configurable per area. Admin supports changes to one area, selected areas, or all areas.
- Use Korea time for days, hourly buckets, and yesterday. Access lasts exactly 24 elapsed hours.
- Each hourly bucket uses its latest observation. Missing hours stay gaps. Future hours are not represented as collected observations.
- The primary conditions view answers three questions: current crowding, official forecast approximately one hour ahead, and observed crowding at a selected hour on each of the last seven days. Show current and forecast side by side, clearly distinguishing observations from predictions. A time selector controls a compact weekday/date comparison list with full category labels. Historical comparisons describe actual dated observations, not typical weekday patterns or recommendations inferred from one sample per weekday. This replaces the grid and the single-day chart as the main view. In paid mode, users without an unlock see yesterday only; forecast follows full-access permissions.
- Forecasts use source-provided values only. Show the exact forecast target time and source update time; do not invent or interpolate a one-hour estimate. If the source provides no valid target near the requested time, show “Forecast unavailable.” Verify target cadence/tolerance against the official payload before implementation; an older forecast must not be represented as one hour from now.
- Admin manages coverage/mappings, per-area intervals and bulk changes, global payment mode and normal price.
- Keep product copy concise and concrete. Do not add explanatory filler such as “수집된 기간과 관측 시각을 함께 표시해요.” Show actual available dates and observation times where relevant instead of announcing what the UI displays.
- Design direction: a concise UI whose meaning is immediately understandable. Lead with the named area, current crowding or access contents, and a single clear action showing the actual credit cost and 24-hour duration. Keep area-versus-venue scope, login requirements, timestamps and purchase disclosures visible in their relevant states; use hierarchy and plain labels rather than promotional subtitles or unexplained icons.

## Source verification (2026-11-18, Korea time)

- [Official Seoul dataset](https://data.seoul.go.kr/dataList/OA-21285/A/1/datasetView.do) explicitly lists KOGL Type 1, commercial use/modification permitted, 121 areas, area-list and boundary downloads, one area per API call, and sample-key access limited to Gwanghwamun/Deoksugung. This verifies published coverage count, not the overlap with Babyroo venues or successful authenticated access to every area.
- [KOGL Type 1](https://www.kogl.or.kr/info/licenseType1.do) requires attribution, source links where possible, and disclosure of free source availability. Avoid implying Seoul endorsement.
- [Seoul API terms](https://data.seoul.go.kr/etc/accessTerms.do) require visible Seoul public-data attribution, prohibit sharing API keys, and allow request restrictions. Keep the key server-side.
- The dataset FAQ says historical API data is unavailable. Collect prospectively; never manufacture seven days of history.
- Before implementing the provider, inspect the current official manual, exact population payload, timestamps, boundaries, and API limits. The live dashboard's extracted placeholder says 50 while the dataset metadata says 121; use the versioned official area list/boundaries and validate available areas rather than using that placeholder as the catalog.
- Forecast research: [official population API schema](https://data.seoul.go.kr/dataList/OA-21778/A/1/datasetView.do) documents `FCST_YN`, `FCST_TIME`, and `FCST_CONGEST_LVL`; the [official dashboard](https://data.seoul.go.kr/SeoulRtd/map) presents a future 12-hour outlook. Forecast support is therefore documented, but availability, cadence and freshness must be validated per area. Do not assume all coverage areas have forecasts or change providers without checking that feed's license.

## Repository findings

- `app/App.tsx` contains shared Explore/detail screens; `app/src/data/events.ts` and server event entities have no coordinates or reusable venue identity.
- Server follows ports/adapters and uses Prisma/Postgres with in-memory local fallbacks. No recurring scheduler was found.
- Credits are currently recommendation-specific in labels, validation, debit paths, purchase packages, and some hardcoded UI conditions. Scaling must cover these, signup grants, session costs, ledger quantities, and credited-purchase records.
- Admin is a React/Vite app with existing authenticated pages and event editing.

## Proposed implementation decisions (assumptions for review)

- Store the verified area assignment on existing event/place records for MVP; do not introduce a separate venue catalog. Admin records verification time and evidence/address. Multiple records for the same venue require consistent assignment.
- Store raw observations with source observation time, ingestion time, source area code and crowding level; deduplicate provider observations. Screen visits never replace scheduled collection.
- Persist a collection-start marker per area. Full-history price requires that marker at or before now minus 168 hours; ordinary gaps do not reset it. Show first/last actual readings and gaps rather than claiming continuous completeness.
- A rolling 168-hour interval can touch eight Korea calendar dates. Make partial boundary dates selectable without displaying observations outside the rolling interval. Yesterday is the full prior Korea calendar day.
- Lead with the two compact current/forecast summaries, followed by a selected-hour weekday/date list. Use full crowding labels, small restrained color accents and visible missing readings. Default the hour selector to the current Korea hour; label each row's actual observation time. A rolling window may offer partial boundary dates; do not include observations outside it. Show expiry once. No heatmap or multi-chart dashboard. Any secondary day chart is deferred pending explicit review.
- Refresh serves the latest authorized stored data and attempts a bounded provider refresh after purchase/re-entry. Coalesce simultaneous same-area requests; failures retain stored observations. Record actual source time, never label ingestion time as observation time.
- Use a scheduler-neutral protected due-area endpoint with database leases and retries, triggered externally at a frequency supporting configured intervals. Confirm deployment scheduler capability before deployment; do not rely on timers in serverless requests. Restrict interval choices to supported cadence and validate bulk inputs atomically.
- Persist policy and per-area schedule settings server-side. Record admin changes and mapping verification. Reverify mapping when venue location changes.
- Atomically debit credits and create an entitlement; serialize same-user/area purchases, use idempotency keys, and return existing access without another debit. Expiry uses the server clock. Bind confirmation to a short-lived server quote and require reconfirmation if cost changes.
- Logged-out users can see the teaser, area explanation and free yesterday preview, but must sign in to unlock. Server endpoints enforce paid/current/history boundaries; hidden UI is insufficient.
- Setting payment off offers 0-credit access; it does not retroactively extend an existing unlock. Reopening active access does not shorten/renew its expiry.
- Retain at least eight days of observations to cover calendar-day previews and rolling-window boundaries, then prune; retain financial/entitlement history separately.
- No auto-renewal, advance unlock stacking, or refund for ordinary refresh failure. Zero-data purchase rejection is enforced at commit as well as quote time.

## Implementation steps

1. Verify official manual, area catalog/boundaries and source schema. Document provenance and select initial supported venue mappings from existing data, without assuming matching district names imply coverage.
2. Add credit-unit constants and an exactly-once transactional tenfold migration. Handle stored account balances, ledger entries, purchase credit quantities, recommendation session costs and numeric credit metadata deliberately. Update grant defaults, package labels, validation and app displays without changing cash prices or product identities. Define deployment compatibility for old clients before enabling scaled purchases.
3. Add coverage-area, verified assignment, observations, collection metadata, policy and entitlement models/migrations. Define application ports and Postgres/in-memory adapters.
4. Add server-side Seoul adapter, due-area collection endpoint, leases, per-area scheduling, idempotent observation storage and retention. Keep provider credentials out of client responses/logs.
5. Implement authorized preview/full-history reads, server quotes and atomic unlock/debit flow. Include source attribution and policy/price metadata in responses.
6. Add admin conditions page for settings, interval bulk editing and collection status; extend event editor for verified assignments. Include confirmation for bulk operations and actionable validation failures.
7. Add mobile teaser, detail conditions panel, login return flow, 0/5/10-credit confirmation, active-access expiry, refresh/retry, yesterday preview, current/official-forecast summaries and selected-hour weekday comparisons. Preserve reservation CTA and existing detail navigation.
8. Complete matching screenshots and acceptance review, then deployment/runbook instructions for key setup, scheduler, collecting initial history, migrations, credit cutover and payment activation.

## Acceptance and verification

- Supported/unsupported and verified/unverified records behave correctly; mapping changes cannot silently grant access to another area.
- Anonymous unlocks fail server-side; signed-in 0-credit unlock works with zero balance. Yesterday preview cannot expose current data or unauthorized historical observations.
- Exact expiry, shared-area reuse, duplicate taps/concurrent purchases, insufficient credits, quote changes, policy switches, and refreshed access cause no double debit or unintended extension.
- Partial-history quote is 5 for initial normal price 10; normal quote is 10 at the 168-hour threshold. Odd configured prices round half upward. Empty areas cannot unlock. Missing samples remain gaps.
- Verify Korea midnight boundaries, source timestamp parsing, latest-per-hour selection, eight possible selectable calendar dates, future-hour handling, and yesterday highlight.
- Verify independent intervals, selected/all bulk changes, overlapping scheduler executions, provider retries/rate limits and credential protection. No synthetic history when collection is down.
- Prove tenfold migration runs once and preserves purchasing power and ledger reconciliation; replaying old purchase tokens never grants credits twice. Verify old-client cutover and recommendation costs/displays.
- Review Explore teaser, detail locked/unlocked/expired/login/loading/error/empty/partial states, confirmation, chart selection and all admin controls at normal/narrow widths and enlarged text. Inspect spacing, hierarchy, contrast, level labels, date navigation discoverability and 48-unit mobile controls. Inspect 0/5/10-credit UI in context.
- A parent should be able to identify the covered area, whether information is current or historical, the crowding level, and the cost/duration of the next action without reading a paragraph. Keep one primary action per conditions state; do not hide essential meaning behind color alone.
- Server: `npm test`, `npm run typecheck`; admin: `npm run build`; app: targeted meaningful tests, `npx tsc --noEmit`, `npm run lint`, then full relevant tests. Compare pre-existing failures against baseline.
- Verify no unauthorized external payment or deployment occurs as part of local implementation.

## Plan review and remaining gates

- Requirements interview complete for core scope. Assumptions above are proposals, not independently confirmed decisions.
- Current UI references: `app/store-assets/real-screenshots/01-explore.png` and `02-detail.png`; saved screenshots may predate current source styling. Proposed mockups must be labeled and compared at the same viewport and interaction state.
- Visual review is pending: produce and inspect current/proposed mobile and admin images before requesting implementation approval. A saved screenshot alone does not establish current running UI.
- Deployment prerequisites: official API key and tested response, scheduler capability at selected cadence, a reviewed venue/area mapping list, and credit migration/old-client rollout. No secret values are required in this document.
- No feature implementation or implementation verification has occurred. Only glossary and planning artifacts have been created.

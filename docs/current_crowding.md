# Current crowding: operation and rollout

Current conditions are free after login. Observations accumulate internally; history UI, credit migration, payment and entitlements are deferred.

## Before deploying

1. Apply the initial crowding migration, which creates area metadata and observation history directly. The user confirmed the crowding migrations have never been applied, so there is no legacy snapshot migration or data-copy step. Generate Prisma and run the normal server build. No production migration has been applied locally.
2. Confirm OA-21285's current response and official area catalog/boundaries. No example areas or venue assignments are seeded automatically.
3. Supply server-only BABYROO_SEOUL_API_KEY. Default source template is the documented http://openapi.seoul.go.kr:8088/{key}/xml/citydata/1/5/{area}. Seoul's [official response](https://data.seoul.go.kr/together/notice/inquireView.do?bbsCd=10003&ditcCd=QNA01&seq=1d2186fcde0d53cbbb2814bec743624a) states that HTTPS is unavailable. The adapter permits HTTP only for that exact official host/port, forbids redirects and never logs key-bearing URLs. Optional BABYROO_SEOUL_CITYDATA_URL can override the template for a verified HTTPS proxy; keep {key}, {area} and /xml/citydata/. The mobile/admin/job API connection uses HTTPS; no key or source URL template is sent to clients.
4. Supply BABYROO_CROWDING_JOB_SECRET with at least 32 unpredictable characters. The job accepts only POST with a matching Bearer secret. User/admin tokens are not scheduler credentials.
5. In admin, register official area code/name, versioned official boundary reference and URL; new areas start with collection disabled. Open an event's 주변 지역 연결 link, inspect the actual venue/address against the official boundary, record evidence and confirm. Do not infer membership from district or distance.
   Alternatively, use 장소 경계 확인's event picker: search by title, venue or address, select a result, then select the official area. All publication states are included; preparing a mapping never publishes a hidden/draft event. Selection persists across search/page changes; selecting another event clears previous boundary confirmation.
6. Configure an external recurring scheduler and enable selected areas. No production scheduler is installed or enabled by these code changes. Run server/scripts/collect-crowding.cjs on a trusted runner with BABYROO_CROWDING_API_BASE_URL (HTTPS URL ending in /api) and the job secret injected by its secret store.

An always-on scheduler can invoke the command once per minute. For example, install an entry equivalent to:

    * * * * * /path/to/node /path/to/server/scripts/collect-crowding.cjs

Inject secrets outside the crontab/command line. If the scheduler ticks every five minutes instead, use only intervals of five minutes or longer; invocation delays still affect actual sampling. Each invocation claims at most five due areas concurrently; a large enabled catalog needs sufficient ticks or repeated invocations to drain its queue. For the 30-minute default and 121 areas, budget at least 5,808 scheduled provider requests/day, plus quota-limited refreshes. Verify the issued key's actual quota before enabling that many areas. Select a job timeout exceeding provider (4 seconds) plus database work; lease lifetime is 30 seconds.

## Runtime behavior

- Authenticated GET /api/events/:id/crowding checks published state and the current verified mapping before and after refresh. Public events contain only optional area availability/name/revision.
- No valid reading produces an unavailable response with a null level. A failed refresh retains a dated snapshot. Prior-hour observations are presented as 마지막 관측; an HTTP fetch never changes observedAt.
- Provider responses are limited to 4 MiB, reject DTD/entity declarations, and validate area, level, Korea timestamp and replacement flag. The parser only reads the finite required XML leaf fields; fixture tests do not establish live provider compatibility.
- An area lease and 60-second attempt cooldown coalesce refreshes across devices. Successful collection schedules the next poll at its per-area interval. Failure retries with bounded exponential backoff up to 15 minutes; interactive refreshes also respect that retry deadline.
- Successful observations accumulate in `crowding_observations`, keyed by area, boundary version and actual source time. Repeated timestamps update the same row for corrections; older arrivals remain archived. Latest/current and admin reads select only the newest source time for the current boundary version, using the composite primary-key index. No expiry job, historical backfill or history endpoint/UI is introduced. Collection starts with new observations after setup.
- Collector output separates `completed` (successful reads), `failed` and `skipped` (leases/cooldowns). The scheduler command exits nonzero if any area fails, including partial batch failures. Failures are still isolated so other areas can complete.
- Collection settings are version-checked and audited. Editing settings clears old leases and staggers due times by three seconds per target. Disabled areas keep their last observation but do not fetch; inactive areas do not appear as supported.
- Changing the boundary version invalidates old verification fingerprints and cancels the old collection lease. Previous versions' observations remain stored but are excluded from the new version's current reads; a new reading is needed after re-verification. Changing a venue/address through admin or imports also invalidates its mapping. Public list metadata can lag up to its existing 60-second cache; protected reads always revalidate and cannot leak an old mapping's observation.
- Source observedAt determines the latest reading, regardless of fetch order. Lease completion and archival are one transaction; invalidated leases cannot add/correct history, and archival errors roll back lease completion. Same-time source corrections can update category/quality; failed or malformed responses do not add observations.
- REPLACE_YN=Y is a fallback average from the recent four weeks at the same weekday/time, according to the official response. The card marks this 참고 혼잡도 and explains the replacement rather than presenting it as a fresh current observation.
- The compact card combines area scope with the header's area name and info action. Tap it for the facility-versus-area explanation; the footer contains only 서울시 제공 for the full source/free-original disclosure and 원본 보기 link. These details remain available without duplicate area labels or permanent explanatory rows.
- Admin shows source time, last successful fetch, next due, errors and collection state. Check failed leases/overdue areas and quota health before adding areas.

## Smoke check in a controlled environment

- Use an isolated development database; do not run destructive/concurrency tests against a production DATABASE_URL.
- Verify a real official area and event manually, enable it, run one collection request, and confirm the actual source payload/time in admin.
- Anonymous current read must return 401; authenticated read should show the actual current or dated last-known reading. Public event responses must not contain observation values.
- Modify venue location and confirm support disappears until reverified. Pause/disable collection and check that old in-flight completions cannot overwrite a new lease.
- Check the mobile guest login-return flow, current/unavailable/retry/last-known states, source links, logout and rapid venue switching on a device. Check admin single/bulk interval edits and stale-revision errors.

Deploying the collector, validating the live authenticated source response, applying production migrations and real-device inspection remain explicit rollout tasks; local fixture tests do not prove those steps were performed.

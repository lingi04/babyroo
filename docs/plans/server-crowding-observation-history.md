# Crowding observation storage

Status: Implemented locally after the user explicitly authorized accumulating observation history while detail reads only the latest value. Requirements checked with the local grill-with-docs skill and existing crowding domain/code. No unresolved product decision or UI change. Production migration/deployment and isolated PostgreSQL execution remain pending.

## Model usage

| Workflow stage | Model used | Reasoning level | Evidence |
| --- | --- | --- | --- |
| Plan | Unknown | Unknown | Runtime model/reasoning metadata unavailable. User confirmed storage behavior. |
| Review the plan | Unknown | Unknown | Compared Prisma schema, lease completion, current/admin reads, boundary invalidation and deferred history specification. |
| Implement | Unknown | Unknown | Added archival schema/migration, atomic completion/upsert, latest-current reads and regression checks. Runtime settings unavailable. |
| Verify | Unknown | Unknown | Prisma generation, Nest build, server TypeScript and full suite: 32 passed, zero failures, one isolated PostgreSQL test skipped. Runtime settings unavailable. |

## Requirements and acceptance criteria

- Keep successfully collected observations as history with area, boundary version, actual source time, level, source quality and fetch time. No automatic expiry is introduced; this is a stated implementation assumption consistent with accumulating history.
- Deduplicate by area, boundary version and observation time; a source correction updates that observation. An older reading may be archived but must never replace a more recent value in current reads.
- Current/admin reads return only the latest observation for the current boundary version, retaining the existing response shape. History does not appear in public event metadata or gain a new endpoint/UI.
- Preserve old boundary histories when the boundary changes; they cannot appear as current data for a different boundary version.
- The user confirmed the crowding migrations have never been applied. Create observation history directly in the initial crowding migration; no legacy snapshot columns, data-copy step or follow-up conversion migration.
- Failed requests do not create observations. Completion validates the live lease, area revision and enabled/active state in the same transaction as the history write. Stale completions cannot insert/correct history. Operational health, cooldown and backoff behavior remains.
- Seven-day history UI, payments and credit changes remain deferred; the original discussion remains preserved.

## Implementation and review

1. Add the observation model directly to the initial, unapplied crowding migration. Remove the unnecessary snapshot-conversion migration.
2. Make latest-observation lookup explicit in current/admin reads, filtered by boundary version and ordered by actual observation time. Keep provider/operational area metadata separate from read projections.
3. Atomically persist lease completion and observation upsert. Do not overwrite a single area snapshot.
4. Update regression/integration checks, active scope documentation and operations guide.

Review: These are server/storage changes within the user's explicit authorization. No mobile/admin design or new access policy is introduced. Production migration/deployment is not included.

## Verification

- Generate Prisma; build/typecheck the server and run the full server suite.
- Check retained history, duplicate/corrected timestamps, older arrivals, latest selection, boundary isolation, failure preservation and rejected stale leases.
- Extend the isolated PostgreSQL test for persistence/rollback and migration-schema compatibility. Run only if an explicit isolated test database is configured; otherwise report the gap.
- Inspect migration SQL and diff; do not apply production migrations.

## Results and remaining checks

- Prisma generation, server build, server TypeScript and diff whitespace checks pass. Full server suite: 32 passed, zero failed, one PostgreSQL integration test skipped because no explicit isolated test URL was supplied.
- Store regression exercises retaining older arrivals, timestamp corrections without extra rows, latest current/admin selection, no inserts on failure/rejected completion and boundary isolation without deleting history.
- PostgreSQL integration was extended to cover actual upsert uniqueness, stale completion rejection, older readings, archive-write rollback preserving the lease, and history survival across boundary changes. It has not run locally; migration execution still needs verification against an isolated database.
- Latest lookup uses the composite primary-key index, filtered by area and current boundary version. Admin's area list resolves latest observations per area; there is no unbounded history load.
- After the user confirmed no crowding migration has been applied, removed the conversion migration and its data-copy logic. The initial migration now creates the final history schema directly. SQL/schema and whitespace reviewed; no runtime behavior changed. No deployment or production migration performed.

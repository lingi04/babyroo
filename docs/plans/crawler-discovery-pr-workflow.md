# Scheduled event-refresh PR workflow

## Approved requirements and decisions

The user authorized proceeding after the baseline and workflow discussion. Baseline is server/data/events.json at the latest fetched origin/main commit; current local main is 82a67b1 with 194 events and 30 fields. Manual DB export was already committed by the user. Mac/Hermes runs the job, not GitHub Actions. It creates an isolated branch from main, refreshes events, validates and opens a GitHub PR. User reviews/merges and imports DB manually. Never connect to DB or auto-merge from scheduler.

- External feeder (Hermes/search job) obtains new Google results; Python validates/reads them. No new search API/credentials. Missing/stale/malformed input fails explicitly. Max age default 8 calendar days, configurable; real generated_at date is retained. Required keywords object contains lists of hit objects with usable HTTP(S) URLs. Incomplete venue candidates remain review suggestions, not app events.
- Ignore image_url, admin_updated_at, publication_status, created_at, updated_at and last_checked_at during semantic event comparison. First three remain absent from catalog. Retain existing created_at/updated_at values; update last_checked_at only with a substantive event change, to avoid no-op file churn. New events have null created_at/updated_at, as DB generates these later.
- Match existing records by id or non-null (source, source_event_id), preserving baseline id and csv_sequence. Update other comparable fields from normalized source data; missing incoming optional/null values retain baseline values instead of clearing curated details. Source-produced concrete values can be reviewed as changes in PR. No special admin-edited handling remains.
- Keep missing events and flag them (user decision), including expired records. Sources with empty/invalid responses fail conservatively; never infer deletions. Full kids-cafe pagination, both facility categories. Other collector windows retain documented defaults and missing listings are only review signals, not proof of removal.
- Collect and normalize in a temporary staging directory. Any collection, normalization, feeder, report or validation failure returns nonzero before catalog replacement; no partial raw/normalized tracked files or baseline checkpoint. No .last_publish.json state.
- Human edits are retained in per-run PR reports/history; generated stable review state records missing identities and current new-candidate suggestions. No-op semantic catalog and review-state run writes no files and opens no PR. All new native events included, no top-25 loss.
- Official source classification uses parsed HTTP(S) hostname boundary checks; unconfirmed links are labelled discovery links. No automatic trust claim based on substring.
- Local PR runner fetches main in a dedicated fresh clone per run; never checkout/reset developer repository. Capture baseline SHA in PR body. Skip when another automation/event-refresh PR is open. Recheck remote main SHA before push; abort and rerun if it advanced. A local lock rejects overlapping invocations sharing the runner state directory. Never force push or overwrite a remote branch. Failures retain local run branch for diagnosis.
- GitHub mutation requires --submit; default performs refresh/diff/report locally without push or PR. Prerequisites checked first, gh authentication only when submitting. Commit only explicit generated catalog/review/report files. No API keys, feeder raw exports or arbitrary working files staged. No PR when nothing changed.
- Manual importer preserves existing image URLs and publication states when absent; provided csv_sequence retained. No automatic removals/DB deletes. Missing events need explicit human resolution outside the automatic import. This is a content baseline, not equality for DB-owned timestamps/images/statuses.

## Acceptance criteria and verification

1. Same main baseline plus semantically identical source/feeder produces no change even with timestamp/image/status changes. Substantive field change produces exact before/after diff; all newly detected events retained, stable IDs/sequences.
2. Complete mocked 3-page kids-cafe catalog preserves last page; missing/expired baseline rows remain and are flagged. Unknown/manual-source records retained without false missing alerts.
3. Collection/feeder/validation errors cannot modify baseline or review files. Freshness boundaries and real fetched date tested. Invalid manifest/root shape, duplicate IDs/source identity/sequence rejected.
4. Existing operator report edits survive later runs. New-candidate detection compares stable identities, not refreshed timestamps. Reports show actual field values, sources, new native events, missing records and unconfirmed candidate links.
5. Runner tests cover clean main branch provenance, exact staging, changed main abort, open-PR skip, no-op, lock, git/gh failures, and dry-run vs submit. Tests use local Git fixtures and mocked gh/refresh, no external network.
6. URL adversarial tests include spoofed hosts, query and userinfo. Import tests use mocked Prisma only and verify omitted images/status preservation and sequence numbers.
7. Existing offline Python tests and focused Node tests pass. Review final diff against each acceptance criterion. No live crawl/cron, GitHub API mutation or DB import during implementation verification.

## Implementation shape

- crawler/babyroo_crawler/discovery_workflow.py: pure comparison/merge/schema/report logic; source normalization through existing models, staged collection; CLI entry refresh_places.py.
- crawler/discovery/google_alerts.py and channels.py: external feeder reader and registry, no static Instagram examples in scheduled path. discovery_official.py exposes safe pure helper with no import-time I/O.
- scripts/event_refresh_pr.py: isolated Git/gh orchestration and dry-run/submit modes.
- server/scripts/import-events.js: minimal missing-field image preservation and explicit sequence handling; publication-status behavior preserved.
- Focused unittest/Node regression tests, crawler/README.md runbook including Hermes feeder contract and cron example. Preserve current data; do not execute live refresh.

## Stage assignments and Model usage

| Workflow stage | Agent | Plugin / skill used | Model used | Reasoning level | Evidence |
|---|---|---|---|---|---|
| Plan | /root | grill-with-docs | Unknown | Unknown | Repository skill read earlier; external feeder, Mac/Hermes, baseline file, retained missing events, ignored metadata explicitly agreed. Runtime settings unexposed. |
| Review the plan | /root/discovery_pr_plan_review | None | Unknown | Unknown | Approved; safeguards: identity conflicts fail, False/0 retained, bypass legacy publish, stable review comparison, staged rollback, valid ends_at, main race caveat. |
| Implement | /root | None | Unknown | Unknown | Implemented staged refresh, external feeder, safe URL helper, isolated runner, importer preservation and regression tests. Isolated clone /tmp/babyroo-discovery-workflow on feature/discovery-pr-workflow. |
| Verify | /root/discovery_pr_verify | None | Unknown | Unknown | PASS: 62 Python + 4 mocked Node tests; actual 194-event baseline integration; no blocking defects. Read-only independent evidence at /tmp/babyroo-discovery-pr-verification.md. |
| Verify (hardening follow-up) | /root | None | Unknown | Unknown | Added noninteractive subprocesses/30-minute deadlines, missing-gh and push/PR-failure coverage; focused runner suite repeated after these changes. |
| Verify (final hardening) | /root/discovery_pr_verify | None | Unknown | Unknown | Independent final PASS: all 9 runner tests and diff check; deadlines, noninteractive settings, missing gh, push and PR-create failures. |

## Review, results and gaps

Plan review approved; all safeguards addressed. User authorization applies to agreed scope; routine implementation choices above are explicit assumptions, not claims of deployment. Independent verifier PASS: 62 offline Python tests and 4 mocked Node importer tests; actual 194-event timestamp-only no-op, one-content-change, repeat no-op integration; retention, pagination, rollback, report history, identity, isolation and importer checks. Main independently confirmed actual194-event integration. An initial runner test fixture appended trailing whitespace and correctly failed git diff --check; fixture corrected to a substantive valid JSON change and affected suite passes. Main added optional hardening recommended by verifier (deadlines/noninteractive subprocesses and explicit GitHub failure coverage). Live verification blocked by absent /opt/homebrew/bin/gh and no configured feeder invocation; runbook provided. No live crawling, scheduler installation, GitHub pushes/PRs or DB imports performed.

Final independent hardening verification: all 9 runner tests pass (the original full suite had 7 runner tests). No further blocking issues. Patch application was checked read-only against active main 82a67b1. Active working files remain untouched; changes are uncommitted in the isolated feature/discovery-pr-workflow clone.

## Branch and commit handoff

User subsequently requested a new branch and commit. Creating a branch in the original repository failed because .git/refs/heads/feature/discovery-pr-workflow.lock could not be created (Operation not permitted). Created feature/discovery-workflow-fixes in the isolated /tmp/babyroo-discovery-workflow clone instead and prepared the verified implementation for commit. Original main working files and its unrelated untracked baseline plan are excluded. No remote push authorized or performed. This implements the deterministic refresh/PR tools; Hermes bot configuration itself remains a follow-up.

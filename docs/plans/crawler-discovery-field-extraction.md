# Discovery detail extraction

Status: approved by user ("Approve"); implemented and verified offline on main, uncommitted.

## Problem and goal

The current Hermes prompt discovers search hits. crawler/discovery/google_alerts.py validates/copies those hits into review suggestions; it never opens their detail pages or extracts complete records. Only the seven source-specific Python collectors currently produce structured app events. Add the missing discovery-to-structured-record stage so new official sources can produce proposed catalog additions in the existing PR workflow.

The user approved implementation after reviewing the plan. Preserve all existing uncommitted scheduler work and the 194-event baseline. Implement the source/validation/queue/prompt/test changes below; no live catalog, DB, bot, credentials, cron or GitHub mutation during development verification.

## Confirmed decisions

- Hermes on the Mac searches, opens detail pages and uses its already-configured model to extract fields. Python validates/transforms/merges deterministically. No separate LLM SDK, provider selection, API key or direct model call in the Python scripts.
- Support all outing types: dated events and permanent venues. Neither missing dates nor a venue-like title proves permanence.
- For an affirmatively confirmed permanent venue, Python assigns starts_at=1970-01-01 and ends_at=9999-12-31 (the user's policy). These are availability sentinels, not a claim about historical opening or actual closing dates. Models do not invent dates or use a rolling 180-day expiration.
- Required factual details need official organizer/venue evidence. Blogs, social/search aggregators and snippets may identify leads but cannot independently qualify required facts for catalog insertion.
- Keep the current latest-origin/main catalog baseline, isolated branch, PR, manual merge and manual DB import. No automatic publication, DB update or deletion. Missing existing records remain retained/flagged.
- image_url, admin_updated_at and publication_status stay absent from the catalog. created_at/updated_at remain present; all three timestamps including last_checked_at remain excluded from semantic comparisons. Extraction metadata, evidence and confidence stay outside server/data/events.json.

## Working assumptions to review with the plan

- Preserve the current Seoul-focused discovery configuration; do not expand geography or narrow to dated events. Optional facts may remain unknown; lack of optional age/amenity information is not a fabricated value or an automatic rejection.
- Validated full records are proposed directly in the PR's events.json; incomplete/ambiguous/possible-duplicate items go to the review queue. User PR review remains the final factual/source-identity gate.
- Use a versioned external feeder bundle containing search candidates, source documents and extraction proposals. Existing version-1 search-only input remains supported and produces suggestions only, never app events.
- One candidate can yield multiple separate events from a venue's official detail pages, bounded by per-run budgets. Initial configurable defaults: 20 candidates, 3 source pages per candidate, 40 total proposals, at most 100 KiB normalized text per document and 5 MiB per bundle, 1 retry for malformed extraction. Budget overflow becomes an explicit deferred item, not a silently truncated or checkpointed success. Search hints do not set factual field values.
- Permanent means ongoing availability subject to actual opening hours/closures, not guaranteed attendance every day in the sentinel range. UI changes are a separate follow-up; existing date displays may show literal sentinel years and this must be reviewed before end-user rollout.

## Stage ownership

| Stage | Owner | Output | Deterministic gate |
|---|---|---|---|
| Discover | Hermes search tools | Search candidate and discovery URL | Existing feeder validation/freshness |
| Resolve source | Hermes web tools | Specific official detail URL, publisher identity, source text and acquisition time | URL safety, document identity, evidence completeness; source legitimacy still reviewed in PR |
| Extract | Hermes configured model | Versioned proposal with factual fields and per-field evidence references | Strict schema; unknowns represented explicitly |
| Normalize/validate | Python | Ready record or needs_review/rejected result with reasons | Types, dates, ranges, enums, evidence references, required official support |
| Resolve identity | Python | New identity, existing identity, or possible duplicate | Stable source IDs/URLs and cross-source duplicate checks |
| Propose catalog | Existing Python refresh/PR runner | events.json additions/changes, review queue and evidence report | Staged write/rollback; latest-main and allowlisted staging checks |
| Approve/import | User | Merged catalog and later manual DB import | Human review; no automated DB side effects |

## Feeder and extraction contract

Use schema_version=2 for the extended bundle. Keep generated_at for the actual successful acquisition time. Candidate IDs are stable hashes of canonical discovery/detail identity, not timestamps, query order or result rank.

Version dispatch is explicit: absent schema_version or integer 1 follows the existing nonempty-keywords v1 contract and cannot supply catalog records; integer 2 follows the extraction contract; unknown versions or string versions fail closed. A v2 batch may have an empty keywords object when rechecking known/pending sources without new search hits. Each queued candidate must have exactly one terminal batch outcome: extracted, fetch_failed, needs_review or budget_deferred. A complete batch means all candidate outcomes are accounted for, not that every fetch succeeded. Finalize the bundle atomically only after schema validation. Duplicate candidate/proposal/document IDs, dangling references, unaccounted candidates, invalid outcome-specific objects, or references to another candidate's unassociated document abort the whole batch. A fetch_failed/deferred outcome has a reason and no ready proposal; it does not require an invented document or evidence.

Each proposal includes:

- candidate_id and a stable proposal_id within that candidate.
- record_kind: dated_event, permanent_venue or uncertain. This is intermediate metadata, not a new public JSON field or DB migration.
- discovery_url and official detail source_url; publisher/organizer identity; source-provided event ID when present.
- source_documents with document_id, final fetched URL, fetched_at, tool/source reference when available, content hash, and a bounded relevant text excerpt. Keep full fetched bodies outside Git. A fetched text hash is provenance, not proof of source ownership or model correctness.
- fields containing extracted factual values and explicit nulls for unknown optional fields.
- evidence_by_field referencing document_id plus source-text span/excerpt, extraction method and optional advisory confidence. Evidence must be from the actual detail-page content, not the search snippet.
- classification_evidence for record_kind, date interpretation and source legitimacy; blockers/ambiguities such as missing year or conflicting pages.

Python assigns final id, csv_sequence, dates for the permanent policy, acquisition/check date and catalog metadata. It rejects attempts by feeder/model output to overwrite those ownership-controlled fields. Do not blindly run normalize_raw_event() over LLM output: that function re-infers booleans/age ranges from text and can discard explicit extracted values. Introduce an explicit extraction adapter that reuses individual safe helpers where appropriate while preserving supported false and zero values.

Evidence text contract: the captured unit is the visible page text returned by the Hermes web tool, normalized to UTF-8, Unicode NFC and LF newlines. It is not the raw HTTP response body. Save that unit under the batch's fixed documents/ directory outside Git, with an application-generated document ID and Python-computed SHA-256. Bundle references use document IDs and relative document filenames only; resolve under the explicit batch root, reject traversal/symlink escape, and enforce the size limits before reading. Python checks the supplied hash against the exact delivered unit. Hermes supplies exact short quote strings, not trusted character offsets. Python locates an unambiguous quote and computes [start,end) Unicode-code-point offsets in that unit; a missing/ambiguous quote remains needs_review. Persist the final URL, fetched_at, hash, bounded evidence quote and computed span in the PR review artifact; keep the full text outside Git. Quote/hash agreement proves internal consistency of supplied material, not independent website ownership or factual authenticity. A supplied truncated document may support facts visible in it but cannot establish absence of a date/requirement from unseen text.

Minimal synthetic fixture shape (illustrative placeholders; implementation tests compute hashes from actual fixture text and fill the required field-evidence map):

```json
{
  "schema_version": 2,
  "batch_id": "fixture-batch",
  "generated_at": "2026-11-23T09:00:00+09:00",
  "queued_candidate_ids": ["venue-1"],
  "queue_sha256": "COMPUTED_FROM_ADJACENT_QUEUE_JSON",
  "keywords": {},
  "candidates": [{"candidate_id": "venue-1", "discovery_url": "https://venue.example/guide", "outcome": "extracted", "proposal_ids": ["admission-1"]}],
  "source_documents": [{"document_id": "doc-1", "candidate_ids": ["venue-1"], "url": "https://venue.example/guide", "fetched_at": "2026-11-23", "kind": "official_detail", "text_file": "documents/doc-1.txt", "text_sha256": "COMPUTED_FROM_FIXTURE_TEXT"}],
  "proposals": [{
    "proposal_id": "admission-1", "candidate_id": "venue-1",
    "record_kind": "permanent_venue", "source_url": "https://venue.example/guide", "source_document_ids": ["doc-1"],
    "fields": {"title": "Example museum admission", "venue_name": "Example museum", "region": "서울"},
    "authority": {"publisher_name": "Example museum", "role": "venue_operator", "evidence": {"document_id": "doc-1", "quote": "Example museum admission"}},
    "classification_evidence": {"document_id": "doc-1", "quote": "상설 운영"},
    "evidence_by_field": {"title": {"document_id": "doc-1", "quote": "Example museum admission"}}
  }]
}
```

The fixture's incomplete authority/location evidence is an intentional needs_review case once its placeholder hashes are replaced and the adjacent queue/text are supplied; syntactic validity alone never qualifies it for events.json. Complete runnable fixtures in tests/test_extracted_events.py demonstrate ready_for_pr and Python-assigned sentinel dates.

Authority handling: the existing discovery_official.py host list is only a hint for known official domains, not a universal authority registry. A new venue's domain must not be rejected merely for being new, nor accepted solely because Hermes sets official=true. Require publisher/venue identity and supporting official-page evidence; show unknown-domain/source-identity warnings prominently in the PR. If source ownership cannot be supported, keep the item needs_review. Schema/evidence checks do not mechanically prove that a website is official; user PR approval remains essential.

Web content is untrusted input: extraction instructions are fixed, source text is data, and model output never supplies shell commands, arbitrary output paths, Git instructions or tool configuration. Python does not become an arbitrary URL-fetching service; page access remains through the configured Hermes web tools. No provider calls or secrets go into committed evidence.

## Catalog field mapping

Preserve the current 30-field catalog contract. Populate factual values only from supported details; derived values carry derivation evidence in the intermediate proposal.

| Catalog fields | Policy |
|---|---|
| id, source, source_event_id | Python-controlled source identity; preserve existing native identities when matched. Extract only the source-provided ID as evidence. |
| csv_sequence | Preserve existing sequence; new records get the next available integer after all native/extracted records are combined. |
| title, venue_name, venue_detail | Specific event/venue details; no replacement of the event title with a generic search headline. At least a usable outing title and identifiable venue/location are required. |
| starts_at, ends_at | Actual dated-event period; same date for a confirmed single-day event. Confirmed permanent venue uses 1970-01-01/9999-12-31. Never use sentinel values to repair uncertain dated events. |
| region, locality, address | Official location information. Require region or address; derive locality only using explicit address evidence. Do not invent geographic data or geocode silently. |
| category | Deterministic mapping to current supported categories: performance, experience, play_space, exhibition, camp, class, festival, other; review unsupported/ambiguous classifications. |
| age_min_months, age_max_months | Convert only explicit age evidence using documented inclusive/exclusive units. Unspecified age is null, not zero or all-ages. |
| indoor, guardian_required, stroller_friendly, nursing_room, parking | True/false only when the source supports it. Explicit absence differs from unknown/null; never infer nursing rooms from the venue being child-oriented. |
| price_text, price_type | Preserve price wording; map to free/paid/unknown with evidence. Fees that depend on age/membership must not imply universally free access. |
| reservation_required, reservation_status | Explicit requirement and acquisition-time status; absent/ambiguous status is unknown. Do not claim real-time availability. |
| tags, summary | Conservative derived tags and short evidence-based summary. No amenities or age eligibility invented by paraphrasing. |
| source_url, last_checked_at | Specific supporting official detail URL and actual acquisition date. Never change acquisition dates merely because a cached proposal is reused. |
| created_at, updated_at | Preserve existing values; null for new records as in current refresh code. DB generates its own metadata later; ignore both during comparisons. |

## Date policy and compatibility

| Case | Result |
|---|---|
| Explicit finite period | Validate YYYY-MM-DD and chronological order; retain actual dates. |
| Explicit single-day event | Assign ends_at equal to the evidenced starts_at; report this derivation. |
| Confirmed permanent venue | Assign exactly 1970-01-01 and 9999-12-31; intermediate date_policy=permanent_sentinel. |
| Dated event missing a year/start/end, conflicting dates, or unclear permanence | needs_review; no guessed dates or sentinel fallback. |
| Seasonal, temporary or recurring limited-period activity | Use the supported finite window, or needs_review; it is not automatically permanent. |
| Existing venue with artificial rolling collector dates | No bulk migration under this plan. Native-only dates remain under their current collector until a separate explicit migration decision. |

Read-only compatibility checks already passed: Python date.fromisoformat accepts both sentinel strings; Node Date converts them to 1970-01-01T00:00:00.000Z (epoch zero) and 9999-12-31T00:00:00.000Z. Current importer date validation accepts the same format. Current Prisma dates are @db.Date and repository/query comparisons use ISO date strings; actual Postgres round-trip is unverified. Do not connect to DB to verify this planning task.

app/App.tsx currently joins raw dates in the event detail/share text (around line 3235) and formats startsAt in an event list (around line 4756). Therefore the sentinel range may be visible as literal years. No UI change is silently included here; before UI implementation, follow the required current/proposed image comparison and design audit workflow. The separate recommendation worktree must remain untouched.

## Identity, duplicates and precedence

1. Combine native normalized data and validated extraction proposals before one merge/sequence assignment. Do not run two independent merges against the same baseline.
2. Match explicit existing id or (source, source_event_id) when authoritative mapping is present; reject conflicts. Hermes does not assign a trusted internal id or rewrite source ownership.
3. For new external sources, derive a stable Python source key from canonical official publisher host/registry mapping. Prefer stable official event IDs. Otherwise create a persistent identity/alias record under data/discovery/identities.json keyed by specific official URL, venue and confirmed edition/kind. Dates and mutable titles must not be part of the immutable ID: a corrected date updates the same identity. Store later supported URL redirects/aliases against that identity. A reused URL or title that may identify a genuinely new edition goes to review unless an explicit authoritative edition identity distinguishes it; never silently merge two annual editions or generate a second ID simply because dates changed. Do not strip identity-bearing query parameters or treat a general home page as a unique event URL.
4. Cross-source comparison uses canonical detail URL and corroborating venue/date/title evidence. Same homepage alone is not a duplicate match. Fuzzy title/location matches go to possible_duplicate review, never automatic merging/deletion.
5. If native and extracted proposals target the same record in the same run, the native structured collector retains precedence. Conflicting extraction facts are shown for review instead of silently winning by list order.
6. Repeated extraction of the same semantic event must be idempotent despite different timestamps, confidence, query order, evidence text formatting or result rank.

## Rechecking discovered sources

Once an extracted source enters the catalog it has no source-specific collector, so it must not depend on being rediscovered by search. Build each run's extraction queue from (a) known external-source detail URLs and the identity registry on current main, (b) persisted pending/retryable review candidates, and (c) fresh search leads. Reserve initial budget slots for both rechecks/pending and fresh discovery (default 10 each; unused slots flow to the other group). Use a local operational checkpoint outside Git for attempt times/cursors so large queues rotate fairly and operational timestamps do not create PRs. User decisions/identity aliases and unresolved candidates remain committed review state; they are not erased by the local cursor or an absent later search result. Native sources retain their own collectors and source precedence. A failed recheck keeps the existing record and produces a retryable warning; it never deletes or overwrites it with missing facts. Tests must cover rotation, rediscovery absence, retries and changed-date identity stability.

## Validation states and failure handling

- ready_for_pr: required factual fields supported, valid schema/date policy and unambiguous identity. This means eligible for a proposed Git change, not factually infallible or auto-published.
- needs_review: incomplete required facts, uncertain permanence/source ownership, conflicts or possible duplicate; preserve structured fields and reasons outside the catalog.
- rejected: clearly unrelated/unsupported item or unsafe/malformed proposal; record a short reason without adding it to events.json.
- Source-page access failure on one candidate produces a retryable needs_review item and does not pretend it was successfully extracted. Other complete candidates may proceed. This differs from an invalid/stale whole feeder bundle or failed native refresh, which aborts the catalog update.
- A malformed/incomplete acquisition bundle, malformed global schema, missing promised source documents or whole-job failure aborts before any catalog/review checkpoint is replaced. Never reuse old results with a new generated_at date.
- Stable durable review state includes pending candidates and their reasons. Repeated failed candidates do not disappear merely because the next search omits them. Machine-generated observations and human decisions are separate; no overwrite of manual notes or historic PR reports.
- All candidate outcomes appear in an extraction review report. No top-N truncation after a candidate has already been accepted into the run; any budget-skipped leads remain pending for later work.

## Changes proposed for implementation

1. Add crawler/discovery/extraction_schema.py: schema/version/type validation, evidence references, dates/age/enums, exclusions and required-field gate. Export shared permanent-date constants.
2. Add crawler/discovery/extracted_events.py: extraction adapter, persistent identity/alias normalization, cross-source duplicate checks and ready/review results; add an extraction-queue builder for known external URLs, pending candidates and fresh search leads. Keep model calls out of Python.
3. Extend crawler/discovery/google_alerts.py with version-2 feeder support while preserving version-1 search-only behavior.
4. Extend crawler/babyroo_crawler/discovery_workflow.py to combine native and extracted records, resolve precedence once, preserve metadata/null semantics, and produce review/evidence outputs before atomic catalog replacement. Fix any identity/no-op issue exposed by mixed-source tests within this scope.
5. Extend scripts/event_refresh_pr.py for the versioned bundle and explicitly allowlisted extraction review/evidence files plus data/discovery/identities.json; main snapshot validation and no-auto-merge/DB behavior stay intact. Only semantic catalog/review/identity changes should cause a PR, not evidence timestamps, confidence drift, quote formatting or local queue-cursor updates. Use stable reason codes and canonical identities for review equality; retain detailed observations separately.
6. Add a versioned Hermes task template under crawler/prompts/discovery-extraction.md and revise crawler/README.md with the full search -> official page -> extraction -> Python gate -> PR flow and per-run budgets. Do not register a new skill, alter model credentials or install cron during code implementation.
7. Add fixtures/tests for dated events, single-day events, confirmed permanent venues, missing dates, ambiguous source identity, unknown optional fields, false/zero, source conflicts and cross-source duplicates. Keep evidence separate from public JSON and test that removed fields never return.
8. Update docs/crawler_plan.md only where extraction/schema/date contracts conflict with actual existing code (e.g. categories and required ends_at). Distinguish legacy publish from the current merged-baseline workflow; no redesign of known collectors or UI under this plan.

## Acceptance criteria

1. A new official dated event with sufficient evidence becomes one proposed catalog event with all 30 keys and correct typed values; no arbitrary model fields leak into JSON.
2. A confirmed permanent venue becomes a proposed record with exactly 1970-01-01/9999-12-31, evidence-backed permanence classification and documented date policy.
3. Missing/ambiguous dates do not trigger permanence defaults; required-evidence gaps remain review-only, optional unknowns remain null/unknown as specified.
4. Official-source facts/evidence can be reviewed from the PR. Search-only or secondary-only claims cannot qualify required fields. Unknown domains require source-identity evidence rather than the old fixed allowlist alone.
5. Stable IDs/sequences, native precedence and possible-duplicate review prevent duplicate app records across runs/sources. Incoming false/zero values are preserved.
6. No bulk date-policy migration of the existing 194 baseline records occurs; legitimate native-source content changes remain under the already approved refresh workflow. Missing/expired records and human notes are retained. All six ignored fields keep their agreed semantics; repeated unchanged extraction produces no PR.
7. Version-1 input remains search-suggestions-only. Version-2 valid proposals are merged; malformed/stale whole bundles fail before writes, and per-candidate source failure remains visible/retryable without invalid insertion.
8. Artifacts use allowlisted paths and retain previous reports; DB/API credentials, raw full pages and executable instructions never enter public JSON or staged PR data.
9. Relevant Python and mocked Node tests, sentinel parser/import-boundary checks and independent verification pass without DB/network writes. Live Hermes end-to-end dry-run remains explicitly pending until configured by the user.

## Verification strategy

- Offline unit fixtures cover valid/inconsistent dates, max-year boundary, affirmative permanence vs missing dates, all typed fields, exact evidence references and official/secondary source policy.
- Use mocked captured pages; verify absent quote/text evidence and forged/foreign document references cannot qualify a field. Do not claim matching evidence proves source authenticity.
- Mixed-source merge tests cover changed generated IDs, title edits, source-id conflicts, shared homepages, multiple events at one venue, native/extracted overlap, unknown fields, and null/false/zero semantics.
- Integration on a temporary copy of the current 194-event catalog: one ready new event, one permanent venue, one incomplete candidate, one possible duplicate; repeat run is semantically a no-op; source/candidate failures cannot corrupt the catalog.
- Mocked Git/gh runner checks cover new allowed artifacts, no-op evidence-only changes, no arbitrary staging, advanced main, per-run lock and failed push/PR creation.
- Import boundary tests validate sentinel strings and omitted DB-owned fields using mocked Prisma only. Retain actual-DB and UI-rendering gaps; do not change live data.

## Assignments and Model usage

| Workflow stage | Agent | Plugin / skill used | Model used | Reasoning level | Evidence |
|---|---|---|---|---|---|
| Plan | /root | grill-with-docs | Unknown | Unknown | Repository skill/docs/code read. User chose all outing types, permanent sentinels, official evidence. Exact active model/reasoning not exposed. |
| Review the plan | /root/extraction_plan_review | None | Unknown | Unknown | Approved after routine clarifications: stable date-correction identity/aliases, exact text/hash/span contract, recheck queue and strict feeder versions/budgets/fixture; addressed below. |
| Implement | /root | None | Unknown | Unknown | Implemented schema, evidence adapter, identity registry, queue/backlog, capture/finalize helpers, Hermes template and refresh integration. Preserved earlier uncommitted work; initial files checkpointed under /tmp/babyroo-extraction-start. Runtime model/reasoning unavailable. |
| Verify | /root/extraction_verify | None | Unknown | Unknown | Independent PASS: 95 Python tests, 5 mocked Node tests, four adversarial assertions, diff check and unchanged catalog/importer. Report: /tmp/babyroo-field-extraction-verification.md. Runtime model/reasoning unavailable. |
| Verify | /root | None | Unknown | Unknown | Final suite: 96 Python tests and 5 mocked Node tests pass; four adversarial assertions pass. Added full 194-record snapshot integration: two additions, existing records unchanged, 30 keys, unique IDs, permanent sentinels and byte-identical repeat no-op. Initial test invocation lacked required PYTHONPATH; corrected invocation passes. Runtime model/reasoning unavailable. |

## Independent plan review and resolutions

Independent reviewer /root/extraction_plan_review approved after four routine clarifications, all incorporated: persistent date-independent identity/edition aliases; exact normalized source-text/hash/quote/span contract and authenticity limits; rechecking known external URLs plus pending queue; explicit v1/v2/unknown-version handling, reference integrity, outcome-specific failures, numeric proposal budget and synthetic fixture. Corrected the app/App.tsx path and retained the separate sentinel-display caveat. Review evidence is /tmp/babyroo-extraction-plan-review.md. The user subsequently approved implementation.

## Implementation verification and remaining gaps

Independent verification exposed negated permanence/single-day wording, unsupported amenities/tags/categories, foreign-publisher identity evidence, reused source IDs across editions, lost queue backlog, lost human notes and self-reported queue omissions. All were corrected and covered by regression checks. The finalized bundle is bound to adjacent queue.json; its validated payload is installed atomically. Deferred leads persist in operational state. Unsupported claims remain review-only, and registry collisions never overwrite existing identity.

The current 194-event catalog and importer are byte-identical to their implementation-start snapshots. No live Hermes session, scheduler registration, GitHub push/PR, database import or app rendering was performed. The Hermes scheduled task must adopt crawler/prompts/discovery-extraction.md after the code is committed and merged. Sentinel dates can still appear literally in the current UI; display formatting remains a separate follow-up.

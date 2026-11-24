# Event baseline field exclusions

## Agreed requirements

The user explicitly requested that existing-event comparisons ignore image_url and admin_updated_at and that both fields be removed entirely from server/data/events.json. Remove these two keys from all 194 baseline records. Keep all other values, event order and top-level metadata identical. Do not mutate the DB, change imports, stage/commit, or alter unrelated working files.

Follow-up requirements: the user has also removed publication_status from the baseline; preserve that edit. Keep created_at and updated_at in events.json, but ignore both during existing-event change detection. The future comparison must exclude image_url, admin_updated_at, publication_status, created_at and updated_at from both baseline and refreshed records. No admin-edited/publication-status branching may rely on fields absent from this baseline. No comparator currently exists on main, so these are recorded scheduler requirements, not implemented runtime behavior.

No active scheduler/change detector exists on main; refresh_places.py remains on the separate discovery feature history. The future scheduler must explicitly exclude these two fields from both sides of its comparison, even if collectors return images. This task establishes the JSON contract and records that rule; it does not implement the unapproved wider scheduler workflow. Existing collectors and normalization may continue to hold image data for their own purposes.

## Acceptance criteria

- Exactly 194 records, with 30 exported fields each after the user's publication_status removal.
- image_url, admin_updated_at and publication_status do not appear on any event.
- created_at and updated_at remain present and unchanged; neither participates in future change detection.
- Every other field/value, event ordering and top-level count/generated_at is unchanged.
- No DB connection or DB write; existing main change detection is checked for additional required exclusions.
- Diff only contains the baseline field removals and this plan.

## Stages and assignments

1. Plan: /root; grill-with-docs requirements workflow already read in this task. The explicit field names and action resolve scope; no further interview needed.
2. Plan review: /root/baseline_fields_plan_review; None assigned. Confirm requirements, minimal diff and verification, without source edits.
3. Implement: /root; None assigned. Remove only requested keys while retaining JSON formatting.
4. Verify: /root/baseline_fields_verify; None assigned. Independently compare HEAD JSON to updated JSON with exactly these keys removed, and run git diff --check. No mirrored test files needed for one-time data edit.

## Model usage

| Workflow stage | Agent | Plugin / skill used | Model used | Reasoning level | Evidence |
|---|---|---|---|---|---|
| Plan | /root | grill-with-docs | Unknown | Unknown | Previously read repository skill; user explicitly defined both fields and requested removal. Runtime exact model/reasoning not exposed. |
| Plan (follow-up) | /root | None | Unknown | Unknown | User removed publication_status; requested ignoring updated_at and created_at for comparisons. Confirmed 194 x 30 fields, timestamps retained, no runtime comparator on main. JSON left untouched in follow-up. |
| Review the plan | /root/baseline_fields_plan_review | None | Unknown | Unknown | Approved: 194 records, exact field-removal verification; importer caveat identified below. |
| Implement | /root | None | Unknown | Unknown | Removed only the requested keys from all 194 records; remaining values/order/envelope preserved. |
| Verify | /root/baseline_fields_verify | None | Unknown | Unknown | PASS: exact HEAD-to-working-tree transform, 194 x 31 fields, both keys absent, all remaining values/order/metadata unchanged; git diff --check passed; only baseline + plan changed. |

## Review and verification

Independent plan reviewer approved scope. Independent verifier confirmed all acceptance criteria PASS. Important integration caveat: existing server/scripts/import-events.js maps omitted image_url to null, so running it against this reduced JSON could clear existing DB images. No importer or DB change is authorized by the explicit JSON edit; do not run the importer. Report this gap to the user before any future DB-sync work. Changes remain unstaged/uncommitted on main.

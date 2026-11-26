"""Staged event refresh against the approved main-branch catalog."""
from __future__ import annotations

import importlib
import json
import logging
import os
import tempfile
import uuid
from datetime import date
from pathlib import Path

from babyroo_crawler.normalize import normalize_raw_event
from babyroo_crawler.collection import CollectedEvents
from babyroo_crawler.dates import seoul_today
from babyroo_crawler.timing import timed_step

REMOVED_FIELDS = {"image_url", "admin_updated_at", "publication_status"}
IGNORED_FIELDS = REMOVED_FIELDS | {"created_at", "updated_at", "last_checked_at"}
SOURCES = ("seoul_culture", "seoul_childcare", "dikidiki", "namu",
           "nfm_kids", "seoul_family_venues", "seoul_kids_cafe")


def read_json(path: Path) -> dict:
    value = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(value, dict):
        raise ValueError(f"expected JSON object: {path}")
    return value


def identity(event: dict):
    return (event.get("source"), event["source_event_id"]) if event.get("source_event_id") else None


def comparable(event: dict) -> dict:
    return {k: v for k, v in event.items() if k not in IGNORED_FIELDS}


def legacy_namu_exhibition(baseline: list[dict], event: dict) -> dict | None:
    """Adopt a legacy slot identity only when it describes this same exhibition."""
    if event.get("source") != "namu":
        return None
    from sources.namu import exhibition_slot, make_exhibition_source_event_id
    slot = exhibition_slot(event["source_url"])
    if slot not in {"exhibition-event-current", "exhibition-special-current"}:
        return None
    expected = make_exhibition_source_event_id(event["source_url"], event["title"], event["starts_at"])
    if event.get("source_event_id") != expected:
        return None
    for old in baseline:
        if (old.get("source") == "namu" and old.get("source_event_id") == slot
                and make_exhibition_source_event_id(old["source_url"], old["title"], old["starts_at"]) == expected):
            return old
    return None


def validate_events(events: list[dict]) -> None:
    if not isinstance(events, list):
        raise ValueError("catalog must contain an event list")
    seen_ids, seen_pairs, seen_sequences = set(), set(), set()
    for event in events:
        if not isinstance(event, dict):
            raise ValueError("invalid event object")
        for key in ("id", "title", "source", "source_url"):
            if not isinstance(event.get(key), str) or not event[key].strip():
                raise ValueError(f"missing event {key}")
        for key in ("starts_at", "ends_at"):
            date.fromisoformat(event[key])
        if event["ends_at"] < event["starts_at"]:
            raise ValueError(f"reversed dates: {event['id']}")
        seq = event.get("csv_sequence")
        if seq is not None and (type(seq) is not int or seq < 1):
            raise ValueError("csv_sequence must be a positive integer or null")
        pair = identity(event)
        if event["id"] in seen_ids or (pair and pair in seen_pairs) or (seq is not None and seq in seen_sequences):
            raise ValueError(f"duplicate event identity/sequence: {event['id']}")
        seen_ids.add(event["id"])
        if pair:
            seen_pairs.add(pair)
        if seq is not None:
            seen_sequences.add(seq)


def merge_events(baseline: list[dict], incoming: list[dict], checked_sources: set[str]):
    validate_events(baseline)
    by_id = {e["id"]: e for e in baseline}
    by_pair = {identity(e): e for e in baseline if identity(e)}
    merged = [{k: v for k, v in e.items() if k not in REMOVED_FIELDS} for e in baseline]
    positions = {e["id"]: i for i, e in enumerate(baseline)}
    seen, seen_pairs, added, changed = set(), set(), [], []
    next_sequence = max((e.get("csv_sequence") or 0 for e in baseline), default=0) + 1
    for event in incoming:
        pair = identity(event)
        by_key = by_id.get(event["id"])
        by_source = by_pair.get(pair) if pair else None
        if by_key and by_source and by_key["id"] != by_source["id"]:
            raise ValueError("conflicting id/source identities")
        legacy = None if by_key or by_source else legacy_namu_exhibition(baseline, event)
        old = by_key or by_source or legacy
        if old and identity(old) != pair and not legacy:
            raise ValueError("source identity changed for existing event id")
        eid = old["id"] if old else event["id"]
        if eid in seen or (pair and pair in seen_pairs):
            raise ValueError(f"duplicate incoming identity: {eid}")
        seen.add(eid)
        if pair:
            seen_pairs.add(pair)
        current = dict(old or {})
        for key, value in event.items():
            if key not in IGNORED_FIELDS | {"id", "csv_sequence"} and (value is not None or old is None):
                current[key] = value
        current["id"] = eid
        for key in REMOVED_FIELDS:
            current.pop(key, None)
        if old:
            fields = {key: {"before": old.get(key), "after": current.get(key)}
                      for key in sorted(comparable(old).keys() | comparable(current).keys())
                      if old.get(key) != current.get(key)}
            if fields:
                current["last_checked_at"] = event.get("last_checked_at")
                changed.append({"id": eid, "title": current["title"], "fields": fields})
            merged[positions[eid]] = current
        else:
            current.update(csv_sequence=next_sequence, created_at=None, updated_at=None,
                           last_checked_at=event.get("last_checked_at"))
            next_sequence += 1
            merged.append(current)
            added.append(current)
    validate_events(merged)
    missing = [{"id": e["id"], "title": e["title"], "source": e["source"], "source_url": e["source_url"]}
               for e in baseline if e["source"] in checked_sources and e["id"] not in seen]
    return merged, added, changed, sorted(missing, key=lambda e: e["id"])


def collect_native(staging: Path) -> tuple[list[dict], set[str]]:
    events, checked = [], set()
    for source in SOURCES:
        try:
            with timed_step("collector." + source):
                collector = importlib.import_module("sources." + source).collect
                # No page cap for the full replacement kids-cafe collector.
                rows = collector(output_path=staging / f"{source}.json")
                if not isinstance(rows, list) or (not rows and not (
                        isinstance(rows, CollectedEvents) and isinstance(rows.verified_empty_reason, str)
                        and rows.verified_empty_reason.strip())):
                    raise ValueError("empty or malformed collection; needs operator review")
                if not rows:
                    logging.getLogger(__name__).info("%s: verified empty collection (%s)",
                                                     source, rows.verified_empty_reason)
                for raw in rows:
                    if not isinstance(raw, dict) or raw.get("source") != source:
                        raise ValueError("collector returned wrong source or invalid raw record")
                    events.append(normalize_raw_event(raw).to_dict())
                checked.add(source)
        except Exception as exc:
            raise ValueError(f"collection failed for {source}: {exc}") from exc
    return events, checked


def report_text(added, changed, review, acquisition_date) -> str:
    # Use JSON blocks for values so source-provided Markdown cannot impersonate headings.
    parts = ["# Event refresh review", "", "Review before merge; DB import is manual.",
             f"External feeder acquisition date: {acquisition_date or 'native sources only'}", ""]
    sections = [("New catalog events", added), ("Changed fields", changed),
                        ("Missing from checked sources (retained)", review["missing"]),
                        ("Discovery suggestions (not app events)", review["candidates"])]
    if "extractions" in review:
        sections.append(("Extraction outcomes (official evidence still requires PR review)", review["extractions"]))
    if review.get("expired"):
        sections.append(("Expired events (excluded from catalog)", review["expired"]))
    for title, rows in sections:
        encoded = json.dumps(rows, ensure_ascii=False, indent=2).replace("`", "\\u0060")
        parts += ["## " + title, "", "```json", encoded, "```", ""]
    parts += ["Discovery links and feeder-provided venue links require manual source verification.", ""]
    return "\n".join(parts)


def refresh(root: Path, feeder=None, max_age_days=8, native_collector=None, today=None) -> dict:
    from crawler.discovery.google_alerts import sample
    from crawler.discovery.extracted_events import adapt_extractions
    catalog_path = root / "server/data/events.json"
    today = today or seoul_today()
    date.fromisoformat(today)
    state_path = root / "data/discovery/review.json"
    identity_path = root / "data/discovery/identities.json"
    baseline = read_json(catalog_path)
    validate_events(baseline.get("events"))
    if baseline.get("count") != len(baseline["events"]):
        raise ValueError("catalog count does not match events")
    discovery = sample(Path(feeder), max_age_days=max_age_days) if feeder else {"candidates": []}
    old_review = read_json(state_path) if state_path.exists() else {"missing": [], "candidates": []}
    # Keep excluded records in review history, not the active catalog. This also
    # preserves IDs/sequences if an official correction extends an ended event.
    active_ids = {e["id"] for e in baseline["events"]}
    merge_baseline = [*baseline["events"], *[e for e in old_review.get("expired", []) if e["id"] not in active_ids]]
    validate_events(merge_baseline)
    old_identities = read_json(identity_path) if identity_path.exists() else {"schema_version": 1, "entries": []}
    identities, outcomes, observations = old_identities, [], []
    with tempfile.TemporaryDirectory(prefix="babyroo-collect-") as tmp:
        incoming, checked = (native_collector or collect_native)(Path(tmp))
        complete, incomplete = [], []
        for row in incoming:
            if row.get("starts_at") is None or row.get("ends_at") is None:
                # An announcement/recurring-program page is not a dated event.
                # Keep a durable lead for review; never fabricate its dates or
                # replace a complete baseline record with an incomplete one.
                incomplete.append({"discovery_url": row["source_url"],
                    "venue_name": row.get("venue_name") or row["title"],
                    "title": row["title"], "source": row["source"],
                    "source_event_id": row.get("source_event_id"),
                    "reason": "missing_event_dates", "keyword": "native:" + row["source"],
                    "locality": row.get("locality") or "", "address": row.get("address") or "",
                    "snippet": row.get("summary") or "", "official_url": None})
            else:
                complete.append(row)
        incoming = complete
        if "extraction_bundle" in discovery:
            with timed_step("evidence.validation"):
                extracted, outcomes, identities, observations = adapt_extractions(
                    discovery["extraction_bundle"], merge_baseline, incoming, old_identities, set(SOURCES),
                    [*old_review.get("extractions", []), *old_review.get("candidates", [])])
            incoming = [*incoming, *extracted]
        with timed_step("catalog.merge"):
            merged, added, changed, missing = merge_events(merge_baseline, incoming, checked)
        expired = [e for e in merged if e["ends_at"] < today]
        expired_ids = {e["id"] for e in expired}
        merged = [e for e in merged if e["id"] not in expired_ids]
        added = [e for e in added if e["id"] not in expired_ids]
        changed = [e for e in changed if e["id"] not in expired_ids]
        missing = [e for e in missing if e["id"] not in expired_ids]
        for outcome in [*outcomes, *observations]:
            if outcome.get("event_id") in expired_ids:
                outcome["status"] = "excluded"
                outcome["reasons"] = sorted(set([*outcome.get("reasons", []), "event_ended"]))
    # Durable review state is not the latest search snapshot. Preserve pending leads and human notes.
    candidates = {c["discovery_url"]: c for c in old_review.get("candidates", [])}
    candidates.update({c["discovery_url"]: {**candidates.get(c["discovery_url"], {}), **c}
                       for c in [*incomplete, *discovery["candidates"]]})
    review = {**old_review, "missing": missing, "candidates": [candidates[k] for k in sorted(candidates)]}
    if expired or "expired" in old_review:
        history = {e["id"]: e for e in old_review.get("expired", [])}
        for e in expired:
            history[e["id"]] = e
        # A corrected/extended event may become eligible again.
        for e in merged:
            history.pop(e["id"], None)
        review["expired"] = [history[k] for k in sorted(history)]
    if outcomes or "extractions" in old_review:
        # New batch outcomes replace machine observations for its candidates; absent pending items survive.
        processed = set(discovery.get("extraction_bundle", {}).get("candidates_by_id", {}))
        incoming_keys = {(r["candidate_id"], r.get("proposal_id")) for r in outcomes}
        prior = []
        for row in old_review.get("extractions", []):
            key = (row["candidate_id"], row.get("proposal_id"))
            if row["candidate_id"] not in processed:
                prior.append(row)
            elif key not in incoming_keys and any(k in row for k in ("operator_notes", "decision")):
                prior.append({**row, "historical": True})
        notes = {(r["candidate_id"], r.get("proposal_id")): r for r in old_review.get("extractions", [])}
        candidate_notes = {r["candidate_id"]: r for r in old_review.get("extractions", []) if r.get("proposal_id") is None}
        updated = [{**{k: v for k, v in notes.get((r["candidate_id"], r.get("proposal_id")), {}).items()
                       if k in {"operator_notes", "decision"}}, **r} for r in outcomes]
        for row in updated:
            for key in ("operator_notes", "decision"):
                if key not in row and key in candidate_notes.get(row["candidate_id"], {}):
                    row[key] = candidate_notes[row["candidate_id"]][key]
        review["extractions"] = sorted([*prior, *updated], key=lambda r: (r["candidate_id"], r.get("proposal_id") or ""))
        for index, outcome in enumerate(review["extractions"]):
            if outcome.get("event_id") in expired_ids and outcome.get("status") == "ready_for_pr":
                review["extractions"][index] = {**outcome, "status": "excluded",
                    "reasons": sorted(set([*outcome.get("reasons", []), "event_ended"]))}
    catalog_changed = merged != baseline["events"]
    if not catalog_changed and review == old_review and identities == old_identities:
        return {"changed": False, "added": 0, "updated": 0, "incomplete_native": len(incomplete)}
    payload = {**baseline, "count": len(merged), "events": merged}
    if catalog_changed:
        payload["generated_at"] = today
    report_path = root / "data/discovery/reports" / f"refresh-{uuid.uuid4().hex}.md"
    writes = {state_path: json.dumps(review, ensure_ascii=False, indent=2) + "\n",
              report_path: report_text(added, changed, review, discovery.get("fetched_at"))}
    sql_paths = {}
    if catalog_changed:
        from babyroo_crawler.db_sql import generate_sql
        with timed_step("sql.generate"):
            sql = generate_sql(merge_baseline, added, changed, expired)
        sql_path = report_path.with_suffix(".sql")
        writes[sql_path] = sql
        sql_paths["apply"] = str(sql_path.relative_to(root))
        writes[report_path] += ("\n## Manual database application\n\n"
            "No schema changes (DDL) required. Review and run `" + sql_path.name +
            "` in PostgreSQL. New events are published only when the operator executes "
            "this file. Existing image/publication/admin fields are preserved; ended "
            "published events are archived. No SQL is executed by the job.\n")

    if identities != old_identities:
        writes[identity_path] = json.dumps(identities, ensure_ascii=False, indent=2) + "\n"
    if observations:
        evidence_path = report_path.with_name(report_path.name.replace("refresh-", "extraction-")).with_suffix(".json")
        writes[evidence_path] = json.dumps({"batch_id": discovery["extraction_bundle"]["batch_id"],
                                          "observations": observations}, ensure_ascii=False, indent=2) + "\n"
    if catalog_changed:
        writes[catalog_path] = json.dumps(payload, ensure_ascii=False, indent=2) + "\n"
    # Prepare every output first. Roll back installed files if any replace fails.
    prepared, originals = {}, {}
    try:
        for path, content in writes.items():
            path.parent.mkdir(parents=True, exist_ok=True)
            originals[path] = path.read_bytes() if path.exists() else None
            with tempfile.NamedTemporaryFile(dir=path.parent, delete=False) as stream:
                prepared[path] = Path(stream.name)
                stream.write(content.encode("utf-8"))
        installed = []
        try:
            for path, temp in prepared.items():
                os.replace(temp, path)
                installed.append(path)
        except Exception:
            for path in reversed(installed):
                if originals[path] is None:
                    path.unlink(missing_ok=True)
                else:
                    path.write_bytes(originals[path])
            raise
    finally:
        for temp in prepared.values():
            temp.unlink(missing_ok=True)
    return {"changed": True, "added": len(added), "updated": len(changed),
            "missing": len(missing), "excluded_expired": len(expired),
            "incomplete_native": len(incomplete), "report": str(report_path.relative_to(root)),
            "db_sql": sql_paths}

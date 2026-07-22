from __future__ import annotations

from datetime import date
from pathlib import Path
from typing import Any

from babyroo_crawler.io import list_json_files, read_json, write_json
from babyroo_crawler.normalize import normalize_raw_event


ROOT = Path(__file__).resolve().parents[2]
DATA_DIR = ROOT / "data"
RAW_DIR = DATA_DIR / "raw"
NORMALIZED_DIR = DATA_DIR / "normalized"
PUBLIC_DIR = ROOT / "public"


def normalize_all(raw_dir: Path = RAW_DIR, normalized_dir: Path = NORMALIZED_DIR) -> list[dict]:
    normalized_events = []
    age_warnings = []
    for path in list_json_files(raw_dir):
        raw_doc = read_json(path)
        raw_events = raw_doc if isinstance(raw_doc, list) else raw_doc.get("events", [])
        for raw_event in raw_events:
            normalized = normalize_raw_event(raw_event).to_dict()
            normalized_events.append(normalized)
            age_warning = make_age_normalization_warning(raw_event, normalized)
            if age_warning:
                age_warnings.append(age_warning)

    normalized_events = sorted(
        deduplicate(normalized_events),
        key=lambda event: (event.get("starts_at") or "9999-99-99", event.get("title") or ""),
    )
    write_json(normalized_dir / "events.json", {"events": normalized_events})
    write_json(
        normalized_dir / "normalize_report.json",
        {
            "input_count": len(normalized_events),
            "age_warning_count": len(age_warnings),
            "age_warnings": age_warnings,
        },
    )
    return normalized_events


def make_age_normalization_warning(raw_event: dict[str, Any], normalized_event: dict[str, Any]) -> dict | None:
    payload = raw_event.get("payload", {})
    age_text = payload.get("age_text")
    if not age_text:
        return None
    if normalized_event.get("age_min_months") is not None or normalized_event.get("age_max_months") is not None:
        return None
    return {
        "source": raw_event.get("source"),
        "source_event_id": raw_event.get("source_event_id"),
        "title": raw_event.get("title") or payload.get("title"),
        "source_url": raw_event.get("url") or payload.get("url"),
        "age_text": age_text,
        "reason": "unsupported_age_text_format",
    }


def publish(
    normalized_dir: Path = NORMALIZED_DIR,
    public_dir: Path = PUBLIC_DIR,
    today: str | None = None,
) -> dict:
    normalized = read_json(normalized_dir / "events.json")
    today = today or date.today().isoformat()
    normalized_events = normalized.get("events", [])
    events = [event for event in normalized_events if is_public_event(event, today)]
    payload = {
        "generated_at": today,
        "count": len(events),
        "events": events,
    }
    write_json(public_dir / "events.json", payload)
    write_json(
        normalized_dir / "publish_report.json",
        make_publish_report(normalized_events, events, today),
    )
    return payload


def is_public_event(event: dict[str, Any], today: str) -> bool:
    return not public_exclusion_reasons(event, today)


def public_exclusion_reasons(event: dict[str, Any], today: str) -> list[str]:
    reasons = []
    required_fields = ["title", "starts_at", "source", "source_url", "last_checked_at"]
    for field in required_fields:
        if not event.get(field):
            reasons.append(f"missing_{field}")

    if not event.get("region") and not event.get("address"):
        reasons.append("missing_location")

    ends_at = event.get("ends_at") or event.get("starts_at")
    if isinstance(ends_at, str) and ends_at < today:
        reasons.append("ended")

    return reasons


def make_publish_report(
    normalized_events: list[dict],
    published_events: list[dict],
    today: str,
) -> dict:
    excluded = []
    for event in normalized_events:
        reasons = public_exclusion_reasons(event, today)
        if not reasons:
            continue
        excluded.append(
            {
                "id": event.get("id"),
                "title": event.get("title"),
                "source": event.get("source"),
                "source_url": event.get("source_url"),
                "reasons": reasons,
            }
        )

    return {
        "generated_at": today,
        "input_count": len(normalized_events),
        "published_count": len(published_events),
        "excluded_count": len(excluded),
        "excluded": excluded,
    }


def deduplicate(events: list[dict]) -> list[dict]:
    seen = set()
    result = []
    for event in events:
        key = event.get("id")
        if key in seen:
            continue
        seen.add(key)
        result.append(event)
    return result

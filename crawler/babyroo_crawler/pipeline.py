from __future__ import annotations

from pathlib import Path

from babyroo_crawler.io import list_json_files, read_json, write_json
from babyroo_crawler.normalize import normalize_raw_event


ROOT = Path(__file__).resolve().parents[2]
DATA_DIR = ROOT / "data"
RAW_DIR = DATA_DIR / "raw"
NORMALIZED_DIR = DATA_DIR / "normalized"
PUBLIC_DIR = ROOT / "public"


def normalize_all(raw_dir: Path = RAW_DIR, normalized_dir: Path = NORMALIZED_DIR) -> list[dict]:
    normalized_events = []
    for path in list_json_files(raw_dir):
        raw_doc = read_json(path)
        raw_events = raw_doc if isinstance(raw_doc, list) else raw_doc.get("events", [])
        for raw_event in raw_events:
            normalized_events.append(normalize_raw_event(raw_event).to_dict())

    normalized_events = sorted(
        deduplicate(normalized_events),
        key=lambda event: (event.get("starts_at") or "9999-99-99", event.get("title") or ""),
    )
    write_json(normalized_dir / "events.json", {"events": normalized_events})
    return normalized_events


def publish(normalized_dir: Path = NORMALIZED_DIR, public_dir: Path = PUBLIC_DIR) -> dict:
    normalized = read_json(normalized_dir / "events.json")
    events = normalized.get("events", [])
    payload = {
        "generated_at": __import__("datetime").date.today().isoformat(),
        "count": len(events),
        "events": events,
    }
    write_json(public_dir / "events.json", payload)
    return payload


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


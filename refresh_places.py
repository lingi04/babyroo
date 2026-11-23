#!/usr/bin/env python3
"""Babyroo place tracker (data-tracker): refresh + change report + recommendation.

Flow (no auto-publish/upload):
  1. Native crawler sources (crawler/sources/*) -> raw
  2. Discovery channels (crawler/discovery/*) -> raw candidates
  3. normalize -> data/normalized/events.json
  4. publish   -> server/data/events.json
  5. delta     vs previous manifest (data/.last_publish.json)  -> NEW/CHANGED/REMOVED
  6. recommendation sheet (data/discovery_candidates.md) -> human review + manual input

The human reviews the report and edits the candidates file, then (on
approval) the upload/import step runs.  Nothing publishes or imports here.

Run:
    cd /opt/data/babyroo
    PYTHONPATH=crawler python3 refresh_places.py            # native only
    PYTHONPATH=crawler python3 refresh_places.py --with-discovery  # + instagram

Schedule (weekly Sunday evening):
    0 18 * * 0 cd /opt/data/babyroo && PYTHONPATH=crawler python3 refresh_places.py --with-discovery >> data/refresh.log 2>&1
"""
from __future__ import annotations

import argparse
import json
import sys
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT / "crawler"))

from babyroo_crawler.pipeline import normalize_all, publish  # noqa: E402
from crawler.discovery.google_alerts import sample as google_alerts_sample  # noqa: E402
from crawler.discovery.instagram import sample as instagram_sample  # noqa: E402
from crawler.discovery.channels import list_channels, collect  # noqa: E402

# Native collector functions (one per source), matching crawler cli.py order.
def _seoul_culture() -> list[dict]:
    return __import__("crawler.sources.seoul_culture", fromlist=["collect"]).collect(max_pages=3)


def _childcare() -> list[dict]:
    return __import__("crawler.sources.seoul_childcare", fromlist=["collect"]).collect(months=2)


def _dikidiki() -> list[dict]:
    return __import__("crawler.sources.dikidiki", fromlist=["collect"]).collect()


def _namu() -> list[dict]:
    return __import__("crawler.sources.namu", fromlist=["collect"]).collect()


def _nfm_kids() -> list[dict]:
    return __import__("crawler.sources.nfm_kids", fromlist=["collect"]).collect()


def _family_venues() -> list[dict]:
    return __import__("crawler.sources.seoul_family_venues", fromlist=["collect"]).collect()


def _kids_cafe() -> list[dict]:
    return __import__("crawler.sources.seoul_kids_cafe", fromlist=["collect"]).collect(max_pages=2)


NATIVE_SOURCES = [
    ("seoul_culture", _seoul_culture),
    ("childcare", _childcare),
    ("dikidiki", _dikidiki),
    ("namu", _namu),
    ("nfm_kids", _nfm_kids),
    ("family_venues", _family_venues),
    ("kids_cafe", _kids_cafe),
]

MANIFEST = ROOT / "data" / ".last_publish.json"
CANDIDATES_MD = ROOT / "data" / "discovery_candidates.md"

# Snapshotted fields for change detection vs published events.json.
SNAPSHOT_KEYS = [
    "id", "title", "venue_name", "address", "locality", "region", "category",
    "source", "source_event_id", "starts_at", "ends_at", "age_min_months",
    "age_max_months", "indoor", "price_text", "price_type",
    "reservation_required", "reservation_status", "tags", "summary",
    "source_url", "last_checked_at",
]


def snap(event: dict) -> dict:
    return {k: event.get(k) for k in SNAPSHOT_KEYS}


def load_state() -> dict:
    if MANIFEST.exists():
        try:
            data = json.loads(MANIFEST.read_text(encoding="utf-8"))
        except Exception:
            return {"at": None, "events": {}}
    else:
        data = {"at": None, "events": {}}

    # Old format saved by the previous script: {"at":..., "ids": [..]}.
    ids = data.get("ids")
    if isinstance(ids, list):
        return {"at": data.get("at"), "events": {eid: {} for eid in ids}}
    return data.get("events", {})


def save_state(state: dict) -> None:
    MANIFEST.write_text(json.dumps(state, ensure_ascii=False, sort_keys=True), encoding="utf-8")


def recommend(events: list[dict], limit: int = 25) -> list[dict]:
    """Generic kid-relevance score for newly added native events + discovery."""
    scored = []
    for e in events:
        if not e:
            continue
        score = 0
        age = e.get("age_min_months") or e.get("age_max_months")
        if age is not None and 0 <= age <= 36:
            score += 2
        elif age is None:
            score += 1
        if e.get("price_type") == "free":
            score += 3
        elif e.get("price_type") == "paid":
            score += 1
        if e.get("indoor") is True:
            score += 2
        if e.get("tags") and any("24개월이하" in t for t in e["tags"]):
            score += 3
        if e.get("reservation_status") not in ("closed", "limited"):
            score += 1
        if e.get("region") == "서울":
            score += 1
        scored.append((score, e))

    scored.sort(key=lambda x: (-x[0], x[1].get("title") or ""))
    out = []
    for _, e in scored[:limit]:
        out.append({
            "id": e.get("id"),
            "title": e.get("title"),
            "venue_name": e.get("venue_name"),
            "locality": e.get("locality"),
            "category": e.get("category"),
            "price_text": e.get("price_text"),
            "reservation_status": e.get("reservation_status"),
            "source": e.get("source"),
            "snippet": f"{e.get('starts_at')}~{e.get('ends_at')} | {', '.join(e.get('tags') or [])}",
        })
    return out


def write_candidates_md(rec: list[dict], removed: list[dict], discovery: list[dict] | None = None) -> None:
    lines = [
        "# Babyroo 후보 추천 시트 (수동 입력용)",
        f"생성일: {date.today().isoformat()}",
        "아래 필드를 앱에서 `이벤트 추가/수동 입력` 때 복사해 쓰세요. 반드시 미리 확인하고 필요한 줄만 남기세요.",
        "",
        "```md",
    ]
    if rec:
        for i, r in enumerate(rec, 1):
            lines += [
                f"- [{i}] **{r['title']}**",
                f"  장소: {r['venue_name']}",
                f"  지역: {r['locality']}",
                f"  카테고리: {r['category']}",
                f"  가격: {r['price_text']}",
                f"  예약상태: {r['reservation_status']}",
                f"  출처: {r['source']}",
                f"  메모: {r['snippet']}",
            ]
    else:
        lines.append("- 설정할 신규 후보 없음")
    lines += ["```"]

    if discovery:
        lines += ["", "## 신규 발굴(수동 입력)"]
        if discovery:
            for i, c in enumerate(discovery, 1):
                lines += [
                    f"- [{i}] **{c.get('venue_name')}**",
                    f"  장소: {c.get('venue_name')}",
                    f"  지역: {c.get('locality')}",
                    f"  주소: {c.get('address')}",
                    f"  출처: {c.get('source')}",
                    f"  키워드: {c.get('keyword')}",
                    f"  메모: {c.get('snippet')}",
                    f"  공식 URL: {c.get('official_url') or c.get('url')}",
                    f"  발견 URL: {c.get('discovery_url')}",
                    f"  방법: 인스타 수동/검색트렌드",
                ]
        else:
            lines.append("- 신규 발굴 후보 없음")

    lines += ["```", "", "## 제거된(공개에서 제외된) 항목", ""]
    if removed:
        for r in removed:
            lines += [f"- {r.get('title')} | {r.get('venue_name')} | {r.get('locality')}"]
    else:
        lines.append("- 없음")
    lines += ["", '이 파일은 사람이 읽고 수정하는 용도입니다. API에 자동 업로드하지 마세요.']
    CANDIDATES_MD.write_text("\n".join(lines), encoding="utf-8")


def main() -> int:
    parser = argparse.ArgumentParser(description="Babyroo place tracker (change report + recommendation)")
    parser.add_argument("--with-discovery", action="store_true", help="include discovery channels (e.g. instagram)")
    args = parser.parse_args()

    from crawler.discovery.channels import collect, list_channels  # noqa: E402
    from crawler.discovery.instagram import sample as instagram  # noqa: E402

    old_state = load_state()
    old_events = old_state.get("events", {})
    old_ids = set(old_events.keys())

    # 1. native sources
    for name, fn in NATIVE_SOURCES:
        try:
            events = fn()
            print(f"[native] {name}: {len(events)} events")
        except Exception as exc:  # keep going even if one source breaks
            print(f"[native] {name}: FAILED ({exc})", file=sys.stderr)

    # 2. discovery channels (optional)
    discovery = []
    if args.with_discovery:
        for name in list_channels():
            try:
                sample = collect(name)
                discovery.extend(sample.get("candidates", []))
                print(f"[discovery] {name}: {len(sample.get('candidates', []))} candidates")
            except Exception as exc:  # noqa: BLE001
                print(f"[discovery] {name}: FAILED ({exc})", file=sys.stderr)

    # 3-4. normalize + publish (native only)
    normalized = normalize_all()
    payload = publish()
    new_events = payload.get("events", [])
    new_by_id = {e.get("id"): e for e in new_events}
    new_ids = set(new_by_id)

    # 5. delta vs previous manifest
    added = [e for e in new_events if e.get("id") not in old_ids]
    updated = {}
    for e in new_events:
        eid = e.get("id")
        if eid in old_ids and snap(e) != snap(old_events.get(eid)):
            updated[eid] = (old_events.get(eid), e)
    removed = [old_events[eid] for eid in sorted(old_ids - new_ids)]

    state = {"at": date.today().isoformat(), "events": {eid: snap(e) for eid, e in new_by_id.items()}}
    save_state(state)

    # 6. recommendation + manual-input sheet
    rec = recommend(added, limit=25)
    write_candidates_md(rec, removed, discovery)

    # 7. report to user (no upload)
    print(f"[done] normalized={len(normalized)} published={len(new_events)} discovery={len(discovery)}")
    print(f"[delta] added={len(added)} updated={len(updated)} removed={len(removed)}")

    if added:
        print("\n[NEW native]")
        for e in sorted(added, key=lambda x: x.get("title") or ""):
            print(f"  - {e.get('title')} | {e.get('venue_name')} | {e.get('locality')} | {e.get('price_text')} | @{e.get('source')}")

    if discovery:
        print("\n[discovery candidates] (manual_input)")
        for c in discovery:
            print(f"  - ({c.get('method')}) {c.get('venue_name')} | {c.get('locality')} | {c.get('snippet')}")

    if updated:
        print("\n[CHANGED]")
        for eid, (old, cur) in sorted(updated.items()):
            print(f"  - [{eid}] {old.get('title')} -> {cur.get('title')}")

    if removed:
        print("\n[REMOVED]")
        for e in removed:
            print(f"  - {e.get('title')} | {e.get('venue_name')} | {e.get('locality')}")

    print(f"\n후보 시트 작성: {CANDIDATES_MD}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

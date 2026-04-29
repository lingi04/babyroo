from __future__ import annotations

from babyroo_crawler.io import write_json
from babyroo_crawler.models import RawEvent, today_iso
from babyroo_crawler.pipeline import RAW_DIR


def collect() -> None:
    captured_at = today_iso()
    events = [
        RawEvent(
            source="manual_sample",
            source_event_id="sample-001",
            title="아기와 함께하는 감각놀이 체험",
            url="https://example.com/events/sample-001",
            captured_at=captured_at,
            payload={
                "title": "아기와 함께하는 감각놀이 체험",
                "description": "12개월 이상 영유아와 보호자가 함께 참여하는 실내 감각놀이 체험입니다. 사전예약 필요.",
                "category": "체험",
                "starts_at": "2026-05-10",
                "ends_at": "2026-05-10",
                "region": "서울",
                "venue_name": "샘플 육아지원센터",
                "address": "서울시 샘플구 샘플로 1",
                "age_text": "12개월 이상 36개월 이하",
                "price_text": "무료",
                "tags": ["비오는날"],
            },
        ).to_dict()
    ]
    write_json(RAW_DIR / "manual_sample.json", {"events": events})
    print(f"collected {len(events)} sample events")


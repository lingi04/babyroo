from __future__ import annotations

import json
import re
from datetime import date, timedelta
from pathlib import Path
from typing import Any, Callable
from urllib.request import Request, urlopen

from babyroo_crawler.io import write_json
from babyroo_crawler.models import RawEvent, today_iso
from babyroo_crawler.pipeline import RAW_DIR


BASE_URL = "https://dikidiki.co.kr"
API_BASE_URL = "https://api-d1.o2meet-g.kr/v1/diki/workshop"
WORKSHOP_API_URL = f"{API_BASE_URL}/workshop"
SOURCE = "dikidiki"
USER_AGENT = "BabyrooCrawler/0.1"
VENUE_NAME = "디키디키"
VENUE_ADDRESS = "서울특별시 중구 을지로 281 동대문디자인플라자(DDP) 뮤지엄 4층 디키디키"


def collect(
    output_path: Path | None = None,
    fetch_json: Callable[[str], dict[str, Any]] | None = None,
    captured_at: str | None = None,
) -> list[dict[str, Any]]:
    fetch_json = fetch_json or fetch_json_url
    output_path = output_path or RAW_DIR / f"{SOURCE}.json"
    captured_at = captured_at or today_iso()

    events = [make_admission_event(captured_at)]
    events.extend(make_workshop_events(fetch_json(WORKSHOP_API_URL), captured_at))

    write_json(
        output_path,
        {
            "source": SOURCE,
            "captured_at": captured_at,
            "source_url": BASE_URL,
            "events": events,
        },
    )
    return events


def make_admission_event(captured_at: str) -> dict[str, Any]:
    return RawEvent(
        source=SOURCE,
        source_event_id="admission",
        title="디키디키 입장",
        url=f"{BASE_URL}/use_info.do",
        captured_at=captured_at,
        payload={
            "item_type": "venue_admission",
            "title": "디키디키 입장",
            "description": (
                "DDP 뮤지엄 4층 실내 디자인 놀이터. "
                "만 24개월 이상부터 만 8세까지 이용 가능하며 보호자 동반 입장."
            ),
            "category": "실내놀이",
            "starts_at": captured_at,
            "ends_at": future_date(captured_at, days=180),
            "region": "서울",
            "locality": "중구",
            "venue_name": VENUE_NAME,
            "address": VENUE_ADDRESS,
            "age_text": "만 24개월 이상 ~ 만 8세까지",
            "price_text": "어린이 2시간 18,000원, 보호자 5,000원",
            "reservation_status": "unknown",
            "notes": "운영시간 화-일 10:30~18:30. 휴관일 매주 월요일.",
            "tags": ["실내", "보호자동반"],
        },
    ).to_dict()


def make_workshop_events(raw: dict[str, Any], captured_at: str) -> list[dict[str, Any]]:
    events = []
    for item in raw.get("list", []):
        source_event_id = str(item.get("workshopSeq") or "").strip()
        title = clean_string(item.get("workshopTitle"))
        if not source_event_id or not title:
            continue

        events.append(
            RawEvent(
                source=SOURCE,
                source_event_id=f"workshop-{source_event_id}",
                title=title,
                url=f"{BASE_URL}/workshop_detail.do?seq={source_event_id}",
                captured_at=captured_at,
                payload={
                    "item_type": "program",
                    "title": title,
                    "description": make_workshop_description(item),
                    "category": item.get("workshopCategory") or "워크샵 프로그램",
                    "starts_at": clean_date(item.get("startDt")),
                    "ends_at": clean_date(item.get("endDt")),
                    "region": "서울",
                    "locality": "중구",
                    "venue_name": VENUE_NAME,
                    "address": VENUE_ADDRESS,
                    "age_text": item.get("workshopAge"),
                    "price_text": item.get("cost"),
                    "reservation_required": is_reservation_required(item.get("applyWay")),
                    "reservation_status": normalize_status(item.get("startDt"), item.get("endDt"), captured_at),
                    "notes": make_workshop_notes(item),
                    "image_url": make_image_url(item),
                    "tags": ["실내"],
                },
            ).to_dict()
        )
    return events


def make_workshop_description(item: dict[str, Any]) -> str | None:
    return join_parts([item.get("workshopDesc"), item.get("workshopInfo")])


def make_workshop_notes(item: dict[str, Any]) -> str | None:
    return join_parts(
        [
            f"수업시간 {item['time']}" if item.get("time") else None,
            f"정원 {item['cnt']}" if item.get("cnt") else None,
            f"신청방법 {item['applyWay']}" if item.get("applyWay") else None,
            f"진행 {item['authorInfo']}" if item.get("authorInfo") else None,
        ]
    )


def make_image_url(item: dict[str, Any]) -> str | None:
    file_list = item.get("fileList")
    if not isinstance(file_list, list) or not file_list:
        return None
    first_file = file_list[0]
    if not isinstance(first_file, dict):
        return None

    save_location = clean_string(first_file.get("saveLocation"))
    save_filename = clean_string(first_file.get("saveFilename"))
    if not save_location or not save_filename:
        return None
    return f"https://datafolder.ezpmp.co.kr{save_location}{save_filename}"


def is_reservation_required(value: Any) -> bool | None:
    text = str(value or "")
    if any(token in text for token in ["사전", "온라인접수"]):
        return True
    if "현장접수" in text:
        return False
    return None


def normalize_status(starts_at: Any, ends_at: Any, captured_at: str) -> str:
    start = clean_date(starts_at)
    end = clean_date(ends_at)
    if end and end < captured_at:
        return "closed"
    if start and start > captured_at:
        return "available"
    return "unknown"


def clean_date(value: Any) -> str | None:
    text = clean_string(value)
    if not text:
        return None
    match = re.search(r"\d{4}-\d{2}-\d{2}", text)
    return match.group(0) if match else None


def clean_string(value: Any) -> str | None:
    if value is None:
        return None
    text = str(value).strip()
    return text or None


def join_parts(parts: list[Any]) -> str | None:
    cleaned = [text for part in parts if (text := clean_string(part))]
    return ". ".join(cleaned) or None


def future_date(start: str, days: int) -> str:
    return (date.fromisoformat(start) + timedelta(days=days)).isoformat()


def fetch_json_url(url: str) -> dict[str, Any]:
    request = Request(url, headers={"User-Agent": USER_AGENT})
    with urlopen(request, timeout=20) as response:
        return json.loads(response.read().decode("utf-8"))

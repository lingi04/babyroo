from __future__ import annotations

import html
import re
from datetime import date, timedelta
from pathlib import Path
from typing import Callable
from urllib.request import Request, urlopen

from babyroo_crawler.io import write_json
from babyroo_crawler.models import RawEvent, today_iso
from babyroo_crawler.pipeline import RAW_DIR


BASE_URL = "https://www.nfm.go.kr"
MAIN_URL = f"{BASE_URL}/kids/"
ADMISSION_URL = f"{BASE_URL}/kids/user/content.do?pageId=PAGE_000000000000003"
EDUCATION_URL = f"{BASE_URL}/kids/nfmkid/education/selectNewEducationReceiptList.do"
EDUCATION_DETAIL_URL = f"{BASE_URL}/kids/nfmkid/education/selectEducation.do"
SOURCE = "nfm_kids"
USER_AGENT = "BabyrooCrawler/0.1"
VENUE_NAME = "국립민속박물관 어린이박물관"
VENUE_ADDRESS = "서울특별시 종로구 삼청로 37"


def collect(
    output_path: Path | None = None,
    fetch_text: Callable[[str], str] | None = None,
    captured_at: str | None = None,
) -> list[dict]:
    fetch_text = fetch_text or fetch_text_url
    output_path = output_path or RAW_DIR / f"{SOURCE}.json"
    captured_at = captured_at or today_iso()

    events = [make_admission_event(captured_at)]
    events.extend(parse_education_list(fetch_text(EDUCATION_URL), captured_at))

    write_json(
        output_path,
        {
            "source": SOURCE,
            "captured_at": captured_at,
            "source_url": MAIN_URL,
            "events": events,
        },
    )
    return events


def make_admission_event(captured_at: str) -> dict:
    return RawEvent(
        source=SOURCE,
        source_event_id="admission",
        title="국립민속박물관 어린이박물관 관람",
        url=ADMISSION_URL,
        captured_at=captured_at,
        payload={
            "item_type": "venue_admission",
            "title": "국립민속박물관 어린이박물관 관람",
            "description": "무료로 이용할 수 있는 실내 어린이박물관 전시 관람.",
            "category": "박물관",
            "starts_at": captured_at,
            "ends_at": future_date(captured_at, days=180),
            "region": "서울",
            "locality": "종로구",
            "venue_name": VENUE_NAME,
            "address": VENUE_ADDRESS,
            "age_text": "어린이 및 보호자 동반 가족",
            "price_text": "무료",
            "reservation_required": True,
            "reservation_status": "unknown",
            "notes": (
                "관람시간 09:30~16:50. 인터넷 예약을 통해 관람할 수 있으며, "
                "보호자와 어린이가 동반 입장해야 합니다."
            ),
            "tags": ["무료", "실내", "예약필요", "보호자동반"],
        },
    ).to_dict()


def parse_education_list(page: str, captured_at: str) -> list[dict]:
    events = []
    for row in extract_table_rows(page):
        event_id = extract_detail_id(row)
        if not event_id:
            continue

        category = strip_brackets(extract_cell(row, "cate"))
        subject_html = extract_cell_html(row, "subject")
        status_text = extract_status(subject_html)
        title = clean_subject(subject_html, status_text)
        age_text = extract_cell(row, "target")
        starts_at, ends_at = parse_period(extract_cell_html(row, "term"))

        if not title:
            continue

        events.append(
            RawEvent(
                source=SOURCE,
                source_event_id=f"education-{event_id}",
                title=title,
                url=f"{EDUCATION_DETAIL_URL}?e_seq={event_id}",
                captured_at=captured_at,
                payload={
                    "item_type": "program",
                    "title": title,
                    "description": f"{category} 교육 프로그램" if category else "어린이박물관 교육 프로그램",
                    "category": category or "교육",
                    "starts_at": starts_at,
                    "ends_at": ends_at,
                    "region": "서울",
                    "locality": "종로구",
                    "venue_name": VENUE_NAME,
                    "address": VENUE_ADDRESS,
                    "age_text": age_text,
                    "price_text": "무료",
                    "reservation_required": True,
                    "reservation_status": normalize_status(status_text, starts_at, ends_at, captured_at),
                    "notes": f"접수상태 {status_text}" if status_text else None,
                    "tags": ["무료", "실내", "예약필요"],
                },
            ).to_dict()
        )
    return events


def extract_table_rows(page: str) -> list[str]:
    body_match = re.search(r"<tbody>\s*(?P<body>.*?)\s*</tbody>", page, re.DOTALL)
    if not body_match:
        return []
    return re.findall(r"<tr[^>]*>(.*?)</tr>", body_match.group("body"), re.DOTALL)


def extract_detail_id(row: str) -> str | None:
    match = re.search(r"fn_education_detail\('(?P<id>\d+)'\)", row)
    return match.group("id") if match else None


def extract_cell(row: str, class_name: str) -> str | None:
    return clean_html(extract_cell_html(row, class_name))


def extract_cell_html(row: str, class_name: str) -> str | None:
    pattern = rf'<td[^>]*class="[^"]*\b{re.escape(class_name)}\b[^"]*"[^>]*>(?P<value>.*?)</td>'
    match = re.search(pattern, row, re.DOTALL)
    return match.group("value") if match else None


def extract_status(subject_html: str | None) -> str | None:
    if not subject_html:
        return None
    match = re.search(r'<span[^>]*class="[^"]*\bstatus\b[^"]*"[^>]*>(?P<value>.*?)</span>', subject_html, re.DOTALL)
    return clean_html(match.group("value")) if match else None


def clean_subject(subject_html: str | None, status_text: str | None) -> str | None:
    title = clean_html(subject_html)
    if not title:
        return None
    if status_text and title.startswith(status_text):
        title = title[len(status_text) :].strip()
    return title or None


def strip_brackets(value: str | None) -> str | None:
    if not value:
        return None
    return value.strip().strip("[]").strip() or None


def parse_period(value: str | None) -> tuple[str | None, str | None]:
    dates = re.findall(r"\d{4}-\d{2}-\d{2}", value or "")
    if not dates:
        return None, None
    if len(dates) == 1:
        return dates[0], dates[0]
    return dates[0], dates[1]


def normalize_status(status_text: str | None, starts_at: str | None, ends_at: str | None, captured_at: str) -> str:
    if status_text and any(token in status_text for token in ["마감", "종료"]):
        return "closed"
    if status_text and any(token in status_text for token in ["접수중", "접수예정"]):
        return "available"
    if ends_at and ends_at < captured_at:
        return "closed"
    if starts_at and starts_at > captured_at:
        return "available"
    return "unknown"


def clean_html(value: str | None) -> str | None:
    if value is None:
        return None
    text = re.sub(r"<[^>]+>", " ", value)
    text = html.unescape(text)
    text = " ".join(text.split())
    return text or None


def future_date(start: str, days: int) -> str:
    return (date.fromisoformat(start) + timedelta(days=days)).isoformat()


def fetch_text_url(url: str) -> str:
    request = Request(url, headers={"User-Agent": USER_AGENT})
    with urlopen(request, timeout=20) as response:
        return response.read().decode("utf-8")

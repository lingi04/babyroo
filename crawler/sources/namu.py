from __future__ import annotations

import html
import json
import re
import time
from datetime import date, timedelta
from pathlib import Path
from typing import Callable
from urllib.parse import urljoin
from urllib.request import Request, urlopen

from babyroo_crawler.io import write_json
from babyroo_crawler.models import RawEvent, today_iso
from babyroo_crawler.pipeline import RAW_DIR


BASE_URL = "https://namu.sdm.go.kr"
MAIN_URL = f"{BASE_URL}/web/main/main"
ADMISSION_URL = f"{BASE_URL}/web/main/contents/guide_info_fee"
EDUCATION_URL = f"{BASE_URL}/web/main/education/all/list"
EXHIBITION_URLS = (
    f"{BASE_URL}/web/main/exhibition/event/current/view",
    f"{BASE_URL}/web/main/exhibition/special/current/view",
)
SOURCE = "namu"
USER_AGENT = "BabyrooCrawler/0.1"
VENUE_NAME = "서대문자연사박물관"
VENUE_ADDRESS = "서울시 서대문구 연희로32길 51"

PROGRAM_CATEGORIES = {
    "class": "박물관 교실",
    "tour": "박물관 투어",
    "science": "과학강연",
    "meta": "메타(META) 교실",
    "moon": "가족과 함께하는 달보기",
    "camp": "성인대상 교육 프로그램",
    "school": "학급투어",
    "curator": "큐레이터",
    "experience": "과학도구 빌려주는 자연사박물관",
}


def collect(
    output_path: Path | None = None,
    fetch_text: Callable[[str], str] | None = None,
    captured_at: str | None = None,
    request_delay: float = 0.1,
) -> list[dict]:
    fetch_text = fetch_text or fetch_text_url
    output_path = output_path or RAW_DIR / f"{SOURCE}.json"
    captured_at = captured_at or today_iso()

    events = [make_admission_event(captured_at)]
    events.extend(parse_exhibitions([fetch_text(url) for url in EXHIBITION_URLS], captured_at))
    events.extend(
        parse_education_calendar(
            fetch_text(EDUCATION_URL),
            captured_at,
            fetch_detail=fetch_text,
            request_delay=request_delay,
        )
    )

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
        title="서대문자연사박물관 관람",
        url=ADMISSION_URL,
        captured_at=captured_at,
        payload={
            "item_type": "venue_admission",
            "title": "서대문자연사박물관 관람",
            "description": "공룡, 생명진화, 지구환경 전시를 볼 수 있는 실내 자연사박물관 관람.",
            "category": "박물관",
            "starts_at": captured_at,
            "ends_at": future_date(captured_at, days=180),
            "region": "서울",
            "locality": "서대문구",
            "venue_name": VENUE_NAME,
            "address": VENUE_ADDRESS,
            "age_text": "0~12세 어린이 및 가족",
            "price_text": "어린이 3,000원, 4세 이하 무료, 어른 7,000원",
            "reservation_required": False,
            "reservation_status": "unknown",
            "notes": "입장권 사전 예매는 불가하며 현장 예매만 가능합니다.",
            "tags": ["실내"],
        },
    ).to_dict()


def parse_exhibitions(html_pages: list[str], captured_at: str) -> list[dict]:
    events = []
    for page in html_pages:
        title = extract_labeled_value(page, "전시명") or clean_meta(page, "og:title")
        if not title:
            continue

        period = extract_labeled_value(page, "전시기간")
        starts_at, ends_at = parse_period(period)
        url = clean_meta(page, "og:url") or BASE_URL
        image_url = absolutize(extract_first_image_src(page))
        venue = extract_labeled_value(page, "전시장소")
        exhibition_type = extract_labeled_value(page, "전시구분")
        summary = clean_meta(page, "og:description")

        events.append(
            RawEvent(
                source=SOURCE,
                source_event_id=make_exhibition_source_event_id(url),
                title=title,
                url=url,
                captured_at=captured_at,
                payload={
                    "item_type": "exhibition",
                    "title": title,
                    "description": summary,
                    "category": exhibition_type or "전시",
                    "starts_at": starts_at,
                    "ends_at": ends_at,
                    "region": "서울",
                    "locality": "서대문구",
                    "venue_name": VENUE_NAME,
                    "venue_detail": venue,
                    "address": VENUE_ADDRESS,
                    "age_text": "전 연령",
                    "price_text": "박물관 관람료 적용",
                    "reservation_required": False,
                    "reservation_status": normalize_status(starts_at, ends_at, captured_at),
                    "image_url": image_url,
                    "tags": ["실내"],
                },
            ).to_dict()
        )
    return events


def parse_education_calendar(
    page: str,
    captured_at: str,
    fetch_detail: Callable[[str], str] | None = None,
    request_delay: float = 0,
) -> list[dict]:
    year, month = parse_calendar_year_month(page, captured_at)
    grouped: dict[tuple[str, str, str], dict[str, str]] = {}

    for match in re.finditer(
        r'name="(?P<day>\d+)_(?P<category>[a-z]+)_(?P<field>title|time|link)(?P<index>\d+)"\s+value="(?P<value>[^"]*)"',
        page,
    ):
        key = (match.group("day"), match.group("category"), match.group("index"))
        grouped.setdefault(key, {})[match.group("field")] = clean_html(match.group("value")) or ""

    events = []
    for (day, category, index), fields in sorted(grouped.items()):
        title = fields.get("title")
        link_id = fields.get("link")
        if not title or not link_id:
            continue

        event_date = date(year, month, int(day)).isoformat()
        category_label = PROGRAM_CATEGORIES.get(category, category)
        url = f"{BASE_URL}/web/main/education/{category}/view?epIdx={link_id}"
        time_text = fields.get("time")
        detail = parse_education_detail(fetch_detail(url)) if fetch_detail else {}
        if fetch_detail and request_delay:
            time.sleep(request_delay)

        events.append(
            RawEvent(
                source=SOURCE,
                source_event_id=f"education-{category}-{link_id}-{event_date}-{index}",
                title=title,
                url=url,
                captured_at=captured_at,
                payload={
                    "item_type": "program",
                    "title": title,
                    "description": f"{category_label} 교육 프로그램",
                    "category": category_label,
                    "starts_at": detail.get("date") or event_date,
                    "ends_at": detail.get("date") or event_date,
                    "region": "서울",
                    "locality": "서대문구",
                    "venue_name": VENUE_NAME,
                    "venue_detail": detail.get("venue_name"),
                    "address": VENUE_ADDRESS,
                    "age_text": detail.get("age_text"),
                    "price_text": detail.get("price_text"),
                    "reservation_required": True,
                    "reservation_status": normalize_status(event_date, event_date, captured_at),
                    "notes": make_education_notes(detail, time_text),
                    "summary": detail.get("summary"),
                    "tags": ["실내", "예약필요"],
                },
            ).to_dict()
        )
    return events


def parse_education_detail(page: str) -> dict[str, str]:
    detail = {
        "title": extract_education_list_value(page, "강좌명"),
        "venue_name": extract_education_list_value(page, "장소"),
        "date": extract_education_list_value(page, "날짜"),
        "time": extract_education_list_value(page, "시간"),
        "age_text": extract_education_list_value(page, "대상"),
        "price_text": extract_education_list_value(page, "수강료"),
        "summary": extract_program_summary(page),
    }
    return {key: value for key, value in detail.items() if value}


def extract_education_list_value(page: str, label: str) -> str | None:
    pattern = (
        rf"<li>\s*<span[^>]*class=\"item\"[^>]*>\s*{re.escape(label)}\s*</span>"
        r"(?P<value>.*?)</li>"
    )
    match = re.search(pattern, page, re.DOTALL)
    return clean_html(match.group("value")) if match else None


def extract_program_summary(page: str) -> str | None:
    match = re.search(
        r"<h4[^>]*>\s*프로그램 구성\s*</h4>\s*"
        r'<div class="sub-h4-box">\s*<p[^>]*>(?P<value>.*?)</p>',
        page,
        re.DOTALL,
    )
    return clean_html(match.group("value")) if match else None


def make_education_notes(detail: dict[str, str], calendar_time: str | None) -> str | None:
    parts = []
    time_text = detail.get("time") or calendar_time
    if time_text:
        parts.append(f"수업시간 {time_text}")
    if detail.get("title"):
        parts.append(f"강좌명 {detail['title']}")
    return ". ".join(parts) or None


def parse_calendar_year_month(page: str, captured_at: str) -> tuple[int, int]:
    prev_match = re.search(r"calYear=(\d+)&amp;calMonth=(\d+)&direction=left", page)
    next_match = re.search(r"calYear=(\d+)&amp;calMonth=(\d+)&direction=right", page)
    if prev_match and next_match:
        prev_year = int(prev_match.group(1))
        prev_month = int(prev_match.group(2))
        next_year = int(next_match.group(1))
        next_month = int(next_match.group(2))
        current = date(prev_year, prev_month, 1) + timedelta(days=32)
        current = current.replace(day=1)
        if current.year == next_year and current.month + 1 == next_month:
            return current.year, current.month
        if current.month == 12 and next_year == current.year + 1 and next_month == 1:
            return current.year, current.month

    captured = date.fromisoformat(captured_at)
    return captured.year, captured.month


def extract_labeled_value(page: str, label: str) -> str | None:
    pattern = (
        rf'<div class="current-tit">\s*{re.escape(label)}\s*</div>\s*'
        r'<div class="current-con">\s*(?P<value>.*?)\s*</div>'
    )
    match = re.search(pattern, page, re.DOTALL)
    return clean_html(match.group("value")) if match else None


def clean_meta(page: str, property_name: str) -> str | None:
    match = re.search(
        rf'<meta\s+property="{re.escape(property_name)}"\s+content="(?P<value>[^"]*)"',
        page,
    )
    return clean_html(match.group("value")) if match else None


def extract_first_image_src(page: str) -> str | None:
    match = re.search(r'<img[^>]+src="(?P<src>[^"]+)"[^>]*onerror=', page)
    if match:
        return clean_html(match.group("src"))
    return None


def parse_period(value: str | None) -> tuple[str | None, str | None]:
    if not value:
        return None, None
    dates = re.findall(r"\d{4}-\d{2}-\d{2}", value)
    if not dates:
        return None, None
    if len(dates) == 1:
        return dates[0], dates[0]
    return dates[0], dates[1]


def normalize_status(starts_at: str | None, ends_at: str | None, captured_at: str) -> str:
    if ends_at and ends_at < captured_at:
        return "closed"
    if starts_at and starts_at > captured_at:
        return "available"
    return "unknown"


def make_exhibition_source_event_id(url: str) -> str:
    if "/exhibition/event/current/" in url:
        return "exhibition-event-current"
    if "/exhibition/special/current/" in url:
        return "exhibition-special-current"
    return make_source_event_id("exhibition", url)


def make_source_event_id(prefix: str, value: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-")
    return f"{prefix}-{slug[-48:]}"


def absolutize(url: str | None) -> str | None:
    if not url:
        return None
    return urljoin(BASE_URL, url)


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

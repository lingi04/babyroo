from __future__ import annotations

import re
import time
from datetime import date
from html.parser import HTMLParser
from pathlib import Path
from typing import Any, Callable
from urllib.request import Request, urlopen

from babyroo_crawler.io import write_json
from babyroo_crawler.models import RawEvent, today_iso
from babyroo_crawler.pipeline import RAW_DIR


BASE_URL = "https://seoul.childcare.go.kr"
LIST_PATH = "/ccef/edcevent/EdcEventSlL.jsp"
DETAIL_PATH = "/ccef/edcevent/EdcEventSl.jsp"
SOURCE = "seoul_childcare"
USER_AGENT = "BabyrooCrawler/0.1"
PARENT_TERMS = ("부모", "양육자", "가족", "아빠", "엄마")
STAFF_TERMS = (
    "보육교직원",
    "원장",
    "교사 교육",
    "컨설턴트",
    "표준보육과정",
    "보육 이해",
    "아동권리존중",
    "안전교육",
    "문제행동 이해",
)
CENTER_ADDRESS = "서울특별시 마포구 서강로 75-16"


def collect(
    months: int = 3,
    output_path: Path | None = None,
    fetch_text: Callable[[str], str] | None = None,
    request_delay: float = 0.2,
) -> list[dict[str, Any]]:
    fetch_text = fetch_text or fetch_text_url
    output_path = output_path or RAW_DIR / f"{SOURCE}.json"
    captured_at = today_iso()
    candidates: dict[str, str] = {}

    for year, month in iter_months(date.today(), months):
        list_url = make_list_url(year, month)
        for sequence, title in parse_event_links(fetch_text(list_url)).items():
            if is_parent_facing(title):
                candidates[sequence] = title

    events = []
    for sequence, list_title in candidates.items():
        detail_url = make_detail_url(sequence)
        detail = parse_detail(fetch_text(detail_url))
        title = detail.get("제목") or list_title
        combined_text = f"{title} {detail.get('description', '')}"
        if not is_parent_facing(combined_text):
            continue

        starts_at, ends_at = parse_period(detail.get("행사기간"))
        if not starts_at:
            continue
        venue_name = detail.get("장소")

        events.append(
            RawEvent(
                source=SOURCE,
                source_event_id=sequence,
                title=title,
                url=detail_url,
                captured_at=captured_at,
                payload={
                    "title": title,
                    "description": detail.get("description"),
                    "category": "교육/체험",
                    "starts_at": starts_at,
                    "ends_at": ends_at,
                    "region": "서울",
                    "venue_name": venue_name,
                    "address": infer_address(venue_name),
                    "age_text": detail.get("대상"),
                    "price_text": detail.get("참가비") or detail.get("비용"),
                    "notes": make_notes(detail),
                    "external_url": detail.get("홈페이지"),
                },
            ).to_dict()
        )
        if request_delay:
            time.sleep(request_delay)

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


def iter_months(start: date, count: int) -> list[tuple[int, int]]:
    months = []
    year = start.year
    month = start.month
    for _ in range(count):
        months.append((year, month))
        month += 1
        if month == 13:
            month = 1
            year += 1
    return months


def make_list_url(year: int, month: int) -> str:
    return f"{BASE_URL}{LIST_PATH}?year={year}&month={month}"


def make_detail_url(sequence: str) -> str:
    return f"{BASE_URL}{DETAIL_PATH}?flag=CSl&EDCEVENTSEQ={sequence}"


def fetch_text_url(url: str) -> str:
    request = Request(url, headers={"User-Agent": USER_AGENT})
    with urlopen(request, timeout=20) as response:
        return response.read().decode("utf-8")


def is_parent_facing(text: str) -> bool:
    return any(term in text for term in PARENT_TERMS) and not any(
        term in text for term in STAFF_TERMS
    )


def parse_event_links(html: str) -> dict[str, str]:
    parser = SeoulChildcareListParser()
    parser.feed(html)
    return parser.events


def parse_detail(html: str) -> dict[str, str]:
    parser = SeoulChildcareDetailParser()
    parser.feed(html)
    return parser.result()


def parse_period(value: str | None) -> tuple[str | None, str | None]:
    if not value:
        return None, None
    dates = re.findall(r"\d{4}-\d{2}-\d{2}", value)
    if not dates:
        return None, None
    if len(dates) == 1:
        return dates[0], dates[0]
    return dates[0], dates[1]


def make_notes(detail: dict[str, str]) -> str | None:
    parts = []
    if detail.get("접수기간"):
        parts.append(f"접수기간 {detail['접수기간']}")
    if detail.get("시간"):
        parts.append(f"시간 {detail['시간']}")
    return ". ".join(parts) or None


def infer_address(venue_name: str | None) -> str | None:
    if venue_name and "육아종합지원센터" in venue_name:
        return CENTER_ADDRESS
    return None


class SeoulChildcareListParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.events: dict[str, str] = {}
        self._sequence: str | None = None
        self._parts: list[str] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if tag != "a":
            return
        onclick = dict(attrs).get("onclick") or ""
        match = re.search(r"fnCalDetail\((\d+)\)", onclick)
        if match:
            self._sequence = match.group(1)
            self._parts = []

    def handle_endtag(self, tag: str) -> None:
        if tag == "a" and self._sequence:
            title = " ".join(self._parts).strip()
            if title:
                self.events[self._sequence] = title
            self._sequence = None
            self._parts = []

    def handle_data(self, data: str) -> None:
        if self._sequence:
            text = " ".join(data.split())
            if text:
                self._parts.append(text)


class SeoulChildcareDetailParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self._in_view = False
        self._view_depth = 0
        self._row_depth = 0
        self._capture: str | None = None
        self._capture_depth = 0
        self._parts: list[str] = []
        self._label: str | None = None
        self._data: dict[str, str] = {}

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        classes = set((dict(attrs).get("class") or "").split())

        if self._in_view:
            self._view_depth += 1
        if tag == "div" and "com_view" in classes:
            self._in_view = True
            self._view_depth = 1

        if not self._in_view:
            return
        if tag == "tr":
            self._row_depth += 1
        if self._capture_depth:
            self._capture_depth += 1
        if tag == "th" and self._row_depth:
            self._start_capture("label")
        elif tag == "td" and self._row_depth:
            self._start_capture("value")

    def handle_endtag(self, tag: str) -> None:
        if not self._in_view:
            return
        if self._capture_depth:
            self._capture_depth -= 1
            if self._capture_depth == 0:
                self._finish_capture()
        if tag == "tr" and self._row_depth:
            self._row_depth -= 1
        self._view_depth -= 1
        if self._view_depth == 0:
            self._in_view = False

    def handle_data(self, data: str) -> None:
        if self._capture_depth:
            text = " ".join(data.split())
            if text:
                self._parts.append(text)

    def result(self) -> dict[str, str]:
        return dict(self._data)

    def _start_capture(self, capture: str) -> None:
        self._capture = capture
        self._capture_depth = 1
        self._parts = []

    def _finish_capture(self) -> None:
        value = " ".join(self._parts).strip()
        if self._capture == "label":
            self._label = value
        elif self._capture == "value" and self._label:
            if self._label == "공유하기":
                pass
            elif self._label in self._data:
                self._data["description"] = value
            elif value:
                self._data[self._label] = value
        self._capture = None
        self._parts = []

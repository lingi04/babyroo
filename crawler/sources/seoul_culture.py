from __future__ import annotations

import json
import re
import time
from datetime import date, timedelta
from html.parser import HTMLParser
from pathlib import Path
from typing import Any, Callable
from urllib.parse import urlencode
from urllib.request import Request, urlopen

from babyroo_crawler.io import write_json
from babyroo_crawler.models import RawEvent, today_iso
from babyroo_crawler.pipeline import RAW_DIR


BASE_URL = "https://culture.seoul.go.kr"
LIST_URL = f"{BASE_URL}/culture/culture/cultureEvent/jsonList.json"
DETAIL_PATH = "/culture/culture/cultureEvent/view.do"
SOURCE = "seoul_culture"
USER_AGENT = "BabyrooCrawler/0.1"
SEARCH_CATEGORIES = ("EDUEXP", "SHOW")
SEARCH_TERMS = ("영유아", "유아", "베이비", "개월", "서울상상나라")
BABY_TERMS = ("개월", "영유아", "영아", "유아", "아기", "베이비", "0~3세", "0-3세")
INSTITUTION_ONLY_TERMS = ("유아교육기관 모집", "어린이집 또는 유치원", "유치원, 어린이집")


def collect(
    max_pages: int = 5,
    output_path: Path | None = None,
    fetch_json: Callable[[str], dict[str, Any]] | None = None,
    fetch_text: Callable[[str], str] | None = None,
    request_delay: float = 0.2,
) -> list[dict[str, Any]]:
    fetch_json = fetch_json or fetch_json_url
    fetch_text = fetch_text or fetch_text_url
    output_path = output_path or RAW_DIR / f"{SOURCE}.json"
    captured_at = today_iso()
    end_date = (date.today() + timedelta(days=180)).isoformat()

    candidates: dict[str, dict[str, Any]] = {}
    for category in SEARCH_CATEGORIES:
        for page in range(1, max_pages + 1):
            url = make_list_url(category, page, captured_at, end_date)
            result_list = fetch_json(url).get("resultList", [])
            if not result_list:
                break

            for item in result_list:
                if is_baby_relevant(f"{item.get('title', '')} {item.get('thumbDesc', '')}"):
                    candidates[str(item["cultcode"])] = item

    for search_term in SEARCH_TERMS:
        for page in range(1, max_pages + 1):
            url = make_list_url(
                category=None,
                page=page,
                start_date=captured_at,
                end_date=end_date,
                search_term=search_term,
            )
            result_list = fetch_json(url).get("resultList", [])
            if not result_list:
                break
            for item in result_list:
                candidates[str(item["cultcode"])] = item

    events = []
    for cultcode, item in candidates.items():
        detail_url = make_detail_url(cultcode)
        detail = parse_detail(fetch_text(detail_url))
        combined_text = " ".join(
            [
                str(item.get("title", "")),
                str(item.get("thumbDesc", "")),
                detail.get("target", ""),
                detail.get("description", ""),
            ]
        )
        if not is_zero_to_three_relevant(combined_text) or is_institution_only(combined_text):
            continue

        starts_at, ends_at = parse_period(detail.get("period"))
        events.append(
            RawEvent(
                source=SOURCE,
                source_event_id=cultcode,
                title=detail.get("title") or str(item.get("title", "")).strip(),
                url=detail_url,
                captured_at=captured_at,
                payload={
                    "title": detail.get("title") or item.get("title"),
                    "description": detail.get("description") or item.get("thumbDesc"),
                    "category": detail.get("category") or item.get("subjcodeGroupNm"),
                    "starts_at": starts_at or item.get("strtdate"),
                    "ends_at": ends_at or item.get("endDate"),
                    "region": "서울",
                    "venue_name": detail.get("place") or item.get("facName"),
                    "address": item.get("addr"),
                    "age_text": detail.get("target"),
                    "price_text": detail.get("price"),
                    "external_url": detail.get("external_url"),
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


def make_list_url(
    category: str | None,
    page: int,
    start_date: str,
    end_date: str,
    search_term: str | None = None,
) -> str:
    params = {
        "pageIndex": page,
        "menuNo": "200110",
        "sdate": start_date,
        "edate": end_date,
    }
    if category:
        params["field"] = category
    if search_term:
        params["searchStr"] = search_term
    query = urlencode(params)
    return f"{LIST_URL}?{query}"


def make_detail_url(cultcode: str) -> str:
    return f"{BASE_URL}{DETAIL_PATH}?cultcode={cultcode}&menuNo=200110"


def fetch_json_url(url: str) -> dict[str, Any]:
    return json.loads(fetch_bytes(url).decode("utf-8"))


def fetch_text_url(url: str) -> str:
    return fetch_bytes(url).decode("utf-8")


def fetch_bytes(url: str) -> bytes:
    request = Request(url, headers={"User-Agent": USER_AGENT})
    with urlopen(request, timeout=20) as response:
        return response.read()


def is_baby_relevant(text: str) -> bool:
    return any(term in text for term in BABY_TERMS)


def is_zero_to_three_relevant(text: str) -> bool:
    month_values = [int(value) for value in re.findall(r"(\d+)\s*개월", text)]
    if month_values:
        return min(month_values) <= 36

    year_ranges = re.findall(r"만?\s*(\d+)\s*(?:세)?\s*[~\-]\s*(\d+)\s*세", text)
    if year_ranges:
        return min(int(min_year) for min_year, _ in year_ranges) <= 3

    explicit_years = [int(value) for value in re.findall(r"만\s*(\d+)\s*세", text)]
    if explicit_years:
        return min(explicit_years) <= 3

    return any(term in text for term in ("영유아", "영아", "아기", "베이비", "0~3세", "0-3세"))


def is_institution_only(text: str) -> bool:
    return any(term in text for term in INSTITUTION_ONLY_TERMS)


def parse_period(value: str | None) -> tuple[str | None, str | None]:
    if not value:
        return None, None
    dates = [part.strip() for part in value.split("~")]
    if len(dates) == 1:
        return dates[0] or None, dates[0] or None
    return dates[0] or None, dates[1] or None


def parse_detail(html: str) -> dict[str, str]:
    parser = SeoulCultureDetailParser()
    parser.feed(html)
    return parser.result()


class SeoulCultureDetailParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self._event_title_depth = 0
        self._description_depth = 0
        self._capture_name: str | None = None
        self._capture_depth = 0
        self._capture_parts: list[str] = []
        self._current_label: str | None = None
        self._data: dict[str, str] = {}

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        attributes = dict(attrs)
        classes = set((attributes.get("class") or "").split())

        if self._event_title_depth:
            self._event_title_depth += 1
        if self._description_depth:
            self._description_depth += 1
        if self._capture_depth:
            self._capture_depth += 1

        if tag == "div" and "event-title" in classes:
            self._event_title_depth = 1
        elif tag == "div" and "type-th" in classes:
            self._start_capture("label")
        elif tag == "div" and "type-td" in classes:
            self._start_capture("value")
        elif tag == "div" and "culture-content" in classes:
            self._description_depth = 1
            self._start_capture("description")
        elif tag == "h2" and self._event_title_depth:
            self._start_capture("title")
        elif tag == "p" and "type" in classes and self._event_title_depth:
            self._start_capture("category")
        elif tag == "a" and "홈페이지 바로가기" in (attributes.get("title") or ""):
            href = attributes.get("href")
            if href:
                self._data["external_url"] = href

    def handle_endtag(self, tag: str) -> None:
        if self._capture_depth:
            self._capture_depth -= 1
            if self._capture_depth == 0:
                self._finish_capture()
        if self._event_title_depth:
            self._event_title_depth -= 1
        if self._description_depth:
            self._description_depth -= 1

    def handle_data(self, data: str) -> None:
        if self._capture_depth:
            text = " ".join(data.split())
            if text:
                self._capture_parts.append(text)

    def result(self) -> dict[str, str]:
        field_names = {
            "장소": "place",
            "기간": "period",
            "시간": "time",
            "대상": "target",
            "요금": "price",
            "문의": "contact",
        }
        result = dict(self._data)
        for label, field_name in field_names.items():
            if label in self._data:
                result[field_name] = self._data[label]
        return result

    def _start_capture(self, name: str) -> None:
        self._capture_name = name
        self._capture_depth = 1
        self._capture_parts = []

    def _finish_capture(self) -> None:
        value = " ".join(self._capture_parts).strip()
        name = self._capture_name
        if name == "label":
            self._current_label = value
        elif name == "value" and self._current_label:
            self._data[self._current_label] = value
        elif name and value:
            self._data[name] = value
        self._capture_name = None
        self._capture_parts = []

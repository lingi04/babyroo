from __future__ import annotations

import hashlib
import re
from datetime import date
from typing import Any

from babyroo_crawler.models import NormalizedEvent


AGE_MONTH_PATTERNS = [
    re.compile(r"(?P<months>\d+)\s*개월\s*(이상|부터)"),
    re.compile(r"(?P<years>\d+)\s*세\s*(이상|부터)"),
]


def normalize_raw_event(raw: dict[str, Any]) -> NormalizedEvent:
    payload = raw.get("payload", {})
    text = " ".join(
        str(payload.get(key, ""))
        for key in ["title", "description", "age_text", "price_text", "notes"]
    )

    title = str(raw.get("title") or payload.get("title") or "").strip()
    source = str(raw.get("source") or "").strip()
    source_event_id = str(raw.get("source_event_id") or "").strip()
    source_url = str(raw.get("url") or payload.get("url") or "").strip()

    event_id = make_event_id(source, source_event_id, title, source_url)
    age_min_months = parse_age_min_months(text)

    return NormalizedEvent(
        id=event_id,
        title=title,
        category=normalize_category(payload.get("category"), text),
        starts_at=clean_string(payload.get("starts_at")),
        ends_at=clean_string(payload.get("ends_at")),
        region=clean_string(payload.get("region")),
        venue_name=clean_string(payload.get("venue_name")),
        address=clean_string(payload.get("address")),
        age_min_months=age_min_months,
        age_max_months=parse_age_max_months(text),
        guardian_required=parse_bool_from_text(text, ["보호자", "양육자"]),
        price_type=normalize_price_type(payload.get("price_text"), text),
        price_text=clean_string(payload.get("price_text")),
        reservation_required=parse_bool_from_text(text, ["예약", "사전예약", "접수"]),
        indoor=parse_bool_from_text(text, ["실내", "실내놀이", "공연장"]),
        stroller_friendly=parse_bool_from_text(text, ["유모차"]),
        nursing_room=parse_bool_from_text(text, ["수유실"]),
        parking=parse_bool_from_text(text, ["주차"]),
        tags=make_parent_tags(payload, text, age_min_months),
        summary=clean_string(payload.get("summary") or payload.get("description")),
        source=source,
        source_url=source_url,
        source_event_id=source_event_id,
        last_checked_at=clean_string(raw.get("captured_at")) or date.today().isoformat(),
    )


def make_event_id(source: str, source_event_id: str, title: str, url: str) -> str:
    stable_key = "|".join([source, source_event_id, title, url])
    digest = hashlib.sha1(stable_key.encode("utf-8")).hexdigest()[:12]
    slug_source = re.sub(r"[^a-z0-9]+", "-", source.lower()).strip("-") or "event"
    return f"{slug_source}-{digest}"


def clean_string(value: Any) -> str | None:
    if value is None:
        return None
    text = str(value).strip()
    return text or None


def parse_age_min_months(text: str) -> int | None:
    for pattern in AGE_MONTH_PATTERNS:
        match = pattern.search(text)
        if not match:
            continue
        if match.groupdict().get("months"):
            return int(match.group("months"))
        if match.groupdict().get("years"):
            return int(match.group("years")) * 12
    if any(token in text for token in ["영유아", "아기", "베이비"]):
        return 0
    return None


def parse_age_max_months(text: str) -> int | None:
    match = re.search(r"(?P<months>\d+)\s*개월\s*(이하|까지|미만)", text)
    if match:
        months = int(match.group("months"))
        return months - 1 if "미만" in match.group(0) else months

    match = re.search(r"(?P<years>\d+)\s*세\s*(이하|까지|미만)", text)
    if match:
        months = int(match.group("years")) * 12
        return months - 1 if "미만" in match.group(0) else months

    if "0~3세" in text or "0-3세" in text:
        return 36
    return None


def normalize_category(value: Any, text: str) -> str | None:
    raw = str(value or text)
    if any(token in raw for token in ["공연", "연극", "뮤지컬", "콘서트"]):
        return "performance"
    if any(token in raw for token in ["체험", "클래스", "교육", "만들기"]):
        return "experience"
    if any(token in raw for token in ["놀이터", "놀이공간", "키즈카페", "실내놀이"]):
        return "play_space"
    return None


def normalize_price_type(price_text: Any, text: str) -> str | None:
    combined = f"{price_text or ''} {text}"
    if any(token in combined for token in ["무료", "무 료"]):
        return "free"
    if any(token in combined for token in ["원", "유료", "입장료"]):
        return "paid"
    return None


def parse_bool_from_text(text: str, positive_tokens: list[str]) -> bool | None:
    if any(token in text for token in positive_tokens):
        return True
    return None


def make_parent_tags(payload: dict[str, Any], text: str, age_min_months: int | None) -> list[str]:
    tags = set(str(tag).strip() for tag in payload.get("tags", []) if str(tag).strip())

    if "무료" in text:
        tags.add("무료")
    if "실내" in text:
        tags.add("실내")
    if "예약" in text or "접수" in text:
        tags.add("예약필요")
    if "보호자" in text or "양육자" in text:
        tags.add("보호자동반")
    if age_min_months is not None and age_min_months <= 24:
        tags.add("24개월이하")

    return sorted(tags)

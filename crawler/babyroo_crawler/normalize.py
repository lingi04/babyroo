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

ALLOWED_TAGS = {"무료", "실내", "예약필요", "보호자동반", "24개월이하"}


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
    age_source_text = clean_string(payload.get("age_text")) or text
    age_min_months = parse_age_min_months(age_source_text)
    address = clean_string(payload.get("address"))

    return NormalizedEvent(
        id=event_id,
        title=title,
        category=normalize_category(payload.get("category"), text),
        starts_at=clean_string(payload.get("starts_at")),
        ends_at=clean_string(payload.get("ends_at")),
        region=clean_string(payload.get("region")),
        locality=clean_string(payload.get("locality")) or parse_locality(address),
        venue_name=clean_string(payload.get("venue_name")),
        venue_detail=clean_string(payload.get("venue_detail")),
        image_url=clean_string(payload.get("image_url")),
        address=address,
        age_min_months=age_min_months,
        age_max_months=parse_age_max_months(age_source_text),
        guardian_required=parse_bool_from_text(text, ["보호자", "양육자"]),
        price_type=normalize_price_type(payload.get("price_text"), text),
        price_text=clean_string(payload.get("price_text")),
        reservation_required=parse_bool_from_text(text, ["예약", "사전예약", "접수"]),
        reservation_status=normalize_reservation_status(payload.get("reservation_status"), text),
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


def parse_locality(address: str | None) -> str | None:
    if not address:
        return None
    district_match = re.search(r"([가-힣]+구|[가-힣]+군)", address)
    if district_match:
        return district_match.group(1)

    city_match = re.search(r"([가-힣]+시)", address)
    metro_cities = {"서울시", "부산시", "대구시", "인천시", "광주시", "대전시", "울산시", "세종시"}
    if city_match and city_match.group(1) not in metro_cities:
        return city_match.group(1)
    return None


def parse_age_min_months(text: str) -> int | None:
    candidates = []

    if "취학 전 누리과정" in text:
        candidates.append(36)

    month_range_match = re.search(r"(?P<months>\d+)\s*개월\s*[~\-]", text)
    if month_range_match:
        candidates.append(int(month_range_match.group("months")))

    range_match = re.search(r"만?\s*(?P<years>\d+)\s*(?:세)?\s*[~\-]\s*\d+\s*세", text)
    if range_match:
        candidates.append(int(range_match.group("years")) * 12)

    year_to_elementary_match = re.search(
        r"만?\s*(?P<years>\d+)\s*세\s*[~\-]\s*초(?:등|등학생)?\s*(?P<grade>\d+)\s*학년",
        text,
    )
    if year_to_elementary_match:
        candidates.append(int(year_to_elementary_match.group("years")) * 12)

    elementary_range_match = re.search(r"초(?:등|등학생)?\s*\(?(?P<grade>\d+)\s*[~\-]\s*\d+\s*학년", text)
    if elementary_range_match:
        candidates.append(elementary_grade_to_months(int(elementary_range_match.group("grade"))))

    elementary_match = re.search(r"초(?:등|등학생)?\s*\(?(?P<grade>\d+)\s*학년", text)
    if elementary_match:
        candidates.append(elementary_grade_to_months(int(elementary_match.group("grade"))))

    if "초등학생" in text and not elementary_range_match and not elementary_match:
        candidates.append(elementary_grade_to_months(1))

    for pattern in AGE_MONTH_PATTERNS:
        match = pattern.search(text)
        if not match:
            continue
        if match.groupdict().get("months"):
            candidates.append(int(match.group("months")))
        if match.groupdict().get("years"):
            candidates.append(int(match.group("years")) * 12)
    exact_year_match = find_exact_year_age(text)
    if exact_year_match:
        candidates.append(exact_year_match * 12)
    if any(token in text for token in ["영유아", "아기", "베이비"]) and not candidates:
        candidates.append(0)
    if any(token in text for token in ["어린이 동반 가족", "어린이 및 보호자"]) and not candidates:
        candidates.append(0)
    return min(candidates) if candidates else None


def parse_age_max_months(text: str) -> int | None:
    candidates = []

    if "취학 전 누리과정" in text:
        candidates.append(72)

    month_to_year_match = re.search(
        r"\d+\s*개월\s*[~\-]\s*만?\s*(?P<years>\d+)\s*세",
        text,
    )
    if month_to_year_match:
        candidates.append(year_to_max_months(int(month_to_year_match.group("years"))))

    range_match = re.search(r"만?\s*\d+\s*(?:세)?\s*[~\-]\s*(?P<years>\d+)\s*세", text)
    if range_match:
        candidates.append(year_to_max_months(int(range_match.group("years"))))

    year_to_elementary_match = re.search(
        r"만?\s*\d+\s*세\s*[~\-]\s*초(?:등|등학생)?\s*(?P<grade>\d+)\s*학년",
        text,
    )
    if year_to_elementary_match:
        candidates.append(elementary_grade_to_months(int(year_to_elementary_match.group("grade"))))

    elementary_range_match = re.search(r"초(?:등|등학생)?\s*\(?\d+\s*[~\-]\s*(?P<grade>\d+)\s*학년", text)
    if elementary_range_match:
        candidates.append(elementary_grade_to_months(int(elementary_range_match.group("grade"))))

    elementary_match = re.search(r"초(?:등|등학생)?\s*\(?(?P<grade>\d+)\s*학년", text)
    if elementary_match:
        candidates.append(elementary_grade_to_months(int(elementary_match.group("grade"))))

    if "초등학생" in text and not elementary_range_match and not elementary_match:
        candidates.append(elementary_grade_to_months(6))

    match = re.search(r"(?P<months>\d+)\s*개월\s*(이하|까지|미만)", text)
    if match:
        months = int(match.group("months"))
        candidates.append(months - 1 if "미만" in match.group(0) else months)

    match = re.search(r"(?P<years>\d+)\s*세\s*(이하|까지|미만)", text)
    if match:
        months = year_to_max_months(int(match.group("years")))
        candidates.append(months - 1 if "미만" in match.group(0) else months)

    if "0~3세" in text or "0-3세" in text:
        candidates.append(year_to_max_months(3))
    exact_year_match = find_exact_year_age(text)
    if exact_year_match:
        candidates.append(year_to_max_months(exact_year_match))
    if any(token in text for token in ["어린이 동반 가족", "어린이 및 보호자"]) and not candidates:
        candidates.append(144)
    return max(candidates) if candidates else None


def elementary_grade_to_months(grade: int) -> int:
    return (grade + 6) * 12


def year_to_max_months(year: int) -> int:
    return year * 12 + 11


def find_exact_year_age(text: str) -> int | None:
    match = re.search(
        r"(?<![~\-\d])(?:만\s*)?(?P<years>\d+)\s*세(?!\s*(?:이상|부터|이하|까지|미만|[~\-]|학년))",
        text,
    )
    return int(match.group("years")) if match else None


def normalize_category(value: Any, text: str) -> str | None:
    raw = f"{value or ''} {text}"
    if any(token in raw for token in ["공연", "연극", "뮤지컬", "콘서트"]):
        return "performance"
    if any(token in raw for token in ["체험", "클래스", "교육", "만들기", "워크샵", "COOKING", "ART"]):
        return "experience"
    if any(token in raw for token in ["놀이터", "놀이공간", "키즈카페", "실내놀이"]):
        return "play_space"
    if any(token in raw for token in ["전시", "기획전시", "특별전시"]):
        return "exhibition"
    if any(token in raw for token in ["박물관", "museum"]):
        return "museum"
    return None


def normalize_price_type(price_text: Any, text: str) -> str | None:
    combined = f"{price_text or ''} {text}"
    if any(token in combined for token in ["무료", "무 료"]):
        return "free"
    if any(token in combined for token in ["원", "유료", "입장료"]):
        return "paid"
    return None


def normalize_reservation_status(value: Any, text: str) -> str | None:
    raw = clean_string(value)
    if raw in {"available", "closed", "unknown"}:
        return raw

    combined = f"{raw or ''} {text}"
    if any(token in combined for token in ["마감", "매진", "접수종료", "예약종료"]):
        return "closed"
    return "unknown"


def parse_bool_from_text(text: str, positive_tokens: list[str]) -> bool | None:
    if any(token in text for token in positive_tokens):
        return True
    return None


def make_parent_tags(payload: dict[str, Any], text: str, age_min_months: int | None) -> list[str]:
    tags = {
        tag
        for tag in (str(tag).strip() for tag in payload.get("tags", []))
        if tag in ALLOWED_TAGS
    }

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

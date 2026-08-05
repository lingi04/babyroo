from __future__ import annotations

import html
import re
import time
from datetime import date, timedelta
from pathlib import Path
from typing import Any, Callable
from urllib.parse import urlencode, urljoin
from urllib.request import Request, urlopen

from babyroo_crawler.io import write_json
from babyroo_crawler.models import RawEvent, today_iso
from babyroo_crawler.pipeline import RAW_DIR


BASE_URL = "https://umppa.seoul.go.kr"
LIST_URL = f"{BASE_URL}/icare/user/kidsCafe/BD_selectKidsCafeList.do"
SOURCE = "seoul_kids_cafe"
USER_AGENT = "BabyrooCrawler/0.1"
DEFAULT_FCLTY_STLE = "2001"
FCLTY_STLES = ("2001", "2002")
FCLTY_STLE_LABELS = {
    "2001": "서울형 키즈카페",
    "2002": "여기저기 키즈카페",
}


def collect(
    output_path: Path | None = None,
    fetch_text: Callable[[str], str] | None = None,
    captured_at: str | None = None,
    max_pages: int | None = None,
    request_delay: float = 0.1,
    fclty_stles: tuple[str, ...] = FCLTY_STLES,
) -> list[dict[str, Any]]:
    fetch_text = fetch_text or fetch_text_url
    output_path = output_path or RAW_DIR / f"{SOURCE}.json"
    captured_at = captured_at or today_iso()

    events = []
    for fclty_stle in fclty_stles:
        page = 1
        last_page = max_pages
        while last_page is None or page <= last_page:
            html_page = fetch_text(make_list_url(page, fclty_stle=fclty_stle))
            cards = parse_list_page(html_page, captured_at, fclty_stle=fclty_stle)
            if not cards:
                break
            events.extend(cards)

            detected_last_page = parse_last_page(html_page)
            if detected_last_page:
                last_page = min(detected_last_page, max_pages) if max_pages else detected_last_page
            page += 1
            if request_delay:
                time.sleep(request_delay)

    write_json(
        output_path,
        {
            "source": SOURCE,
            "captured_at": captured_at,
            "source_url": LIST_URL,
            "events": events,
        },
    )
    return events


def make_list_url(page: int, fclty_stle: str = DEFAULT_FCLTY_STLE) -> str:
    return f"{LIST_URL}?{urlencode({'q_fcltyStle': fclty_stle, 'q_currPage': page, 'q_rowPerPage': 5})}"


def parse_list_page(page: str, captured_at: str, fclty_stle: str = DEFAULT_FCLTY_STLE) -> list[dict[str, Any]]:
    events = []
    style_label = FCLTY_STLE_LABELS.get(fclty_stle, "서울형 키즈카페")
    for card in extract_cards(page):
        parsed = parse_card(card)
        if not parsed.get("title") or not parsed.get("source_event_id"):
            continue

        title = str(parsed["title"])
        address = clean_html(parsed.get("address"))
        age_text = clean_html(parsed.get("age_text"))
        capacity_text = clean_html(parsed.get("capacity_text"))
        phone_text = clean_html(parsed.get("phone_text"))
        reservation_url = clean_html(parsed.get("reservation_url"))

        events.append(
            RawEvent(
                source=SOURCE,
                source_event_id=f"{fclty_stle}-{parsed['source_event_id']}",
                title=f"{title} 이용",
                url=absolutize(str(parsed["detail_url"])),
                captured_at=captured_at,
                payload={
                    "item_type": "venue_admission",
                    "facility_style": fclty_stle,
                    "facility_style_label": style_label,
                    "title": f"{title} 이용",
                    "description": f"{title} {style_label} 보호자 동반 실내 놀이공간 이용.",
                    "category": "키즈카페",
                    "starts_at": captured_at,
                    "ends_at": future_date(captured_at, days=180),
                    "region": "서울",
                    "locality": parse_locality(address),
                    "venue_name": title,
                    "address": address,
                    "age_text": age_text,
                    "price_text": "유료",
                    "reservation_required": True,
                    "reservation_status": "unknown",
                    "image_url": absolutize(clean_html(parsed.get("image_url"))),
                    "notes": make_notes(capacity_text, phone_text, reservation_url),
                    "tags": ["실내", "예약필요", "보호자동반"],
                },
            ).to_dict()
        )
    return events


def extract_cards(page: str) -> list[str]:
    return re.findall(r'<div class="kidscafe_wrap"[^>]*>(?P<card>.*?)</div><!-- kidscafe_wrap end -->', page, re.DOTALL)


def parse_card(card: str) -> dict[str, str | None]:
    detail_url = extract_link(card, "BD_selectKidsCafeView.do")
    return {
        "source_event_id": extract_query_value(detail_url, "q_fcltyId"),
        "detail_url": detail_url,
        "title": extract_title(card),
        "image_url": extract_image_url(card),
        "capacity_text": extract_labeled_value(card, "이용정원"),
        "age_text": extract_labeled_value(card, "이용연령"),
        "address": extract_labeled_value(card, "주소"),
        "phone_text": extract_labeled_value(card, "전화번호"),
        "reservation_url": extract_reservation_url(card),
    }


def extract_title(card: str) -> str | None:
    match = re.search(r"<h5[^>]*>(?P<value>.*?)</h5>", card, re.DOTALL)
    return clean_html(match.group("value")) if match else None


def extract_image_url(card: str) -> str | None:
    match = re.search(r'<img\s+[^>]*src="(?P<value>[^"]+)"', card)
    return match.group("value") if match else None


def extract_labeled_value(card: str, label: str) -> str | None:
    pattern = (
        rf"<dt[^>]*>\s*(?:{label}|{make_spaced_label_pattern(label)})\s*</dt>\s*"
        r'<dd[^>]*>(?P<value>.*?)</dd>'
    )
    match = re.search(pattern, card, re.DOTALL)
    return clean_html(match.group("value")) if match else None


def make_spaced_label_pattern(label: str) -> str:
    return r"\s*(?:&nbsp;|\s)*".join(re.escape(char) for char in label)


def extract_link(card: str, contains: str) -> str | None:
    for href in re.findall(r'<a\s+[^>]*href="(?P<href>[^"]+)"', card):
        if contains in href:
            return html.unescape(href)
    return None


def extract_reservation_url(card: str) -> str | None:
    match = re.search(r'<a\s+[^>]*href="(?P<href>[^"]+)"[^>]*class="lg_btn"', card)
    return html.unescape(match.group("href")) if match else None


def extract_query_value(url: str | None, key: str) -> str | None:
    if not url:
        return None
    match = re.search(rf"[?&]{re.escape(key)}=(?P<value>[^&]+)", url)
    return html.unescape(match.group("value")) if match else None


def parse_last_page(page: str) -> int | None:
    matches = [int(value) for value in re.findall(r"jsMovePage\((\d+)\)", page)]
    return max(matches) if matches else None


def make_notes(capacity_text: str | None, phone_text: str | None, reservation_url: str | None) -> str | None:
    parts = []
    if capacity_text:
        parts.append(f"이용정원 {capacity_text}")
    if phone_text:
        parts.append(f"전화번호 {phone_text}")
    if reservation_url:
        parts.append(f"예약 {absolutize(reservation_url)}")
    return ". ".join(parts) or None


def parse_locality(address: str | None) -> str | None:
    if not address:
        return None
    match = re.search(r"([가-힣]+구)", address)
    return match.group(1) if match else None


def absolutize(value: str | None) -> str | None:
    if not value:
        return None
    return urljoin(LIST_URL, value)


def clean_html(value: Any) -> str | None:
    if value is None:
        return None
    text = re.sub(r"<[^>]+>", " ", str(value))
    text = html.unescape(text)
    text = " ".join(text.split())
    return text or None


def future_date(start: str, days: int) -> str:
    return (date.fromisoformat(start) + timedelta(days=days)).isoformat()


def fetch_text_url(url: str) -> str:
    request = Request(url, headers={"User-Agent": USER_AGENT})
    with urlopen(request, timeout=20) as response:
        return response.read().decode("utf-8")

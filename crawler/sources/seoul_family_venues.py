from __future__ import annotations

import hashlib
import html
import re
from dataclasses import dataclass
from datetime import date, timedelta
from pathlib import Path
from typing import Callable
from urllib.parse import urljoin
from urllib.request import Request, urlopen

from babyroo_crawler.io import write_json
from babyroo_crawler.models import RawEvent, today_iso
from babyroo_crawler.pipeline import RAW_DIR


SOURCE = "seoul_family_venues"
USER_AGENT = "BabyrooCrawler/0.1"
SWR_URL = "https://swr.or.kr/museum/cpage.do"


@dataclass(frozen=True)
class Venue:
    source_event_id: str
    title: str
    url: str
    description: str
    category: str
    locality: str
    venue_name: str
    address: str
    age_text: str
    price_text: str
    reservation_required: bool | None
    notes: str
    image_url: str | None = None


VENUES = (
    Venue(
        source_event_id="lotteworld-aquarium-admission",
        title="롯데월드 아쿠아리움 관람",
        url="https://aquarium.lotteworld.com/",
        description="잠실 롯데월드몰 안에서 해양생물 전시와 생태설명을 볼 수 있는 실내 아쿠아리움 관람.",
        category="전시",
        locality="송파구",
        venue_name="롯데월드 아쿠아리움",
        address="서울특별시 송파구 올림픽로 300 롯데월드몰 B1",
        age_text="영유아 포함 전 연령 가족",
        price_text="유료",
        reservation_required=False,
        notes="실내 관람 시설이며 영유아와 보호자가 함께 방문하기 좋습니다.",
        image_url="https://aquarium.lotteworld.com/og/og_img_aquarium.jpg",
    ),
    Venue(
        source_event_id="coex-sealife-admission",
        title="씨라이프 코엑스 아쿠아리움 관람",
        url="https://www.visitsealife.com/coex-seoul/",
        description="스타필드 코엑스몰 안에서 해양생물을 가까이 볼 수 있는 실내 아쿠아리움 관람.",
        category="전시",
        locality="강남구",
        venue_name="씨라이프 코엑스 아쿠아리움",
        address="서울특별시 강남구 영동대로 513 씨라이프 코엑스 아쿠아리움",
        age_text="영유아 포함 전 연령 가족",
        price_text="유료",
        reservation_required=False,
        notes="운영시간과 티켓 정보는 방문 전 공식 사이트에서 확인하세요.",
    ),
    Venue(
        source_event_id="seoul-water-recycling-museum-admission",
        title="서울물재생체험관 관람",
        url=SWR_URL,
        description="물재생과 환경을 놀이와 전시로 배우는 강서구 실내 체험관 관람.",
        category="체험",
        locality="강서구",
        venue_name="서울물재생체험관",
        address="서울특별시 강서구 양천로 201 서남물재생센터 내",
        age_text="영유아 포함 어린이 및 보호자",
        price_text="무료",
        reservation_required=True,
        notes="관람 및 프로그램은 사전 예약이 필요한 경우가 있어 공식 사이트 확인이 필요합니다.",
    ),
    Venue(
        source_event_id="seoul-childrens-museum-admission",
        title="서울상상나라 관람",
        url="https://www.seoulchildrensmuseum.org/",
        description="어린이대공원 안에 있는 어린이 중심 복합체험놀이공간 관람.",
        category="체험",
        locality="광진구",
        venue_name="서울상상나라",
        address="서울특별시 광진구 능동로 216 서울상상나라",
        age_text="영유아 포함 어린이 및 보호자",
        price_text="유료",
        reservation_required=True,
        notes="개인 관람, 단체 관람, 교육 예약 메뉴가 운영됩니다.",
        image_url="https://www.seoulchildrensmuseum.org/z00_images/common/sns_sImg.png",
    ),
    Venue(
        source_event_id="arisu-nara-admission",
        title="서울 아리수나라 관람",
        url="https://arisu.seoul.go.kr/home/sub?menukey=7530",
        description="수돗물과 환경을 놀이로 배우는 서울어린이대공원 내 어린이 수돗물 체험홍보관 관람.",
        category="체험",
        locality="광진구",
        venue_name="아리수나라",
        address="서울특별시 광진구 능동로 216 서울어린이대공원 내",
        age_text="3세~9세 어린이 및 보호자",
        price_text="무료",
        reservation_required=True,
        notes="무료 예약제로 운영되는 어린이 체험홍보관입니다.",
    ),
    Venue(
        source_event_id="war-memorial-kids-museum-admission",
        title="전쟁기념관 어린이박물관 관람",
        url="https://www.warmemo.or.kr:8443/Kids/index",
        description="전쟁의 교훈과 나라사랑의 가치를 어린이 눈높이에 맞춰 배우는 용산구 실내 어린이박물관 관람.",
        category="박물관",
        locality="용산구",
        venue_name="전쟁기념관 어린이박물관",
        address="서울특별시 용산구 이태원로 29",
        age_text="권장연령 4~10세 유아 및 어린이와 보호자",
        price_text="무료",
        reservation_required=True,
        notes="10:00~17:50 총 8회차 운영, 매주 월요일 휴관. 회차별 홈페이지 사전예약 100명, 현장접수 20명으로 운영됩니다.",
        image_url="https://kr.object.gov-ncloudstorage.com/wmm-cdn/assets/kids/img/logo2.png",
    ),
    Venue(
        source_event_id="national-museum-kids-museum-admission",
        title="국립중앙박물관 어린이박물관 관람",
        url="https://www.museum.go.kr/CHILD/main/index.do",
        description="국립중앙박물관 안에서 문화유산을 어린이 눈높이에 맞춰 체험하는 용산구 실내 어린이박물관 관람.",
        category="박물관",
        locality="용산구",
        venue_name="국립중앙박물관 어린이박물관",
        address="서울특별시 용산구 서빙고로 137",
        age_text="어린이 및 보호자",
        price_text="무료",
        reservation_required=True,
        notes="관람 예약 가능 인원은 공식 홈페이지에서 회차별로 확인할 수 있습니다. 어린이박물관 문의 02-2077-9647.",
        image_url="https://www.museum.go.kr/design/common/images/nmk_sns_logo.png",
    ),
    Venue(
        source_event_id="police-museum-admission",
        title="국립경찰박물관 관람",
        url="https://www.policemuseum.go.kr/",
        description="경찰의 역사와 활동을 전시와 체험으로 살펴볼 수 있는 종로구 실내 박물관 관람.",
        category="박물관",
        locality="종로구",
        venue_name="국립경찰박물관",
        address="서울특별시 종로구 송월길 162",
        age_text="영유아 포함 어린이 및 보호자",
        price_text="무료",
        reservation_required=False,
        notes="09:30~17:30 운영, 입장 마감 17:00. 개인 및 가족 단위 관람은 예약 없이 가능하며, 15인 이상 단체 관람은 사전예약제로 운영됩니다.",
        image_url="https://www.policemuseum.go.kr/images_new/pm_og_image.jpg",
    ),
)


def collect(
    output_path: Path | None = None,
    fetch_text: Callable[[str], str] | None = None,
    captured_at: str | None = None,
) -> list[dict]:
    fetch_text = fetch_text or fetch_text_url
    output_path = output_path or RAW_DIR / f"{SOURCE}.json"
    captured_at = captured_at or today_iso()

    events = [make_admission_event(venue, captured_at) for venue in VENUES]
    events.extend(parse_swr_home_events(fetch_text(SWR_URL), captured_at, fetch_detail=fetch_text))

    write_json(
        output_path,
        {
            "source": SOURCE,
            "captured_at": captured_at,
            "source_url": SWR_URL,
            "events": events,
        },
    )
    return events


def make_admission_event(venue: Venue, captured_at: str) -> dict:
    return RawEvent(
        source=SOURCE,
        source_event_id=venue.source_event_id,
        title=venue.title,
        url=venue.url,
        captured_at=captured_at,
        payload={
            "item_type": "venue_admission",
            "title": venue.title,
            "description": venue.description,
            "category": venue.category,
            "starts_at": captured_at,
            "ends_at": future_date(captured_at, days=180),
            "region": "서울",
            "locality": venue.locality,
            "venue_name": venue.venue_name,
            "address": venue.address,
            "age_text": venue.age_text,
            "price_text": venue.price_text,
            "reservation_required": venue.reservation_required,
            "reservation_status": "unknown",
            "notes": venue.notes,
            "image_url": venue.image_url,
            "tags": make_tags(venue),
        },
    ).to_dict()


def parse_swr_home_events(
    page: str,
    captured_at: str,
    fetch_detail: Callable[[str], str] | None = None,
) -> list[dict]:
    events = []
    for card in extract_swr_cards(page):
        title = card.get("title")
        url = card.get("url")
        if not title or not url:
            continue

        detail = parse_swr_detail(fetch_detail(url)) if fetch_detail and url.startswith("https://swr.or.kr/") else {}
        starts_at, ends_at = parse_korean_date_range(card.get("period"), captured_at)
        detail_starts_at, detail_ends_at = parse_korean_date_range(
            detail.get("행사일시") or detail.get("교육기간"),
            captured_at,
        )
        events.append(
            RawEvent(
                source=SOURCE,
                source_event_id=f"swr-{make_stable_suffix(title, url)}",
                title=title,
                url=url,
                captured_at=captured_at,
                payload={
                    "item_type": "program",
                    "title": title,
                    "description": card.get("category") or "서울물재생체험관 프로그램",
                    "category": card.get("category") or "체험",
                    "starts_at": starts_at or detail_starts_at,
                    "ends_at": ends_at or detail_ends_at,
                    "region": "서울",
                    "locality": "강서구",
                    "venue_name": "서울물재생체험관",
                    "address": "서울특별시 강서구 양천로 201 서남물재생센터 내",
                    "age_text": detail.get("참여대상") or detail.get("교육대상") or "영유아 포함 어린이 및 보호자",
                    "price_text": detail.get("이용요금") or "무료",
                    "reservation_required": True,
                    "reservation_status": normalize_status(
                        starts_at or detail_starts_at,
                        ends_at or detail_ends_at,
                        captured_at,
                    ),
                    "image_url": card.get("image_url"),
                    "notes": make_swr_notes(detail),
                    "tags": ["무료", "실내", "예약필요", "보호자동반"],
                },
            ).to_dict()
        )
    return events


def extract_swr_cards(page: str) -> list[dict[str, str | None]]:
    cards = []
    pattern = (
        r'<a\s+[^>]*href="(?P<href>[^"]+)"[^>]*>'
        r"(?P<body>(?:(?!</a>).)*?<img\s+[^>]*>)"
    )
    for match in re.finditer(pattern, page, re.DOTALL):
        body = match.group("body")
        title = extract_img_alt(body) or extract_first_link_text(body)
        url = match.group("href")
        if not title or not is_swr_content_url(url):
            continue
        context = page[match.start() : match.end() + 900]
        cards.append(
            {
                "title": title,
                "url": absolutize(url, SWR_URL),
                "category": extract_mark_or_status(context),
                "period": extract_period_text(context) if "edu_museum_press" in url else None,
                "image_url": absolutize(extract_img_src(body), SWR_URL),
            }
        )
    return deduplicate_cards(cards)


def parse_swr_detail(page: str) -> dict[str, str]:
    fields = {}
    for match in re.finditer(r"<li>\s*<span>(?P<label>.*?)</span>(?P<value>.*?)</li>", page, re.DOTALL):
        label = clean_html(match.group("label"))
        value = clean_html(match.group("value"))
        if label and value:
            fields[label] = value
    return fields


def make_swr_notes(detail: dict[str, str]) -> str | None:
    parts = []
    for label in ("접수기간", "신청방법", "교육시간", "문의전화"):
        if detail.get(label):
            parts.append(f"{label} {detail[label]}")
    return ". ".join(parts) or None


def is_swr_content_url(value: str | None) -> bool:
    if not value or value.startswith("#") or value.startswith("javascript:"):
        return False
    return any(
        token in value
        for token in (
            "/museum/cpage/board/event/",
            "/museum/cpage/board/edu_museum_press/",
            "/museum/cpage/contents/C0016",
            "/museum/cpage/contents/C0017",
            "yeyak.seoul.go.kr",
        )
    )


def extract_first_href(value: str) -> str | None:
    match = re.search(r'<a\s+[^>]*href="(?P<value>[^"]+)"', value)
    return clean_html(match.group("value")) if match else None


def extract_img_alt(value: str) -> str | None:
    match = re.search(r'<img\s+[^>]*alt="(?P<value>[^"]*)"', value)
    return clean_html(match.group("value")) if match else None


def extract_img_src(value: str) -> str | None:
    match = re.search(r'<img\s+[^>]*src="(?P<value>[^"]*)"', value)
    return clean_html(match.group("value")) if match else None


def extract_first_link_text(value: str) -> str | None:
    match = re.search(r"<a\s+[^>]*>(?P<value>.*?)</a>", value, re.DOTALL)
    return clean_html(match.group("value")) if match else None


def extract_mark_or_status(value: str) -> str | None:
    match = re.search(r'<span[^>]*class="mark"[^>]*>(?P<value>.*?)</span>', value, re.DOTALL)
    if match:
        return clean_html(match.group("value"))
    spans = re.findall(r"<span[^>]*>(?P<value>.*?)</span>", value, re.DOTALL)
    return clean_html(spans[-1]) if spans else None


def extract_period_text(value: str) -> str | None:
    match = re.search(r"<dd>(?P<value>.*?)</dd>", value, re.DOTALL)
    return clean_html(match.group("value")) if match else None


def parse_korean_date_range(value: str | None, captured_at: str) -> tuple[str | None, str | None]:
    if not value:
        return None, None
    year = date.fromisoformat(captured_at).year
    text = value.replace(" ", "")
    matches = re.findall(r"(?:(20\d{2})[.\-/년])?(\d{1,2})[.\-/월](\d{1,2})", text)
    dates = [date(int(match_year) if match_year else year, int(month), int(day)).isoformat() for match_year, month, day in matches]
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


def deduplicate_cards(cards: list[dict[str, str | None]]) -> list[dict[str, str | None]]:
    seen = set()
    result = []
    for card in cards:
        key = (card.get("title"), card.get("url"))
        if key in seen:
            continue
        seen.add(key)
        result.append(card)
    return result


def make_tags(venue: Venue) -> list[str]:
    tags = {"실내", "보호자동반"}
    if "무료" in venue.price_text:
        tags.add("무료")
    if venue.reservation_required:
        tags.add("예약필요")
    if "영유아" in venue.age_text:
        tags.add("24개월이하")
    return sorted(tags)


def make_stable_suffix(*values: str) -> str:
    digest = hashlib.sha1("|".join(values).encode("utf-8")).hexdigest()
    return digest[:12]


def absolutize(value: str | None, base_url: str) -> str | None:
    if not value:
        return None
    return urljoin(base_url, value)


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

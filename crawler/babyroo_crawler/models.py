from __future__ import annotations

from dataclasses import asdict, dataclass, field
from datetime import date
from typing import Any


@dataclass
class RawEvent:
    source: str
    source_event_id: str
    title: str
    url: str
    captured_at: str
    payload: dict[str, Any]

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


@dataclass
class NormalizedEvent:
    id: str
    title: str
    category: str | None
    starts_at: str | None
    ends_at: str | None
    region: str | None
    locality: str | None
    venue_name: str | None
    venue_detail: str | None
    address: str | None
    age_min_months: int | None
    age_max_months: int | None
    guardian_required: bool | None
    price_type: str | None
    price_text: str | None
    reservation_required: bool | None
    reservation_status: str | None
    indoor: bool | None
    stroller_friendly: bool | None
    nursing_room: bool | None
    parking: bool | None
    tags: list[str] = field(default_factory=list)
    summary: str | None = None
    source: str | None = None
    source_url: str | None = None
    source_event_id: str | None = None
    last_checked_at: str | None = None

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


def today_iso() -> str:
    return date.today().isoformat()

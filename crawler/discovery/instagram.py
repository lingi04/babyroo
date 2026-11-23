"""Instagram discovery channel.

Intended shape (one sample = a handful of venue candidates surfaced from
Instagram):

    {
      "source": "instagram",
      "name": "인스타 <태그/계정>",
      "fetched_at": "2026-11-17",
      "candidates": [
        {
          "venue_name": "서울 상상나라",
          "locality": "광진구",
          "url": "https://...",
          "snippet": "...",
          "platform": "instagram",
          "method": "manual_input",
        },
      ],
    }

Access reality
--------------
* Automation needs a Meta Graph API token (business/management app).
  Personal-account scraping is blocked and violates Meta's policy.
* Until a token is available, this channel runs in "manual input" mode:
  the collector reads a hand-maintained list of candidates, treats them as
  a fresh discovery source, and exposes them for the change report.  That
  is the "manual input" the user asked for.

No secret values live in this file; a Graph token is read from env only
if/when the user provisions one.
"""
from __future__ import annotations

import os
from datetime import date
from typing import Any

from .channels import Sample, register

INSTA_TOKEN = os.getenv("INSTA_GRAPH_TOKEN", "").strip()

# Hand-maintained candidates: one row per venue the user has seen on
# Instagram (or elsewhere).  `method` is "manual_input" now.
MANUAL_CANDIDATES = [
    {
        "venue_name": "서울 상상나라",
        "locality": "광진구",
        "url": "https://www.seoulchildrensmuseum.org/",
        "snippet": "서울형 키즈카페 + 전시, 보호자 동반",
        "platform": "instagram",
        "source": "discovery",
        "method": "manual_input",
    },
    {
        "venue_name": "비가 오는 날 실내 나들이",
        "locality": "종로구",
        "url": "https://place.map.kakao.com/22257641?subMenu=map",
        "snippet": "실내 아이스 뮤지엄, 가족 나들이",
        "platform": "instagram",
        "source": "discovery",
        "method": "manual_input",
    },
]


def sample(name: str = "instagram") -> Sample:
    if INSTA_TOKEN:
        # Future: query Graph API for tagged venues.  Not wired yet.
        method: str = "api_token"
        snippet: str = "Graph API 수집 예정"
        candidates: list[dict[str, Any]] = []
    else:
        method = "manual_input"
        snippet = "수동 후보 목록 (수동 입력으로 수집 중)"
        candidates = [
            {
                "venue_name": c["venue_name"],
                "locality": c.get("locality"),
                "url": c["url"],
                "snippet": c["snippet"],
                "platform": c["platform"],
                "source": c["source"],
                "method": method,
            }
            for c in MANUAL_CANDIDATES
        ]

    return {
        "source": "instagram",
        "name": f"인스타 {name}",
        "fetched_at": date.today().isoformat(),
        "candidates": candidates,
    }


register("instagram", sample)

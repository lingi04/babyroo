"""Google Alerts + 검색트렌드 채널.

키워드 세트를 주기적으로 스윕(survey)해 '지금 어디가 뜨거운가'를 잡는
채널이다. 검색엔진(구글) 결과를 읽어 최근 surfaced된 기사/블로그 글과
그 속에 나오는 장소 후보를 수집한다.

Access reality
--------------
Google Alerts는 이메일 알림 구독 서비스로 공개 API가 없다. 그래서
"실시간 이메일 알림"이 아니라, 이 채널은 **키워드 스윕**으로 대체한다.

- 스윕은 `web_search` 백엔드로 수행한다 (한 번 돌릴 때마다 4개 키워드,
  키워드당 상위 5건).
- 결과는 `data/discovery/google_alerts.json`에 저장해 두고, 다음 실행
  때 중복을 제거해 trend signal(신규/상동/감소)을 만든다.
- '새 사건/새 장소'가 생기면 `candidates` + `changed`로 리포트한다.

한계
----
- 검색 결과 제목/설명에서 장소를 뽑기는 하지만, 전부 정확한 venue
  레코드는 아니다. 반드시 사람이 눈으로 보고 `discovery_candidates.md`
  에 복사/추가/삭제 한 뒤 업로드(예: 앱 DB)해야 한다.
- 실제 실시간 이메일 알림은 구글 계정 + Google Alerts 구독으로 별도
  설정해야 한다. 여기서는 트렌드/스윕 용도로만 쓴다.
"""
from __future__ import annotations

import datetime as _dt
import json
import os
from datetime import date
from pathlib import Path
from typing import Any

from .channels import register, Sample

ROOT = Path(__file__).resolve().parents[2]  # /opt/data/babyroo
DATA_DIR = ROOT / "data" / "discovery"
SOURCE_FILE = DATA_DIR / "google_alerts.json"

# 현재 스윕 대상 키워드 (주 1회 또는 요청 시 실행)
KEYWORDS = [
    "서울 키즈카페 아이랑 실내",
    "아기랑 나들이 서울 주말",
    "서울 무료 아이 체험 전시",
    "서울 가족 나들이 공원",
]

SOURCE = "google_alerts"
METHOD = "trend_sweep"


def _load_hits() -> dict:
    if not os.path.exists(SOURCE_FILE):
        return {"generated_at": date.today().isoformat(), "keywords": {}, "candidate_count": 0}
    with open(SOURCE_FILE, encoding="utf-8") as f:
        return json.load(f)


def _dedupe(results: list[dict]) -> list[dict]:
    seen, out = set(), []
    for r in results:
        if r.get("url") in seen:
            continue
        seen.add(r.get("url"))
        out.append(r)
    return out


def sample(name: str = "google_alerts") -> Sample:
    data = _load_hits()
    keywords = data.get("keywords", {})
    now = date.today().isoformat()

    candidates: list[dict] = []
    keyword_signals: dict = {}
    seen_urls: set = set()

    for kw, hits in keywords.items():
        placed = []
        for h in hits:
            # 정제 상태가 있으면 신규 후보만 추천 시트로 보낸다.
            # 원본 검색 링크는 discovery_url로 보존하고 앱 후보 URL은
            # 운영 주체가 관리하는 official_url을 사용한다.
            status = h.get("status")
            if status and status != "new_candidate":
                continue
            url = h.get("official_url") or h.get("url", "")
            if url in seen_urls:
                continue
            seen_urls.add(url)
            placed.append(
                {
                    "venue_name": h.get("venue_name") or h.get("title") or "(제목 없음)",
                    "locality": h.get("locality") or "",
                    "address": h.get("address") or "",
                    "url": url,
                    "official_url": h.get("official_url"),
                    "official_url_type": h.get("official_url_type"),
                    "discovery_url": h.get("discovery_url") or h.get("url"),
                    "snippet": (h.get("description") or "").replace("  ", " ").strip(),
                    "source": SOURCE,
                    "method": METHOD,
                    "keyword": kw,
                    "rank": h.get("rank"),
                    "fetched_at": now,
                }
            )
        keyword_signals[kw] = {
            "queries": len(hits),
            "candidates": len(placed),
            "top_hit": placed[0]["venue_name"] if placed else None,
        }
        candidates.extend(placed)

    # 겹치는 URL 제거
    candidates = _dedupe(candidates)

    return {
        "source": SOURCE,
        "name": f"{SOURCE} {name}",
        "fetched_at": now,
        "keyword_count": len(keywords),
        "candidate_count": len(candidates),
        "candidates": candidates,
        "keyword_signals": keyword_signals,
        "method": METHOD,
        "meta": {"source_file": str(SOURCE_FILE), "note": "실제 Google Alerts 이메일이 아닌 검색 스윕"},
    }


def collect() -> dict:
    return _dedupe(sample()["candidates"])


register("google_alerts", sample)

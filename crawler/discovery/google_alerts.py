"""Read results acquired by Hermes/an external search feeder, not Google Alerts API.

The producer must atomically replace its JSON only after a successful search:
{generated_at: ISO-date-or-timestamp, keywords: {query: [{url, title, ...}]}}.
No search, network request, or refresh of acquisition dates occurs here.
"""
from __future__ import annotations

import json
from datetime import date, datetime
from pathlib import Path
from urllib.parse import urlsplit

from .channels import register
from .extraction_schema import read_json, validate_bundle, fresh_date, BundleError, Limits


def http_url(value) -> bool:
    try:
        parsed = urlsplit(value)
        return bool(isinstance(value, str) and parsed.scheme in ("http", "https")
                    and parsed.hostname and not parsed.username and not parsed.password)
    except (TypeError, ValueError, AttributeError):
        return False


def sample(input_path: Path, max_age_days: int = 8, today: date | None = None, limits: Limits = Limits()) -> dict:
    today = today or date.today()
    if max_age_days < 0:
        raise ValueError("discovery max age must be nonnegative")
    try:
        data = read_json(input_path, limits.bundle_bytes)
        if not isinstance(data, dict):
            raise ValueError("feeder must be an object")
        version = data.get("schema_version", 1)
        if type(version) is not int or version not in (1, 2):
            raise ValueError("unsupported feeder schema version")
        value = data["generated_at"]
        acquired = date.fromisoformat(fresh_date(value, today, max_age_days))
        keywords = data.get("keywords", {})
    except (OSError, KeyError, TypeError, ValueError) as exc:
        raise ValueError(f"invalid/missing discovery feeder input: {exc}") from exc
    age = (today - acquired).days
    if age < 0 or age > max_age_days:
        raise ValueError(f"discovery input date {value} is future-dated or stale (maximum {max_age_days} days)")
    if not isinstance(keywords, dict) or (not keywords and version == 1):
        raise ValueError("discovery keywords must be a nonempty object; each query may have an empty results list")
    candidates = {}
    for keyword, hits in sorted(keywords.items()):
        if not isinstance(keyword, str) or not keyword.strip() or not isinstance(hits, list):
            raise ValueError("discovery keywords must map nonempty query strings to lists")
        for hit in hits:
            if not isinstance(hit, dict) or not http_url(hit.get("url")):
                raise ValueError(f"invalid discovery hit for {keyword}")
            if hit.get("official_url") is not None and not http_url(hit["official_url"]):
                raise ValueError("invalid provided official_url")
            for field in ("title", "description", "venue_name", "locality", "address", "status"):
                if hit.get(field) is not None and not isinstance(hit[field], str):
                    raise ValueError(f"invalid discovery {field}")
            if hit.get("status") not in (None, "new_candidate"):
                continue
            url = hit["url"]
            candidates.setdefault(url, {
                "discovery_url": url,
                "venue_name": hit.get("venue_name") or hit.get("title") or "(untitled)",
                "locality": hit.get("locality") or "",
                "address": hit.get("address") or "",
                "snippet": hit.get("description") or "",
                "official_url": hit.get("official_url"),
                "keyword": keyword,
            })
    result = {"source": "google_alerts", "fetched_at": value,
              "candidates": sorted(candidates.values(), key=lambda c: c["discovery_url"])}
    if version == 2:
        result["extraction_bundle"] = validate_bundle(data, Path(input_path).parent, max_age_days, today, limits)
    return result


register("google_alerts", sample)

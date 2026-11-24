"""Bounded, rotating queue of known sources, pending leads and new discoveries."""
from __future__ import annotations

import hashlib
from pathlib import Path

from .extraction_schema import canonical_url, BundleError


def candidate_id(url):
    return "candidate-" + hashlib.sha256(canonical_url(url).encode()).hexdigest()[:24]


def build_queue(catalog, review, registry, fresh, operational=None, budget=20, native_sources=()):
    if type(budget) is not int or not 1 <= budget <= 20:
        raise BundleError("candidate budget must be 1..20")
    operational = operational or {"recheck_cursor": 0, "fresh_cursor": 0}
    if not isinstance(operational, dict) or any(type(operational.get(k)) is not int or operational[k] < 0
                                               for k in ("recheck_cursor", "fresh_cursor")):
        raise BundleError("invalid local queue cursor")
    known, new = {}, {}
    for event in catalog["events"]:
        if event["source"] not in native_sources and event.get("source_url"):
            url = canonical_url(event["source_url"])
            known[candidate_id(url)] = {"candidate_id": candidate_id(url), "discovery_url": url, "reason": "known_external_source"}
    for entry in registry.get("entries", []):
        url = canonical_url(entry["canonical_url"])
        known[candidate_id(url)] = {"candidate_id": candidate_id(url), "discovery_url": url, "reason": "known_external_source"}
    for item in review.get("extractions", []):
        if item.get("status") == "needs_review" and item.get("decision") not in {"dismissed", "resolved"}:
            known[item["candidate_id"]] = {"candidate_id": item["candidate_id"], "discovery_url": canonical_url(item["discovery_url"]), "reason": "pending_review"}
    for item in review.get("candidates", []):
        if item.get("decision") not in {"dismissed", "resolved"}:
            url = canonical_url(item["discovery_url"])
            known.setdefault(candidate_id(url), {"candidate_id": candidate_id(url), "discovery_url": url, "reason": "pending_discovery"})
    by_url = {}
    for row in known.values():
        old = by_url.get(row["discovery_url"])
        if old is None or row["reason"] == "pending_review":
            by_url[row["discovery_url"]] = row
    known = {row["candidate_id"]: row for row in by_url.values()}
    known_urls = {item["discovery_url"] for item in known.values()}
    blocked_urls = {canonical_url(item["discovery_url"])
                    for item in [*review.get("candidates", []), *review.get("extractions", [])]
                    if item.get("decision") in {"dismissed", "resolved"} and item.get("proposal_id") is None and item.get("discovery_url")}
    backlog = operational.get("backlog", [])
    if not isinstance(backlog, list):
        raise BundleError("invalid local discovery backlog")
    for item in [*backlog, *fresh]:
        if not isinstance(item, dict) or "discovery_url" not in item:
            raise BundleError("invalid discovery backlog/lead row")
        url = canonical_url(item["discovery_url"])
        if url not in known_urls and url not in blocked_urls:
            new[candidate_id(url)] = {"candidate_id": candidate_id(url), "discovery_url": url, "reason": "new_search_lead"}
    def rotated(items, cursor):
        rows = sorted(items.values(), key=lambda r: r["candidate_id"])
        if not rows:
            return []
        offset = cursor % len(rows)
        return rows[offset:] + rows[:offset]
    krows = rotated(known, operational["recheck_cursor"])
    nrows = rotated(new, operational["fresh_cursor"])
    kcount = min(len(krows), (budget + 1) // 2)
    ncount = min(len(nrows), budget // 2)
    extra = budget - kcount - ncount
    add_known = min(extra, len(krows) - kcount)
    kcount += add_known
    ncount += min(extra - add_known, len(nrows) - ncount)
    selected = krows[:kcount] + nrows[:ncount]
    # The complete backlog stays outside Git; selection does not mark extraction successful.
    checkpoint = {"recheck_cursor": operational["recheck_cursor"] + kcount,
                  "fresh_cursor": operational["fresh_cursor"] + ncount,
                  "backlog": [{"discovery_url": new[k]["discovery_url"]} for k in sorted(new)]}
    return {"schema_version": 1, "selected": selected,
            "deferred": krows[kcount:] + nrows[ncount:]}, checkpoint

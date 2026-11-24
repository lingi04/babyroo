"""Version-2 feeder validation. No network or model calls."""
from __future__ import annotations

import hashlib
import json
import copy
import re
import unicodedata
from dataclasses import dataclass
from datetime import date, datetime
from pathlib import Path
from urllib.parse import urlsplit, urlunsplit, parse_qsl, urlencode

PERMANENT_START = "1970-01-01"
PERMANENT_END = "9999-12-31"
ID_PATTERN = re.compile(r"[A-Za-z0-9_-]{1,100}\Z")
KINDS = {"dated_event", "permanent_venue", "uncertain"}
OUTCOMES = {"extracted", "fetch_failed", "needs_review", "budget_deferred"}
TEXT_FIELDS = {"title", "venue_name", "venue_detail", "address", "locality", "region",
               "category", "starts_at", "ends_at", "price_text", "price_type",
               "reservation_status", "summary"}
INTEGER_FIELDS = {"age_min_months", "age_max_months"}
BOOLEAN_FIELDS = {"indoor", "reservation_required", "guardian_required", "stroller_friendly",
                  "nursing_room", "parking"}
FACT_FIELDS = TEXT_FIELDS | INTEGER_FIELDS | BOOLEAN_FIELDS | {"tags"}
CATEGORIES = {"performance", "experience", "play_space", "exhibition", "camp", "class", "festival", "other"}


@dataclass(frozen=True)
class Limits:
    candidates: int = 20
    documents_per_candidate: int = 3
    proposals: int = 40
    document_bytes: int = 100 * 1024
    bundle_bytes: int = 5 * 1024 * 1024


class BundleError(ValueError):
    """Malformed batch: reject it before any catalog output is installed."""


def exact_keys(value, allowed, required=()):
    if not isinstance(value, dict) or set(value) - set(allowed) or set(required) - set(value):
        raise BundleError("invalid object keys or missing required keys")


def identifier(value):
    if not isinstance(value, str) or not ID_PATTERN.fullmatch(value):
        raise BundleError("invalid identifier")
    return value


def http_url(value):
    try:
        parts = urlsplit(value)
        return bool(isinstance(value, str) and len(value) <= 4096 and parts.scheme in ("http", "https")
                    and parts.hostname and not parts.username and not parts.password
                    and not any(ord(c) < 32 for c in value) and parts.port != 0)
    except (ValueError, TypeError, AttributeError):
        return False


def canonical_url(value):
    if not http_url(value):
        raise BundleError("invalid HTTP(S) URL")
    parts = urlsplit(value)
    # Preserve business query parameters, including duplicates and order.
    query = [(k, v) for k, v in parse_qsl(parts.query, keep_blank_values=True)
             if not k.lower().startswith("utm_") and k.lower() not in {"fbclid", "gclid"}]
    return urlunsplit((parts.scheme.lower(), parts.netloc.lower(), parts.path.rstrip("/") or "/",
                       urlencode(query), ""))


def fresh_date(value, today=None, max_age_days=8):
    today = today or date.today()
    try:
        if not isinstance(value, str) or max_age_days < 0:
            raise ValueError()
        parsed = date.fromisoformat(value) if len(value) == 10 else datetime.fromisoformat(value.replace("Z", "+00:00")).date()
    except (ValueError, TypeError):
        raise BundleError("invalid acquisition date")
    if not 0 <= (today - parsed).days <= max_age_days:
        raise BundleError("stale or future-dated acquisition")
    return parsed.isoformat()


def normalized_text(text):
    return unicodedata.normalize("NFC", text.replace("\r\n", "\n").replace("\r", "\n"))


def read_json(path, limit=5 * 1024 * 1024, return_bytes=False):
    def unique(pairs):
        result = {}
        for key, value in pairs:
            if key in result:
                raise BundleError("duplicate JSON key")
            result[key] = value
        return result
    try:
        path = Path(path)
        if path.stat().st_size > limit:
            raise BundleError("JSON input exceeds budget")
        with path.open("rb") as stream:
            data = stream.read(limit + 1)
        if len(data) > limit:
            raise BundleError("JSON input exceeds budget")
        parsed = json.loads(data, object_pairs_hook=unique)
        return (parsed, data) if return_bytes else parsed
    except (OSError, UnicodeError, json.JSONDecodeError) as exc:
        raise BundleError(f"unreadable JSON input: {exc}") from exc


def unique_objects(rows, key):
    if not isinstance(rows, list):
        raise BundleError("expected object list")
    result = {}
    for row in rows:
        if not isinstance(row, dict):
            raise BundleError("expected object")
        name = identifier(row.get(key))
        if name in result:
            raise BundleError("duplicate identifier")
        result[name] = row
    return result


def references(values, available):
    if not isinstance(values, list) or any(not isinstance(v, str) for v in values):
        raise BundleError("invalid reference list")
    if len(set(values)) != len(values) or set(values) - set(available):
        raise BundleError("duplicate or dangling reference")
    return set(values)


def validate_bundle(data, root, max_age_days=8, today=None, limits=Limits()):
    exact_keys(data, {"schema_version", "batch_id", "generated_at", "keywords", "queued_candidate_ids", "queue_sha256",
                      "candidates", "source_documents", "proposals"},
               {"schema_version", "batch_id", "generated_at", "queued_candidate_ids", "queue_sha256",
                "candidates", "source_documents", "proposals"})
    if type(data["schema_version"]) is not int or data["schema_version"] != 2:
        raise BundleError("unsupported extraction schema version")
    identifier(data["batch_id"])
    acquired = fresh_date(data["generated_at"], today, max_age_days)
    candidates = unique_objects(data["candidates"], "candidate_id")
    proposals = unique_objects(data["proposals"], "proposal_id")
    documents = unique_objects(data["source_documents"], "document_id")
    root = Path(root).resolve()
    queue_path = root / "queue.json"
    if root not in queue_path.resolve().parents:
        raise BundleError("queue manifest escapes batch root")
    queue, encoded_queue = read_json(queue_path, limits.bundle_bytes, return_bytes=True)
    if hashlib.sha256(encoded_queue).hexdigest() != data["queue_sha256"]:
        raise BundleError("queue manifest hash mismatch")
    selected = unique_objects(queue.get("selected") if isinstance(queue, dict) else None, "candidate_id")
    if set(selected) != set(candidates) or any(
            canonical_url(selected[cid].get("discovery_url")) != canonical_url(candidates[cid].get("discovery_url")) for cid in selected):
        raise BundleError("batch does not account for selected queue manifest")
    if references(data["queued_candidate_ids"], candidates) != set(candidates):
        raise BundleError("unaccounted queued candidates")
    if len(proposals) > limits.proposals or len(candidates) > 1000:
        raise BundleError("proposal/candidate budget exceeded")
    active = 0
    claimed = set()
    for cid, candidate in candidates.items():
        exact_keys(candidate, {"candidate_id", "discovery_url", "outcome", "proposal_ids", "reason"},
                   {"candidate_id", "discovery_url", "outcome", "proposal_ids"})
        if not http_url(candidate["discovery_url"]) or candidate["outcome"] not in OUTCOMES:
            raise BundleError("invalid candidate URL/outcome")
        if candidate["outcome"] != "budget_deferred":
            active += 1
        ids = references(candidate["proposal_ids"], proposals)
        if candidate["outcome"] == "extracted":
            if not ids or claimed & ids:
                raise BundleError("missing or multiply claimed proposals")
        elif ids or not re.fullmatch(r"[a-z0-9_]{1,80}", str(candidate.get("reason", ""))):
            raise BundleError("failed/deferred candidate requires a reason code and no proposals")
        for pid in ids:
            if proposals[pid].get("candidate_id") != cid:
                raise BundleError("proposal belongs to another candidate")
        claimed |= ids
    if active > limits.candidates or claimed != set(proposals):
        raise BundleError("candidate budget exceeded or unclaimed proposal")
    loaded, total = {}, len(json.dumps(data, ensure_ascii=False).encode("utf-8"))
    per_candidate = {cid: 0 for cid in candidates}
    for did, document in documents.items():
        exact_keys(document, {"document_id", "candidate_ids", "url", "fetched_at", "text_file", "text_sha256",
                              "kind", "tool_reference", "truncated"},
                   {"document_id", "candidate_ids", "url", "fetched_at", "text_file", "text_sha256", "kind"})
        owners = references(document["candidate_ids"], candidates)
        if not owners or document["kind"] not in {"official_detail", "secondary", "search_snippet"} or not http_url(document["url"]):
            raise BundleError("invalid document ownership, kind or URL")
        if document.get("truncated") is not None and type(document["truncated"]) is not bool:
            raise BundleError("invalid truncated flag")
        if document.get("tool_reference") is not None and not isinstance(document["tool_reference"], str):
            raise BundleError("invalid tool reference")
        for cid in owners:
            per_candidate[cid] += 1
            if per_candidate[cid] > limits.documents_per_candidate:
                raise BundleError("per-candidate document budget exceeded")
        fetched = fresh_date(document["fetched_at"], today, max_age_days)
        if fetched > acquired:
            raise BundleError("document newer than acquisition batch")
        if document["text_file"] != f"documents/{did}.txt":
            raise BundleError("document filenames must be generated from document IDs")
        path = root / document["text_file"]
        if root not in path.resolve().parents:
            raise BundleError("document path escapes batch root")
        try:
            if path.stat().st_size > limits.document_bytes:
                raise BundleError("document exceeds text budget")
            with path.open("rb") as stream:
                raw = stream.read(limits.document_bytes + 1)
            text = raw.decode("utf-8")
        except (OSError, UnicodeError) as exc:
            raise BundleError(f"unreadable source document {did}") from exc
        total += len(raw)
        if len(raw) > limits.document_bytes or total > limits.bundle_bytes:
            raise BundleError("source text budget exceeded")
        if text != normalized_text(text) or hashlib.sha256(raw).hexdigest() != document["text_sha256"]:
            raise BundleError("source text normalization/hash mismatch")
        loaded[did] = {**document, "text": text, "checked_date": fetched}
    for pid, proposal in proposals.items():
        exact_keys(proposal, {"proposal_id", "candidate_id", "record_kind", "source_url", "source_event_id",
                             "edition", "source_document_ids", "fields", "evidence_by_field",
                             "classification_evidence", "authority"},
                   {"proposal_id", "candidate_id", "record_kind", "source_url", "source_document_ids",
                    "fields", "evidence_by_field", "classification_evidence", "authority"})
        if proposal["record_kind"] not in KINDS or not http_url(proposal["source_url"]):
            raise BundleError("invalid proposal kind or source URL")
        if proposal.get("source_event_id") is not None and (not isinstance(proposal["source_event_id"], str) or not proposal["source_event_id"].strip()):
            raise BundleError("source event ID must be nonempty text or null")
        if proposal.get("edition") is not None and (not isinstance(proposal["edition"], str) or not proposal["edition"].strip()):
            raise BundleError("edition must be nonempty text or null")
        refs = references(proposal["source_document_ids"], documents)
        if not refs or any(proposal["candidate_id"] not in documents[did]["candidate_ids"] for did in refs):
            raise BundleError("missing or foreign proposal documents")
        if not isinstance(proposal["fields"], dict) or set(proposal["fields"]) - FACT_FIELDS:
            raise BundleError("unknown or ownership-controlled extracted field")
        if not isinstance(proposal["evidence_by_field"], dict) or set(proposal["evidence_by_field"]) - (FACT_FIELDS | {"source_event_id", "edition"}):
            raise BundleError("invalid evidence field map")
        evidence = list(proposal["evidence_by_field"].values()) + [proposal["classification_evidence"]]
        exact_keys(proposal["authority"], {"publisher_name", "role", "evidence"}, {"publisher_name", "role", "evidence"})
        if not isinstance(proposal["authority"]["publisher_name"], str) or not isinstance(proposal["authority"]["role"], str):
            raise BundleError("invalid authority value type")
        evidence.append(proposal["authority"]["evidence"])
        for ref in evidence:
            exact_keys(ref, {"document_id", "quote", "confidence", "method"}, {"document_id", "quote"})
            if ref["document_id"] not in refs or not isinstance(ref["quote"], str) or not 0 < len(ref["quote"]) <= 400:
                raise BundleError("invalid evidence quote/reference")
            if "confidence" in ref and (type(ref["confidence"]) not in (int, float) or not 0 <= ref["confidence"] <= 1):
                raise BundleError("invalid confidence")
            if "method" in ref and ref["method"] not in {"literal", "derived"}:
                raise BundleError("invalid extraction method")
    return {"schema_version": 2, "fetched_at": data["generated_at"], "checked_date": acquired,
            "batch_id": data["batch_id"], "candidates_by_id": candidates,
            "documents": loaded, "proposals": proposals, "payload": copy.deepcopy(data)}


def resolve_quote(ref, bundle):
    doc = bundle["documents"][ref["document_id"]]
    text, quote = doc["text"], ref["quote"]
    start = text.find(quote)
    if start < 0 or text.find(quote, start + 1) >= 0:
        return None
    return {"document_id": doc["document_id"], "url": doc["url"], "kind": doc["kind"],
            "fetched_at": doc["fetched_at"], "text_sha256": doc["text_sha256"],
            "quote": quote, "span": [start, start + len(quote)]}

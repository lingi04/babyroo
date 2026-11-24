"""Evidence-backed extraction adapter and durable event identities."""
from __future__ import annotations

import copy
import hashlib
import re
from datetime import date
from difflib import SequenceMatcher
from urllib.parse import urlsplit

from babyroo_crawler.normalize import parse_age_min_months, parse_age_max_months
from discovery_official import is_official
from .extraction_schema import (FACT_FIELDS, TEXT_FIELDS, INTEGER_FIELDS, BOOLEAN_FIELDS,
    CATEGORIES, PERMANENT_START, PERMANENT_END, BundleError, canonical_url, resolve_quote)


def text_key(value):
    return re.sub(r"[^\w가-힣]", "", str(value or "").casefold())


def supported_date(value, quote):
    try:
        if type(value) is not str or len(value) != 10 or date.fromisoformat(value).isoformat() != value:
            return False
    except ValueError:
        return False
    year, month, day = map(int, value.split("-"))
    pattern = rf"{year}\s*[년./-]\s*0?{month}\s*[월./-]\s*0?{day}(?:일|\b)"
    return bool(re.search(pattern, quote))


def supported_boolean(key, value, quote):
    patterns = {
        "indoor": (r"실내|indoor", r"실외|야외|outdoor"),
        "parking": (r"주차\s*(?:(?:장|시설|공간)\s*)?(?:가능|있|제공|무료|유료|운영)", r"주차\s*(?:(?:장|시설|공간)\s*)?(?:은|는|이|가)?\s*(?:불가|불가능|없|금지|미제공|미운영)"),
        "nursing_room": (r"수유실\s*(?:있|운영|제공|설치|이용|안내)", r"수유실\s*(?:은|는|이|가)?\s*(?:없|미설치|미운영|이용\s*불가)"),
        "stroller_friendly": (r"유모차\s*(?:(?:이용|반입|동반)\s*)?(?:가능|허용|대여|지원)", r"유모차\s*(?:(?:이용|반입|동반)\s*)?(?:불가|금지)"),
        "guardian_required": (r"(?:보호자|양육자)\s*동반\s*(?:필수|해야|의무)", r"(?:보호자|양육자)\s*(?:없이|동반\s*불필요)"),
        "reservation_required": (r"(?:사전\s*)?예약\s*(?:필수|해야|의무)|예약제", r"예약\s*(?:없이|불필요|없음)|현장\s*자유\s*입장"),
    }
    subjects = {"indoor": r"실내|indoor", "parking": "주차", "nursing_room": "수유실", "stroller_friendly": "유모차",
                "guardian_required": "보호자|양육자", "reservation_required": "예약"}
    negative_pattern = (r"(?:" + subjects[key] + r")\s*(?:(?:장|시설|공간|동반)\s*)?(?:은|는|이|가)?\s*"
                        r"(?:(?:운영|제공|설치|이용|반입|동반|허용|가능|필수|안내)\s*)?"
                        r"(?:아[니님닌닙]\S*|하지\s*않\S*|불가\S*|없\S*|미제공|미운영|금지)")
    no = bool(re.search(patterns[key][1], quote, re.I) or re.search(negative_pattern, quote, re.I))
    positive_text = re.sub(negative_pattern, "", quote, flags=re.I)
    yes = bool(re.search(patterns[key][0], positive_text, re.I))
    return (yes and not no) if value else (no and not yes)


def validate_proposal(proposal, bundle):
    fields = proposal["fields"]
    reasons, evidence = [], {}
    defaults = {key: None for key in sorted(FACT_FIELDS)}
    defaults.update(price_type="unknown", reservation_status="unknown", tags=[])
    defaults.update(fields)
    for key, value in fields.items():
        valid = (value is None or (key in TEXT_FIELDS and isinstance(value, str) and len(value) <= 4000)
                 or (key in INTEGER_FIELDS and type(value) is int and value >= 0)
                 or (key in BOOLEAN_FIELDS and type(value) is bool)
                 or (key == "tags" and isinstance(value, list) and all(isinstance(x, str) and len(x) <= 100 for x in value)))
        if not valid:
            reasons.append("invalid_field_type:" + key)
            continue
        if value is None or value == [] or (key in {"price_type", "reservation_status"} and value == "unknown"):
            continue
        ref = proposal["evidence_by_field"].get(key)
        resolved = resolve_quote(ref, bundle) if ref else None
        if not resolved or resolved["kind"] != "official_detail":
            reasons.append("missing_official_evidence:" + key)
        else:
            evidence[key] = resolved
    if any(reason.startswith("invalid_field_type:") for reason in reasons):
        defaults.update(source_url=canonical_url(proposal["source_url"]), last_checked_at=bundle["checked_date"])
        return defaults, sorted(set(reasons)), evidence
    for key in ("title", "venue_name", "category"):
        if not isinstance(defaults[key], str) or not defaults[key].strip():
            reasons.append("missing_required:" + key)
    if not defaults["region"] and not defaults["address"]:
        reasons.append("missing_location")
    if defaults["category"] not in CATEGORIES:
        reasons.append("unsupported_category")
    elif "category" in evidence:
        category_terms = {
            "exhibition": r"전시|박물관|미술관|exhibition|museum|gallery",
            "performance": r"공연|연극|뮤지컬|음악회|concert|performance|theat[er]",
            "experience": r"체험|탐방|견학|experience|workshop",
            "play_space": r"키즈\s*카페|놀이터|놀이\s*(?:공간|시설)|playground|kids.?cafe",
            "camp": r"캠프|camp", "class": r"수업|강좌|교실|교육|class|course",
            "festival": r"축제|페스티벌|festival", "other": r"기타|other|공원|산책|동물원",
        }
        if (not re.search(category_terms[defaults["category"]], evidence["category"]["quote"], re.I)
                or re.search(r"(?:" + category_terms[defaults["category"]] + r").{0,12}(?:아[니님닌닙]|not)", evidence["category"]["quote"], re.I)):
            reasons.append("unsupported_category_derivation")
    if defaults["price_type"] not in {"free", "paid", "unknown"}:
        reasons.append("unsupported_price_type")
    if defaults["reservation_status"] not in {"unknown", "available", "limited", "closed"}:
        reasons.append("unsupported_reservation_status")
    for key in BOOLEAN_FIELDS:
        if defaults[key] is not None and key in evidence and not supported_boolean(key, defaults[key], evidence[key]["quote"]):
            reasons.append("unsupported_boolean_derivation:" + key)
    for key in ("title", "venue_name", "venue_detail", "address", "region", "locality", "price_text"):
        if defaults[key] and key in evidence and text_key(defaults[key]) not in text_key(evidence[key]["quote"]):
            reasons.append("unsupported_literal_value:" + key)
    if defaults["price_type"] in {"free", "paid"} and "price_type" in evidence:
        context = " ".join((evidence["price_type"]["quote"], defaults.get("price_text") or ""))
        charge = bool(re.search(r"유료|\d[\d,]*\s*원|paid", context, re.I))
        conditional = bool(re.search(r"미만|이하|회원|할인|경우|조건", context))
        if ((defaults["price_type"] == "free" and (not re.search(r"무료|free", context, re.I) or charge or conditional))
                or (defaults["price_type"] == "paid" and not charge)):
            reasons.append("unsupported_price_derivation")
    if defaults["reservation_status"] != "unknown" and "reservation_status" in evidence:
        pattern = {"available": r"예약\s*가능|접수\s*중|모집\s*중", "limited": r"잔여|선착순|제한", "closed": r"마감|종료"}.get(defaults["reservation_status"])
        if pattern and not re.search(pattern, evidence["reservation_status"]["quote"]):
            reasons.append("unsupported_reservation_derivation")
    if defaults["tags"]:
        quote = evidence.get("tags", {}).get("quote", "")
        support = {
            "무료": defaults["price_type"] == "free" and bool(re.search(r"무료|free", quote, re.I)) and not re.search(r"유료|\d[\d,]*\s*원|미만|이하|회원|할인", quote),
            "실내": supported_boolean("indoor", True, quote),
            "예약필요": supported_boolean("reservation_required", True, quote),
            "보호자동반": bool(re.search(r"(?:보호자|양육자)\s*동반", quote)) and not re.search(r"불필요|없이|아[니님닌닙]", quote),
            "24개월이하": (type(defaults["age_min_months"]) is int and defaults["age_min_months"] <= 24
                            and parse_age_min_months(quote) == defaults["age_min_months"]),
        }
        if len(set(defaults["tags"])) != len(defaults["tags"]) or any(not support.get(tag, False) for tag in defaults["tags"]):
            reasons.append("unsupported_tag_derivation")
    minimum, maximum = defaults["age_min_months"], defaults["age_max_months"]
    if type(minimum) is int and type(maximum) is int and minimum > maximum:
        reasons.append("reversed_age_range")
    for key, parser in (("age_min_months", parse_age_min_months), ("age_max_months", parse_age_max_months)):
        if defaults[key] is not None and key in evidence:
            quote = evidence[key]["quote"]
            if not re.search(r"\d+\s*(?:개월|세|학년)", quote) or parser(quote) != defaults[key]:
                reasons.append("unsupported_age_derivation:" + key)
    classification = resolve_quote(proposal["classification_evidence"], bundle)
    if not classification or classification["kind"] != "official_detail":
        reasons.append("missing_classification_evidence")
    else:
        evidence["record_kind"] = classification
    authority = proposal["authority"]
    authority_ref = resolve_quote(authority["evidence"], bundle)
    publisher = authority["publisher_name"]
    if (not isinstance(publisher, str) or not publisher.strip()
            or authority["role"] not in {"organizer", "venue_operator", "public_authority"}
            or not authority_ref or authority_ref["kind"] != "official_detail"
            or text_key(publisher) not in text_key(authority_ref["quote"])):
        reasons.append("unsupported_source_authority")
    else:
        evidence["authority"] = authority_ref
        primary_host = urlsplit(proposal["source_url"]).hostname
        if urlsplit(authority_ref["url"]).hostname != primary_host:
            reasons.append("authority_host_mismatch")
        # Each factual document must belong to the supported publisher host.
        if any(urlsplit(ref["url"]).hostname != primary_host for ref in evidence.values()):
            reasons.append("unsupported_cross_publisher_evidence")
    source_url = canonical_url(proposal["source_url"])
    if not any(canonical_url(bundle["documents"][did]["url"]) == source_url
               for did in proposal["source_document_ids"]):
        reasons.append("missing_detail_document")
    kind = proposal["record_kind"]
    if kind == "permanent_venue":
        quote = classification["quote"] if classification else ""
        negated = re.search(r"비상설|not\s+(?:permanent|ongoing)|non.permanent|(?:상설|상시|연중|permanent|ongoing).{0,24}(?:아[니님닌닙]|않|중단|종료|임시|한정|not)", quote, re.I)
        if not classification or not re.search(r"상설|상시|연중|permanent|ongoing", quote, re.I) or negated:
            reasons.append("unconfirmed_permanence")
        if fields.get("starts_at") is not None or fields.get("ends_at") is not None:
            reasons.append("permanent_dates_must_be_python_assigned")
        defaults.update(starts_at=PERMANENT_START, ends_at=PERMANENT_END)
    elif kind == "dated_event":
        if defaults["ends_at"] is None and defaults["starts_at"] is not None:
            # Only an affirmative single-day statement permits this derivation.
            single_quote = classification["quote"] if classification else ""
            single_negative = re.search(r"(?:당일|하루|single.day|one.day).{0,24}(?:아[니님닌닙]|않|not)|not.{0,12}(?:single.day|one.day)", single_quote, re.I)
            if classification and re.search(r"당일|하루|single.day|one.day", single_quote, re.I) and not single_negative:
                defaults["ends_at"] = defaults["starts_at"]
                if "starts_at" in evidence:
                    evidence["ends_at"] = {**evidence["starts_at"], "derivation": "confirmed_single_day"}
        for key in ("starts_at", "ends_at"):
            ref = evidence.get(key)
            if not ref or not supported_date(defaults[key], ref["quote"]):
                reasons.append("unsupported_date:" + key)
        if isinstance(defaults["starts_at"], str) and isinstance(defaults["ends_at"], str) and defaults["ends_at"] < defaults["starts_at"]:
            reasons.append("reversed_date_range")
    else:
        reasons.append("uncertain_record_kind")
    for key in ("edition", "source_event_id"):
        value = proposal.get(key)
        if value:
            ref = proposal["evidence_by_field"].get(key)
            resolved = resolve_quote(ref, bundle) if ref else None
            if not resolved or resolved["kind"] != "official_detail" or value not in resolved["quote"]:
                reasons.append("unsupported_identity_evidence:" + key)
            else:
                evidence[key] = resolved
    if authority_ref and any(urlsplit(ref["url"]).hostname != urlsplit(proposal["source_url"]).hostname for ref in evidence.values()):
        reasons.append("unsupported_cross_publisher_evidence")
    if sum(len(ref["quote"]) for ref in evidence.values()) > 8000:
        reasons.append("evidence_budget_exceeded")
    # Exclude any unsupported factual value from the ready stream; retain only reasons in stable state.
    checked = max(bundle["documents"][did]["checked_date"] for did in proposal["source_document_ids"])
    defaults.update(source_url=source_url, last_checked_at=checked)
    return defaults, sorted(set(reasons)), evidence


def validate_registry(value, baseline):
    if not isinstance(value, dict) or set(value) != {"schema_version", "entries"} or value["schema_version"] != 1 or not isinstance(value["entries"], list):
        raise BundleError("invalid extraction identity registry")
    ids, keys, pairs, by_id = set(), set(), set(), {e["id"]: e for e in baseline}
    required = {"identity_key", "event_id", "source", "source_event_id", "canonical_url", "url_aliases", "venue_key", "record_kind", "edition"}
    for entry in value["entries"]:
        if not isinstance(entry, dict) or set(entry) != required:
            raise BundleError("invalid identity entry")
        if not all(isinstance(entry[k], str) and entry[k] for k in ("event_id", "identity_key", "source", "source_event_id", "venue_key")):
            raise BundleError("invalid identity field type")
        if entry["event_id"] in ids or entry["identity_key"] in keys or entry["record_kind"] not in {"dated_event", "permanent_venue"}:
            raise BundleError("duplicate/invalid extraction identity")
        if not isinstance(entry["url_aliases"], list) or len(set(entry["url_aliases"])) != len(entry["url_aliases"]):
            raise BundleError("invalid URL aliases")
        for url in [entry["canonical_url"], *entry["url_aliases"]]:
            canonical_url(url)
        old = by_id.get(entry["event_id"])
        pair = (entry["source"], entry["source_event_id"])
        if pair in pairs:
            raise BundleError("duplicate registry source identity")
        if old and (old["source"], old.get("source_event_id")) != (entry["source"], entry["source_event_id"]):
            raise BundleError("identity registry conflicts with catalog")
        ids.add(entry["event_id"]); keys.add(entry["identity_key"]); pairs.add(pair)


def looks_duplicate(record, old):
    same_venue = text_key(record.get("venue_name")) == text_key(old.get("venue_name"))
    if not same_venue or not text_key(record.get("venue_name")):
        return False
    similar = SequenceMatcher(None, text_key(record["title"]), text_key(old["title"])).ratio() >= 0.8
    overlap = record["starts_at"] <= old["ends_at"] and old["starts_at"] <= record["ends_at"]
    return similar and overlap


def adapt_extractions(bundle, baseline, native, registry, native_sources, decisions=()):
    validate_registry(registry, baseline)
    registry = copy.deepcopy(registry)
    records, outcomes, observations = [], [], []
    native_ids = {e["id"] for e in native}
    native_pairs = {(e["source"], e.get("source_event_id")) for e in native if e.get("source_event_id")}
    baseline_by_id = {e["id"]: e for e in baseline}
    universe = {e["id"]: e for e in [*baseline, *native]}
    candidate_decisions = [r for r in decisions if r.get("proposal_id") is None and r.get("decision") == "dismissed"]
    dismissed_ids = {r.get("candidate_id") for r in candidate_decisions}
    dismissed_urls = {canonical_url(r["discovery_url"]) for r in candidate_decisions if r.get("discovery_url")}
    dismissed_proposals = {(r.get("candidate_id"), r["proposal_id"]) for r in decisions
                           if r.get("proposal_id") is not None and r.get("decision") == "dismissed"}
    for cid, candidate in sorted(bundle["candidates_by_id"].items()):
        if cid in dismissed_ids or canonical_url(candidate["discovery_url"]) in dismissed_urls:
            outcomes.append({"candidate_id": cid, "proposal_id": None, "discovery_url": candidate["discovery_url"],
                             "status": "rejected", "reasons": ["operator_dismissed"]})
            continue
        if candidate["outcome"] != "extracted":
            outcomes.append({"candidate_id": cid, "proposal_id": None, "discovery_url": candidate["discovery_url"],
                             "status": "needs_review", "reasons": [candidate["reason"]]})
            continue
        for pid in sorted(candidate["proposal_ids"]):
            if (cid, pid) in dismissed_proposals:
                outcomes.append({"candidate_id": cid, "proposal_id": pid, "discovery_url": candidate["discovery_url"],
                                 "status": "rejected", "reasons": ["operator_dismissed"]})
                continue
            proposal = bundle["proposals"][pid]
            record, reasons, evidence = validate_proposal(proposal, bundle)
            result = {"candidate_id": cid, "proposal_id": pid, "discovery_url": candidate["discovery_url"],
                      "source_url": record["source_url"], "status": "needs_review", "reasons": reasons}
            observation = {**result, "record_kind": proposal["record_kind"], "evidence": evidence,
                           "warnings": [] if is_official(record["source_url"]) else ["new_publisher_domain_requires_human_confirmation"],
                           "authority": {k: proposal["authority"][k] for k in ("publisher_name", "role")}}
            if not reasons:
                url = record["source_url"]
                edition, kind = proposal.get("edition"), proposal["record_kind"]
                source = "external:" + urlsplit(url).hostname.lower()
                supplied_id = proposal.get("source_event_id")
                if supplied_id and any(e["source"] == source and e["source_event_id"] == supplied_id
                                       and e["edition"] != edition for e in registry["entries"]):
                    reasons.append("official_id_reused_for_edition")
                entries = [e for e in registry["entries"] if e["record_kind"] == kind and e["edition"] == edition
                           and (url in [e["canonical_url"], *e["url_aliases"]]
                                or (supplied_id and e["source"] == source and e["source_event_id"] == supplied_id))]
                old = baseline_by_id.get(entries[0]["event_id"]) if len(entries) == 1 else None
                if not entries and supplied_id and not reasons:
                    pair_matches = [e for e in baseline if e["source"] == source and e.get("source_event_id") == supplied_id]
                    if len(pair_matches) == 1:
                        old = pair_matches[0]
                if len(entries) > 1:
                    reasons.append("ambiguous_identity_alias")
                elif entries and old is None:
                    reasons.append("identity_missing_from_baseline")
                elif old and not edition and kind == "dated_event" and old["starts_at"][:4] != record["starts_at"][:4]:
                    reasons.append("edition_ambiguous")
                elif old and not supplied_id and SequenceMatcher(None, text_key(old.get("venue_name")), text_key(record["venue_name"])).ratio() < 0.8:
                    reasons.append("ambiguous_venue_identity")
                elif old and not supplied_id and kind == "dated_event" and SequenceMatcher(None, text_key(old["title"]), text_key(record["title"])).ratio() < 0.65:
                    reasons.append("reused_detail_url_ambiguous")
                else:
                    other_editions = {e["event_id"] for e in registry["entries"]
                                      if edition and e["edition"] and e["edition"] != edition}
                    matches = [e for e in universe.values() if canonical_url(e["source_url"]) == url
                               and e["id"] not in other_editions]
                    if old:
                        matches = [e for e in matches if e["id"] != old["id"]]
                    if matches:
                        # General home pages and URL reuse are never automatic identity matches.
                        for match in matches:
                            pair = (match["source"], match.get("source_event_id"))
                            native_owned = match["source"] in native_sources or match["id"] in native_ids or pair in native_pairs
                            reasons.append("native_precedence" if native_owned else "possible_duplicate")
                        result["matching_event_ids"] = sorted(e["id"] for e in matches)
                    elif not old:
                        fuzzy = [e for e in universe.values() if e["id"] not in other_editions and looks_duplicate(record, e)]
                        if fuzzy:
                            reasons.append("possible_duplicate")
                            result["matching_event_ids"] = sorted(e["id"] for e in fuzzy)
                if not reasons:
                    if old:
                        if entries:
                            entry = entries[0]
                        else:
                            key = hashlib.sha256((source + "|" + supplied_id).encode()).hexdigest()[:24]
                            entry = {"identity_key": key, "event_id": old["id"], "source": old["source"],
                                     "source_event_id": old["source_event_id"], "canonical_url": canonical_url(old["source_url"]),
                                     "url_aliases": [], "venue_key": text_key(record["venue_name"]), "record_kind": kind, "edition": edition}
                            registry["entries"].append(entry)
                        if url not in [entry["canonical_url"], *entry["url_aliases"]]:
                            entry["url_aliases"] = sorted([*entry["url_aliases"], url])
                        record.update(id=old["id"], source=old["source"], source_event_id=old.get("source_event_id"))
                    else:
                        seed = "|".join((source, supplied_id or url, text_key(record["venue_name"]), kind, edition or ""))
                        key = hashlib.sha256(seed.encode()).hexdigest()[:24]
                        record.update(id="discovery-" + key, source=source, source_event_id=supplied_id or key)
                        registry["entries"].append({"identity_key": key, "event_id": record["id"], "source": source,
                            "source_event_id": record["source_event_id"], "canonical_url": url, "url_aliases": [],
                            "venue_key": text_key(record["venue_name"]), "record_kind": kind, "edition": edition})
                    if record["id"] in {e["id"] for e in records}:
                        reasons.append("duplicate_proposal_identity")
                    else:
                        records.append(record)
                        universe[record["id"]] = record
                        result.update(status="ready_for_pr", event_id=record["id"])
            result["reasons"] = sorted(set(reasons))
            if reasons and any(reason.startswith(("invalid_field_type:", "unsupported_category", "unsupported_price_type", "unsupported_reservation_status")) for reason in reasons):
                result["status"] = "rejected"
            observation.update(result)
            outcomes.append(result)
            observations.append(observation)
    registry["entries"].sort(key=lambda e: e["identity_key"])
    validate_registry(registry, [*baseline, *records])
    return records, outcomes, registry, observations

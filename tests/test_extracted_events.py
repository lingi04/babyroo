import copy
import hashlib
import importlib.util
import json
import tempfile
import subprocess
import unittest
from datetime import date
from pathlib import Path
from unittest.mock import patch

from babyroo_crawler.discovery_workflow import refresh, SOURCES
from crawler.discovery.google_alerts import sample
from crawler.discovery.extraction_schema import BundleError, Limits, validate_bundle, PERMANENT_START, PERMANENT_END
from crawler.discovery.extracted_events import adapt_extractions
from crawler.discovery.extraction_queue import build_queue, candidate_id
from test_discovery_workflow import event

TODAY = date(2026, 11, 23)


def fixture(root, kind="permanent_venue", fields=None, edition=None, source_id=None, url="https://spring-museum.example/admission"):
    values = {"title": "봄꽃박물관 관람", "venue_name": "봄꽃박물관", "region": "서울", "category": "exhibition",
              "age_min_months": 0, "parking": False}
    if kind == "dated_event":
        values.update(starts_at="2026-12-01", ends_at="2026-12-31")
    values.update(fields or {})
    quotes = {"title": "제목: " + values["title"], "venue_name": "장소: " + values["venue_name"],
              "region": "지역: 서울", "category": "분류: 박물관 전시", "age_min_months": "대상: 0개월 이상", "parking": "주차 불가"}
    for key in ("starts_at", "ends_at"):
        if values.get(key) is not None:
            quotes[key] = key + ": " + values[key]
    if edition:
        quotes["edition"] = "회차: " + edition
    if source_id:
        quotes["source_event_id"] = "공식 행사 ID: " + source_id
    classification = "운영 방식: 상설 운영" if kind == "permanent_venue" else "운영 방식: 기간 한정 행사"
    authority = "운영 주체: 봄꽃재단 (공식 운영기관)"
    text = "\n".join([authority, classification, *quotes.values()]) + "\n"
    (root / "documents").mkdir(exist_ok=True)
    (root / "documents/doc-1.txt").write_text(text, encoding="utf-8")
    reference = lambda quote: {"document_id": "doc-1", "quote": quote}
    proposal = {"proposal_id": "proposal-1", "candidate_id": "candidate-1", "record_kind": kind,
                "source_url": url, "source_document_ids": ["doc-1"], "fields": values,
                "evidence_by_field": {k: reference(v) for k, v in quotes.items()},
                "classification_evidence": reference(classification),
                "authority": {"publisher_name": "봄꽃재단", "role": "venue_operator", "evidence": reference(authority)}}
    if edition:
        proposal["edition"] = edition
    if source_id:
        proposal["source_event_id"] = source_id
    data = {"schema_version": 2, "batch_id": "batch-1", "generated_at": "2026-11-23", "keywords": {},
            "queued_candidate_ids": ["candidate-1"],
            "candidates": [{"candidate_id": "candidate-1", "discovery_url": url, "outcome": "extracted", "proposal_ids": ["proposal-1"]}],
            "source_documents": [{"document_id": "doc-1", "candidate_ids": ["candidate-1"], "url": url,
                                  "fetched_at": "2026-11-23", "kind": "official_detail", "text_file": "documents/doc-1.txt",
                                  "text_sha256": hashlib.sha256(text.encode()).hexdigest()}], "proposals": [proposal]}
    queue = {"schema_version": 1, "selected": [{"candidate_id": "candidate-1", "discovery_url": url}], "deferred": []}
    queue_path = root / "queue.json"; queue_path.write_text(json.dumps(queue))
    data["queue_sha256"] = hashlib.sha256(queue_path.read_bytes()).hexdigest()
    return data


class ExtractionTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name)

    def bundle(self, data):
        return validate_bundle(data, self.root, today=TODAY)

    def adapt(self, data, baseline=None, native=None, registry=None):
        return adapt_extractions(self.bundle(data), baseline or [event()], native or [],
                                 registry or {"schema_version": 1, "entries": []}, set(SOURCES))

    def test_permanent_dates_full_30_field_record_false_zero_and_unknowns(self):
        data = fixture(self.root)
        incoming, outcomes, registry, observations = self.adapt(data)
        self.assertEqual(outcomes[0]["status"], "ready_for_pr")
        self.assertEqual((incoming[0]["starts_at"], incoming[0]["ends_at"]), (PERMANENT_START, PERMANENT_END))
        self.assertEqual((incoming[0]["age_min_months"], incoming[0]["parking"]), (0, False))
        self.assertIsNone(incoming[0]["nursing_room"])
        self.assertEqual(observations[0]["warnings"], ["new_publisher_domain_requires_human_confirmation"])
        catalog = self.root / "server/data/events.json"
        catalog.parent.mkdir(parents=True)
        catalog.write_text(json.dumps({"count": 1, "events": [event()]}))
        path = self.root / "bundle.json"; path.write_text(json.dumps(data))
        with patch("crawler.discovery.google_alerts.date") as clock:
            clock.today.return_value = TODAY
            clock.fromisoformat.side_effect = date.fromisoformat
            result = refresh(self.root, path, native_collector=lambda p: ([event()], {"test"}))
            after = json.loads(catalog.read_text())
            self.assertEqual(len(after["events"][1]), 30)
            self.assertFalse({"image_url", "publication_status", "admin_updated_at"} & after["events"][1].keys())
            self.assertFalse(refresh(self.root, path, native_collector=lambda p: ([event()], {"test"}))["changed"])
        self.assertEqual(result["added"], 1)

    def test_expired_extraction_is_excluded_and_repeat_is_stable(self):
        data = fixture(self.root, "dated_event", fields={"starts_at": "2026-11-01", "ends_at": "2026-11-22"})
        catalog = self.root / "server/data/events.json"
        catalog.parent.mkdir(parents=True)
        catalog.write_text(json.dumps({"count": 1, "events": [event()]}))
        path = self.root / "bundle.json"
        path.write_text(json.dumps(data))
        with patch("crawler.discovery.google_alerts.date") as clock:
            clock.today.return_value = TODAY
            clock.fromisoformat.side_effect = date.fromisoformat
            result = refresh(self.root, path, today=TODAY.isoformat(), native_collector=lambda p: ([event()], {"test"}))
            self.assertEqual(result["added"], 0)
            self.assertEqual(json.loads(catalog.read_text())["count"], 1)
            review = json.loads((self.root / "data/discovery/review.json").read_text())
            self.assertEqual(review["extractions"][0]["status"], "excluded")
            self.assertIn("event_ended", review["extractions"][0]["reasons"])
            self.assertEqual(len(review["expired"]), 1)
            self.assertFalse(refresh(self.root, path, today=TODAY.isoformat(),
                                     native_collector=lambda p: ([event()], {"test"}))["changed"])

    def test_dated_event_and_date_correction_preserve_identity(self):
        data = fixture(self.root, "dated_event")
        first, _, registry, _ = self.adapt(data)
        first[0].update(csv_sequence=2, created_at=None, updated_at=None)
        data = fixture(self.root, "dated_event", fields={"starts_at": "2026-12-02"})
        second, outcomes, after_registry, _ = self.adapt(data, [event(), first[0]], registry=registry)
        self.assertEqual(outcomes[0]["status"], "ready_for_pr")
        self.assertEqual(first[0]["id"], second[0]["id"])
        self.assertEqual(after_registry, registry)

    def test_missing_dates_uncertain_permanence_and_secondary_source_stay_review(self):
        for mode in ("missing_end", "uncertain", "not_permanent", "secondary", "missing_authority"):
            data = fixture(self.root, "dated_event" if mode == "missing_end" else "permanent_venue")
            if mode == "missing_end":
                data["proposals"][0]["fields"].pop("ends_at")
                data["proposals"][0]["evidence_by_field"].pop("ends_at")
            elif mode == "uncertain": data["proposals"][0]["record_kind"] = "uncertain"
            elif mode == "not_permanent": data["proposals"][0]["classification_evidence"]["quote"] = "지역: 서울"
            elif mode == "secondary": data["source_documents"][0]["kind"] = "secondary"
            else: data["proposals"][0]["authority"]["publisher_name"] = "Unverified operator"
            with self.subTest(mode=mode):
                incoming, outcomes, _, _ = self.adapt(data)
                self.assertEqual(incoming, [])
                self.assertEqual(outcomes[0]["status"], "needs_review")

    def test_forged_quote_ambiguous_quote_and_wrong_age_do_not_qualify(self):
        for mode in ("forged", "ambiguous", "age"):
            data = fixture(self.root)
            if mode == "forged": data["proposals"][0]["evidence_by_field"]["title"]["quote"] = "NOT IN DOCUMENT"
            elif mode == "ambiguous":
                p = self.root / "documents/doc-1.txt"
                p.write_text(p.read_text() + "제목: 봄꽃박물관 관람\n")
                data["source_documents"][0]["text_sha256"] = hashlib.sha256(p.read_bytes()).hexdigest()
            else: data["proposals"][0]["fields"]["age_min_months"] = 600
            with self.subTest(mode=mode):
                self.assertEqual(self.adapt(data)[0], [])

    def test_malformed_global_references_versions_and_ownership_fields_abort(self):
        for mode in ("unaccounted", "extra_id", "foreign_document", "duplicate_proposal", "wrong_hash", "traversal"):
            data = fixture(self.root)
            if mode == "unaccounted": data["queued_candidate_ids"].append("missing")
            elif mode == "extra_id": data["proposals"][0]["fields"]["id"] = "attack"
            elif mode == "foreign_document": data["proposals"][0]["evidence_by_field"]["title"]["document_id"] = "missing"
            elif mode == "duplicate_proposal": data["proposals"].append(copy.deepcopy(data["proposals"][0]))
            elif mode == "wrong_hash": data["source_documents"][0]["text_sha256"] = "0" * 64
            else: data["source_documents"][0]["text_file"] = "../secret"
            with self.subTest(mode=mode), self.assertRaises(BundleError):
                self.bundle(data)
        for version in (3, "2", True):
            path = self.root / "bundle.json"
            path.write_text(json.dumps({"schema_version": version, "generated_at": "2026-11-23", "keywords": {"kids": []}}))
            with self.assertRaises(ValueError): sample(path, today=TODAY)

    def test_doc_symlink_escape_and_budgets_abort(self):
        data = fixture(self.root)
        outside = self.root.parent / (self.root.name + "-outside.txt")
        outside.write_bytes((self.root / "documents/doc-1.txt").read_bytes())
        self.addCleanup(lambda: outside.unlink(missing_ok=True))
        target = self.root / "documents/doc-1.txt"; target.unlink(); target.symlink_to(outside)
        with self.assertRaisesRegex(BundleError, "escapes"):
            self.bundle(data)
        target.unlink()
        data = fixture(self.root)
        for limits in (Limits(proposals=0), Limits(document_bytes=10), Limits(documents_per_candidate=0)):
            with self.assertRaises(BundleError): validate_bundle(data, self.root, today=TODAY, limits=limits)

    def test_fetch_failure_is_a_review_outcome_and_unknown_optional_types_reject(self):
        data = fixture(self.root)
        data.update(source_documents=[], proposals=[])
        data["candidates"][0].update(outcome="fetch_failed", proposal_ids=[], reason="source_fetch_failed")
        incoming, outcomes, _, _ = self.adapt(data)
        self.assertEqual(incoming, [])
        self.assertEqual(outcomes[0]["reasons"], ["source_fetch_failed"])
        data = fixture(self.root, fields={"parking": "false"})
        self.assertEqual(self.adapt(data)[0], [])

    def test_native_precedence_and_fuzzy_duplicates_are_never_inserted_twice(self):
        data = fixture(self.root)
        duplicate = event("native", source="namu", sequence=2, source_url=data["proposals"][0]["source_url"],
                          venue_name="봄꽃박물관", title="봄꽃박물관 관람")
        incoming, outcomes, _, _ = self.adapt(data, [event(), duplicate], [duplicate])
        self.assertEqual(incoming, [])
        self.assertIn("native_precedence", outcomes[0]["reasons"])
        duplicate["source_url"] = "https://other.example/venue"
        incoming, outcomes, _, _ = self.adapt(data, [event(), duplicate])
        self.assertEqual(incoming, [])
        self.assertIn("possible_duplicate", outcomes[0]["reasons"])

    def test_failed_recheck_preserves_existing_record_and_human_notes(self):
        data = fixture(self.root)
        path = self.root / "bundle.json"; path.write_text(json.dumps(data))
        catalog = self.root / "server/data/events.json"; catalog.parent.mkdir(parents=True)
        catalog.write_text(json.dumps({"count": 1, "events": [event()]}))
        with patch("crawler.discovery.google_alerts.date") as clock:
            clock.today.return_value = TODAY; clock.fromisoformat.side_effect = date.fromisoformat
            refresh(self.root, path, native_collector=lambda p: ([event()], {"test"}))
            before = catalog.read_bytes()
            review_path = self.root / "data/discovery/review.json"
            review = json.loads(review_path.read_text()); review["operator_notes"] = "KEEP"
            review["extractions"][0]["operator_notes"] = "KEEP ITEM"
            review_path.write_text(json.dumps(review))
            data.update(source_documents=[], proposals=[])
            data["candidates"][0].update(outcome="fetch_failed", proposal_ids=[], reason="source_fetch_failed")
            path.write_text(json.dumps(data))
            refresh(self.root, path, native_collector=lambda p: ([event()], {"test"}))
            self.assertEqual(catalog.read_bytes(), before)
            self.assertEqual(json.loads(review_path.read_text())["operator_notes"], "KEEP")

    def test_explicit_single_day_is_supported(self):
        data = fixture(self.root, "dated_event", fields={"ends_at": None})
        p = self.root / "documents/doc-1.txt"; p.write_text(p.read_text() + "당일 행사\n")
        data["source_documents"][0]["text_sha256"] = hashlib.sha256(p.read_bytes()).hexdigest()
        data["proposals"][0]["classification_evidence"]["quote"] = "당일 행사"
        incoming, _, _, _ = self.adapt(data)
        self.assertEqual(incoming[0]["starts_at"], incoming[0]["ends_at"])

    def test_explicit_new_edition_is_distinct_but_unstated_year_change_requires_review(self):
        data = fixture(self.root, "dated_event", edition="2026년 제1회")
        first, _, registry, _ = self.adapt(data)
        first[0].update(csv_sequence=2)
        data = fixture(self.root, "dated_event", edition="2027년 제2회",
                       fields={"starts_at": "2027-12-01", "ends_at": "2027-12-31"})
        second, outcomes, _, _ = self.adapt(data, [event(), first[0]], registry=registry)
        self.assertEqual(outcomes[0]["status"], "ready_for_pr")
        self.assertNotEqual(first[0]["id"], second[0]["id"])
        data = fixture(self.root, "dated_event")
        first, _, registry, _ = self.adapt(data)
        data = fixture(self.root, "dated_event", fields={"starts_at": "2027-12-01", "ends_at": "2027-12-31"})
        rows, outcomes, _, _ = self.adapt(data, [event(), first[0]], registry=registry)
        self.assertEqual(rows, [])
        self.assertIn("edition_ambiguous", outcomes[0]["reasons"])

    def test_reused_venue_homepage_does_not_overwrite_a_different_venue(self):
        data = fixture(self.root)
        first, _, registry, _ = self.adapt(data)
        data = fixture(self.root, fields={"venue_name": "완전히 다른 장소", "title": "다른 장소 관람"})
        rows, outcomes, _, _ = self.adapt(data, [event(), first[0]], registry=registry)
        self.assertEqual(rows, [])
        self.assertIn("ambiguous_venue_identity", outcomes[0]["reasons"])

    def test_empty_v2_batch_is_noop_and_evidence_refresh_does_not_write(self):
        catalog = self.root / "server/data/events.json"; catalog.parent.mkdir(parents=True)
        catalog.write_text(json.dumps({"count": 1, "events": [event()]}))
        data = fixture(self.root)
        path = self.root / "bundle.json"
        empty = {**data, "queued_candidate_ids": [], "candidates": [], "source_documents": [], "proposals": []}
        original_queue = (self.root / "queue.json").read_bytes()
        (self.root / "queue.json").write_text(json.dumps({"selected": [], "deferred": []}))
        empty["queue_sha256"] = hashlib.sha256((self.root / "queue.json").read_bytes()).hexdigest()
        path.write_text(json.dumps(empty))
        with patch("crawler.discovery.google_alerts.date") as clock:
            clock.today.return_value = TODAY; clock.fromisoformat.side_effect = date.fromisoformat
            self.assertFalse(refresh(self.root, path, native_collector=lambda p: ([event()], {"test"}))["changed"])
            (self.root / "queue.json").write_bytes(original_queue)
            path.write_text(json.dumps(data))
            refresh(self.root, path, native_collector=lambda p: ([event()], {"test"}))
            before = {str(p): p.read_bytes() for p in self.root.glob("data/discovery/**/*") if p.is_file()}
            data["batch_id"] = "batch-2"
            data["proposals"][0]["evidence_by_field"]["title"]["confidence"] = 0.8
            path.write_text(json.dumps(data))
            self.assertFalse(refresh(self.root, path, native_collector=lambda p: ([event()], {"test"}))["changed"])
            after = {str(p): p.read_bytes() for p in self.root.glob("data/discovery/**/*") if p.is_file()}
            self.assertEqual(before, after)

    def test_invalid_v2_hash_prevents_native_collection_or_catalog_write(self):
        catalog = self.root / "server/data/events.json"; catalog.parent.mkdir(parents=True)
        catalog.write_text(json.dumps({"count": 1, "events": [event()]}))
        data = fixture(self.root); data["source_documents"][0]["text_sha256"] = "invalid"
        path = self.root / "bundle.json"; path.write_text(json.dumps(data))
        before = catalog.read_bytes()
        with self.assertRaises(ValueError):
            refresh(self.root, path, native_collector=lambda p: self.fail("native collection must not start"))
        self.assertEqual(catalog.read_bytes(), before)

    def test_atomic_rollback_also_removes_identity_and_evidence_outputs(self):
        import babyroo_crawler.discovery_workflow as workflow
        catalog = self.root / "server/data/events.json"; catalog.parent.mkdir(parents=True)
        catalog.write_text(json.dumps({"count": 1, "events": [event()]}))
        data = fixture(self.root); path = self.root / "bundle.json"; path.write_text(json.dumps(data))
        before = catalog.read_bytes(); replace = workflow.os.replace
        def fail_catalog(src, dst):
            if dst == catalog: raise OSError("catalog replacement failed")
            return replace(src, dst)
        with patch("crawler.discovery.google_alerts.date") as clock, patch.object(workflow.os, "replace", side_effect=fail_catalog):
            clock.today.return_value = TODAY; clock.fromisoformat.side_effect = date.fromisoformat
            with self.assertRaises(OSError): refresh(self.root, path, native_collector=lambda p: ([event()], {"test"}))
        self.assertEqual(catalog.read_bytes(), before)
        self.assertEqual([p for p in self.root.glob("data/discovery/**/*") if p.is_file()], [])

    def test_negated_permanence_and_amenities_never_qualify_positive_claims(self):
        for field, quote in (("record_kind", "운영 방식: 상설 운영 아님"), ("parking", "주차장 없음")):
            data = fixture(self.root, fields={"parking": True} if field == "parking" else {})
            text = self.root / "documents/doc-1.txt"; text.write_text(text.read_text() + quote + "\n")
            data["source_documents"][0]["text_sha256"] = hashlib.sha256(text.read_bytes()).hexdigest()
            target = data["proposals"][0]["classification_evidence"] if field == "record_kind" else data["proposals"][0]["evidence_by_field"][field]
            target["quote"] = quote
            with self.subTest(field=field):
                self.assertEqual(self.adapt(data)[0], [])
        data["proposals"][0]["fields"]["parking"] = False
        self.assertEqual(self.adapt(data)[1][0]["status"], "ready_for_pr")

    def test_unsupported_tags_cannot_use_irrelevant_official_quote(self):
        data = fixture(self.root, fields={"tags": ["무료"]})
        data["proposals"][0]["evidence_by_field"]["tags"] = {"document_id": "doc-1", "quote": "지역: 서울"}
        incoming, outcomes, _, _ = self.adapt(data)
        self.assertEqual(incoming, [])
        self.assertIn("unsupported_tag_derivation", outcomes[0]["reasons"])

    def test_reused_official_source_id_cannot_overwrite_new_edition(self):
        data = fixture(self.root, "dated_event", edition="2026년 제1회", source_id="event-shared")
        first, _, registry, _ = self.adapt(data)
        data = fixture(self.root, "dated_event", edition="2027년 제2회", source_id="event-shared",
                       fields={"starts_at": "2027-12-01", "ends_at": "2027-12-31"})
        rows, outcomes, after_registry, _ = self.adapt(data, [event(), first[0]], registry=registry)
        self.assertEqual(rows, [])
        self.assertIn("official_id_reused_for_edition", outcomes[0]["reasons"])
        self.assertEqual(after_registry, registry)

    def test_multiple_proposal_notes_survive_candidate_failure(self):
        catalog = self.root / "server/data/events.json"; catalog.parent.mkdir(parents=True)
        catalog.write_text(json.dumps({"count": 1, "events": [event()]}))
        state = self.root / "data/discovery/review.json"; state.parent.mkdir(parents=True)
        state.write_text(json.dumps({"missing": [], "candidates": [], "extractions": [
            {"candidate_id": "candidate-1", "proposal_id": "p1", "status": "needs_review", "operator_notes": "NOTE ONE"},
            {"candidate_id": "candidate-1", "proposal_id": "p2", "status": "needs_review", "operator_notes": "NOTE TWO", "decision": "dismissed"}]}))
        data = fixture(self.root); data.update(source_documents=[], proposals=[])
        data["candidates"][0].update(outcome="fetch_failed", proposal_ids=[], reason="source_fetch_failed")
        path = self.root / "bundle.json"; path.write_text(json.dumps(data))
        with patch("crawler.discovery.google_alerts.date") as clock:
            clock.today.return_value = TODAY; clock.fromisoformat.side_effect = date.fromisoformat
            refresh(self.root, path, native_collector=lambda p: ([event()], {"test"}))
            rows = json.loads(state.read_text())["extractions"]
            self.assertEqual({row.get("operator_notes") for row in rows if row.get("proposal_id")}, {"NOTE ONE", "NOTE TWO"})
            self.assertFalse(refresh(self.root, path, native_collector=lambda p: ([event()], {"test"}))["changed"])

    def test_selected_queue_cannot_be_omitted_from_both_batch_lists(self):
        data = fixture(self.root)
        data.update(queued_candidate_ids=[], candidates=[], source_documents=[], proposals=[])
        with self.assertRaisesRegex(BundleError, "selected queue"):
            self.bundle(data)
        (self.root / "queue.json").unlink()
        with self.assertRaises(BundleError):
            self.bundle(data)

    def test_candidate_dismissal_blocks_insertion_but_not_other_proposals(self):
        data = fixture(self.root)
        bundle = self.bundle(data)
        records, outcomes, _, _ = adapt_extractions(bundle, [event()], [], {"schema_version": 1, "entries": []},
            set(SOURCES), [{"candidate_id": "candidate-1", "proposal_id": None, "decision": "dismissed"}])
        self.assertEqual(records, [])
        self.assertEqual(outcomes[0]["reasons"], ["operator_dismissed"])

    def test_unsupported_boolean_and_conditional_free_price_stay_review_only(self):
        data = fixture(self.root, fields={"parking": True})
        self.assertEqual(self.adapt(data)[0], [])
        data = fixture(self.root, fields={"price_text": "24개월 미만 무료, 성인 5,000원", "price_type": "free"})
        quote = "가격: 24개월 미만 무료, 성인 5,000원"
        text = self.root / "documents/doc-1.txt"; text.write_text(text.read_text() + quote + "\n")
        data["source_documents"][0]["text_sha256"] = hashlib.sha256(text.read_bytes()).hexdigest()
        for field in ("price_text", "price_type"):
            data["proposals"][0]["evidence_by_field"][field] = {"document_id": "doc-1", "quote": quote}
        self.assertEqual(self.adapt(data)[0], [])

    def test_capture_normalizes_text_and_finalizer_uses_validated_payload(self):
        import sys
        scripts = Path(__file__).resolve().parents[1] / "scripts"
        sys.path.insert(0, str(scripts)); self.addCleanup(lambda: sys.path.remove(str(scripts)))
        import discovery_bundle as helper
        data = fixture(self.root)
        actual = date.today().isoformat()
        data["generated_at"] = actual; data["source_documents"][0]["fetched_at"] = actual
        raw = self.root / "raw"; raw.mkdir()
        (raw / "doc-1.txt").write_bytes((self.root / "documents/doc-1.txt").read_bytes().replace(b"\n", b"\r\n"))
        metadata = helper.capture(self.root, "doc-1", ["candidate-1"], data["proposals"][0]["source_url"], actual)
        data["source_documents"][0] = metadata
        draft = self.root / "batch.draft.json"; draft.write_text(json.dumps(data))
        self.assertEqual(helper.main(["finalize", "--batch-root", str(self.root)]), 0)
        self.assertEqual(json.loads((self.root / "bundle.json").read_text()), data)
        data["source_documents"][0]["text_sha256"] = "wrong"
        draft.write_text(json.dumps(data))
        before = (self.root / "bundle.json").read_bytes()
        with self.assertRaises(ValueError): helper.main(["finalize", "--batch-root", str(self.root)])
        self.assertEqual((self.root / "bundle.json").read_bytes(), before)

    def test_negated_single_day_and_incorrect_category_do_not_qualify(self):
        data = fixture(self.root, "dated_event", fields={"ends_at": None})
        text = self.root / "documents/doc-1.txt"; text.write_text(text.read_text() + "하루 행사가 아닙니다\n")
        data["source_documents"][0]["text_sha256"] = hashlib.sha256(text.read_bytes()).hexdigest()
        data["proposals"][0]["classification_evidence"]["quote"] = "하루 행사가 아닙니다"
        self.assertEqual(self.adapt(data)[0], [])
        data = fixture(self.root, fields={"category": "festival"})
        self.assertEqual(self.adapt(data)[0], [])

    def test_identity_evidence_cannot_come_from_an_unrelated_publisher(self):
        data = fixture(self.root, source_id="foreign-event-7")
        text = "Official ID: foreign-event-7\n"
        (self.root / "documents/doc-2.txt").write_text(text)
        data["source_documents"].append({"document_id": "doc-2", "candidate_ids": ["candidate-1"],
            "url": "https://unrelated-publisher.example/detail", "kind": "official_detail", "fetched_at": "2026-11-23",
            "text_file": "documents/doc-2.txt", "text_sha256": hashlib.sha256(text.encode()).hexdigest()})
        data["proposals"][0]["source_document_ids"].append("doc-2")
        data["proposals"][0]["evidence_by_field"]["source_event_id"] = {"document_id": "doc-2", "quote": text.strip()}
        incoming, outcomes, _, _ = self.adapt(data)
        self.assertEqual(incoming, [])
        self.assertIn("unsupported_cross_publisher_evidence", outcomes[0]["reasons"])

    def test_full_catalog_snapshot_additions_and_repeat_noop(self):
        source = Path(__file__).resolve().parents[1] / "server/data/events.json"
        baseline = json.loads(source.read_text())
        target = self.root / "server/data/events.json"; target.parent.mkdir(parents=True); target.write_bytes(source.read_bytes())
        data = fixture(self.root)
        dated_root = self.root / "dated"; dated_root.mkdir()
        dated = fixture(dated_root, "dated_event", fields={"title": "우주를 만나는 특별전"},
                        url="https://spring-museum.example/exhibition")
        (self.root / "documents/doc-2.txt").write_bytes((dated_root / "documents/doc-1.txt").read_bytes())
        document = dated["source_documents"][0]
        document.update(document_id="doc-2", candidate_ids=["candidate-2"], text_file="documents/doc-2.txt")
        proposal = dated["proposals"][0]
        proposal.update(proposal_id="proposal-2", candidate_id="candidate-2", source_document_ids=["doc-2"])
        for ref in [*proposal["evidence_by_field"].values(), proposal["classification_evidence"], proposal["authority"]["evidence"]]:
            ref["document_id"] = "doc-2"
        data["queued_candidate_ids"] += ["candidate-2", "candidate-3"]
        data["candidates"] += [{"candidate_id": "candidate-2", "discovery_url": proposal["source_url"], "outcome": "extracted", "proposal_ids": ["proposal-2"]},
                               {"candidate_id": "candidate-3", "discovery_url": "https://blocked.example/page", "outcome": "fetch_failed", "proposal_ids": [], "reason": "source_fetch_failed"}]
        data["source_documents"].append(document); data["proposals"].append(proposal)
        queue = {"selected": [{"candidate_id": c["candidate_id"], "discovery_url": c["discovery_url"]} for c in data["candidates"]], "deferred": []}
        (self.root / "queue.json").write_text(json.dumps(queue)); data["queue_sha256"] = hashlib.sha256((self.root / "queue.json").read_bytes()).hexdigest()
        path = self.root / "bundle.json"; path.write_text(json.dumps(data))
        native = copy.deepcopy(baseline["events"])
        collect = lambda p: (native, set(e["source"] for e in native))
        with patch("crawler.discovery.google_alerts.date") as clock:
            clock.today.return_value = TODAY; clock.fromisoformat.side_effect = date.fromisoformat
            result = refresh(self.root, path, native_collector=collect, today=TODAY.isoformat())
            self.assertEqual((result["added"], result["updated"]), (2, 0))
            actual = json.loads(target.read_text())["events"]
            eligible = [e for e in native if e["ends_at"] >= TODAY.isoformat()]
            self.assertEqual(actual[:len(eligible)], eligible)
            self.assertEqual(len(actual), len(eligible) + 2)
            self.assertTrue(all(len(e) == 30 for e in actual))
            self.assertEqual(len({e["id"] for e in actual}), len(actual))
            self.assertTrue(any(e["starts_at"] == PERMANENT_START and e["ends_at"] == PERMANENT_END for e in actual[len(eligible):]))
            before = target.read_bytes()
            self.assertFalse(refresh(self.root, path, native_collector=collect, today=TODAY.isoformat())["changed"])
            self.assertEqual(target.read_bytes(), before)


class QueueTest(unittest.TestCase):
    def test_known_urls_and_absent_pending_items_are_revisited_and_rotate(self):
        catalog = {"events": [event(str(i), source="external:venue.example", sequence=i + 1,
                                   source_url=f"https://venue.example/event/{i}") for i in range(25)]}
        review = {"extractions": [{"candidate_id": "pending", "discovery_url": "https://pending.example/page", "status": "needs_review"}]}
        fresh = [{"discovery_url": f"https://new.example/{i}"} for i in range(20)]
        first, cursor = build_queue(catalog, review, {}, fresh)
        second, _ = build_queue(catalog, review, {}, fresh, cursor)
        self.assertEqual(len(first["selected"]), 20)
        self.assertEqual(sum(r["reason"] == "new_search_lead" for r in first["selected"]), 10)
        first_ids = {r["candidate_id"] for r in first["selected"]}
        self.assertNotEqual(first_ids, {r["candidate_id"] for r in second["selected"]})
        all_rows = first["selected"] + first["deferred"]
        self.assertIn("pending", {r["candidate_id"] for r in all_rows})

    def test_budget_fills_unused_slots_and_ignores_native_catalog(self):
        catalog = {"events": [event(source="namu")]}
        fresh = [{"discovery_url": f"https://new.example/{i}"} for i in range(30)]
        queue, _ = build_queue(catalog, {}, {}, fresh, budget=20, native_sources=SOURCES)
        self.assertEqual(len(queue["selected"]), 20)
        self.assertEqual(len(queue["deferred"]), 10)
        self.assertEqual(candidate_id("https://example.com/page?utm_source=x"), candidate_id("https://example.com/page"))

    def test_deferred_new_leads_survive_without_rediscovery(self):
        fresh = [{"discovery_url": f"https://new.example/{i}"} for i in range(30)]
        first, cursor = build_queue({"events": []}, {}, {}, fresh)
        second, after = build_queue({"events": []}, {}, {}, [], cursor)
        self.assertEqual(len(after["backlog"]), 30)
        self.assertTrue({r["candidate_id"] for r in first["deferred"]} <= {r["candidate_id"] for r in second["selected"]})

    def test_dismissal_is_not_revived_by_fresh_search_or_backlog(self):
        url = "https://new.example/one"
        review = {"candidates": [{"discovery_url": url, "decision": "dismissed"}]}
        queue, state = build_queue({"events": []}, review, {}, [{"discovery_url": url}],
                                  {"recheck_cursor": 0, "fresh_cursor": 0, "backlog": [{"discovery_url": url}]})
        self.assertEqual(queue["selected"], [])
        self.assertEqual(state["backlog"], [])

    def test_queue_cli_requires_clean_fetched_main_and_writes_external_checkpoint(self):
        import sys
        scripts = Path(__file__).resolve().parents[1] / "scripts"
        sys.path.insert(0, str(scripts)); self.addCleanup(lambda: sys.path.remove(str(scripts)))
        import discovery_queue as helper
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp); repo = root / "repo"; repo.mkdir()
            def git(*args):
                return subprocess.check_output(["git", *args], cwd=repo, text=True, stderr=subprocess.DEVNULL).strip()
            git("init", "-b", "main"); git("config", "user.name", "Test"); git("config", "user.email", "test@example.com")
            catalog = repo / "server/data/events.json"; catalog.parent.mkdir(parents=True)
            catalog.write_text(json.dumps({"count": 1, "events": [event(source="namu")]}))
            git("add", "."); git("commit", "-m", "fixture"); git("update-ref", "refs/remotes/origin/main", "HEAD")
            feeder = root / "search.json"
            feeder.write_text(json.dumps({"generated_at": date.today().isoformat(), "keywords": {"kids": [{"title": "A new venue", "url": "https://new.example/detail"}]}}))
            state = root / "state.json"; output = root / "queue.json"
            args = ["--catalog-root", str(repo), "--discovery-input", str(feeder), "--state", str(state), "--output", str(output)]
            self.assertEqual(helper.main(args), 0)
            self.assertEqual(len(json.loads(output.read_text())["selected"]), 1)
            self.assertEqual(len(json.loads(state.read_text())["backlog"]), 1)
            before = output.read_bytes()
            catalog.write_text(catalog.read_text() + "\n")
            with self.assertRaisesRegex(ValueError, "clean"):
                helper.main(args)
            self.assertEqual(output.read_bytes(), before)

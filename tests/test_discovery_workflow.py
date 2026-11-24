import copy
import json
import tempfile
import unittest
from datetime import date
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch

from babyroo_crawler import discovery_workflow as workflow
from crawler.discovery.google_alerts import sample
from discovery_official import is_official


def event(eid="one", source="test", sequence=1, **values):
    return {"id": eid, "title": "Original", "source": source, "source_event_id": eid,
            "source_url": "https://example.com/" + eid, "starts_at": "2026-01-01",
            "ends_at": "2026-12-31", "csv_sequence": sequence, "created_at": "original-created",
            "updated_at": "original-updated", "last_checked_at": "2026-01-01", **values}


class WorkflowTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name)
        self.catalog = self.root / "server/data/events.json"
        self.catalog.parent.mkdir(parents=True)
        self.original = {"count": 1, "events": [event()], "generated_at": "2026-01-01"}
        self.catalog.write_text(json.dumps(self.original))

    def refresh(self, incoming=None, checked=None):
        return workflow.refresh(self.root, native_collector=lambda staging: (
            incoming if incoming is not None else [event()], checked or {"test"}))

    def test_ignored_metadata_only_is_a_file_level_noop(self):
        incoming = event(created_at="new", updated_at="new", last_checked_at="2026-11-23",
                         image_url="new-image", admin_updated_at="new", publication_status="draft")
        before = self.catalog.read_bytes()
        self.assertFalse(self.refresh([incoming])["changed"])
        self.assertEqual(self.catalog.read_bytes(), before)
        self.assertFalse((self.root / "data/discovery").exists())

    def test_source_identity_preserves_id_sequence_and_false_zero(self):
        incoming = event("new-generated-id", sequence=999, source_event_id="one",
                         title="Changed", age_min_months=0, indoor=False, last_checked_at="2026-11-23")
        result = self.refresh([incoming])
        current = json.loads(self.catalog.read_text())["events"][0]
        self.assertEqual(result["updated"], 1)
        self.assertEqual((current["id"], current["csv_sequence"], current["created_at"]), ("one", 1, "original-created"))
        self.assertEqual((current["age_min_months"], current["indoor"]), (0, False))
        self.assertFalse(self.refresh([incoming])["changed"])

    def test_missing_expired_and_manual_records_retained_and_flagged(self):
        original = [event(ends_at="2026-01-01"), event("manual", source="manual", sequence=2)]
        self.catalog.write_text(json.dumps({"count": 2, "events": original}))
        result = self.refresh([event("new", sequence=3)], {"test"})
        self.assertEqual(result["missing"], 1)
        self.assertEqual(len(json.loads(self.catalog.read_text())["events"]), 3)
        report = (self.root / result["report"]).read_text()
        self.assertIn('"id": "one"', report)
        self.assertEqual(report.count("```"), 8)

    def test_more_than_25_new_events_and_edited_report_survive(self):
        incoming = [event()] + [event(str(i), sequence=i + 2) for i in range(30)]
        first = self.refresh(incoming)
        self.assertEqual(first["added"], 30)
        report = self.root / first["report"]
        report.write_text(report.read_text() + "OPERATOR NOTE")
        incoming[0]["title"] = "Second update"
        second = self.refresh(incoming)
        self.assertNotEqual(first["report"], second["report"])
        self.assertIn("OPERATOR NOTE", report.read_text())

    def test_collection_failure_does_not_touch_catalog(self):
        before = self.catalog.read_bytes()
        with self.assertRaisesRegex(ValueError, "outage"):
            workflow.refresh(self.root, native_collector=lambda p: (_ for _ in ()).throw(ValueError("outage")))
        self.assertEqual(self.catalog.read_bytes(), before)

    def test_verified_empty_childcare_continues_other_sources_and_retains_baseline(self):
        from sources import seoul_childcare as childcare
        self.catalog.write_text(json.dumps({"count": 1, "events": [event(source="seoul_childcare")]}))
        staff = '<div class="cal_list"><a onclick="fnCalDetail(1)">교직원 교육</a></div>'
        def module(name):
            if name == "sources.seoul_childcare":
                return SimpleNamespace(collect=lambda output_path: childcare.collect(
                    output_path=output_path, fetch_text=lambda url: staff, request_delay=0))
            return SimpleNamespace(collect=lambda **kwargs: [{
                "source": "namu", "source_event_id": "new", "title": "Museum", "url": "https://example.com/new",
                "captured_at": "2026-11-25", "payload": {"starts_at": "2026-11-25", "ends_at": "2026-12-25"}}])
        with patch.object(workflow, "SOURCES", ("seoul_childcare", "namu")), patch.object(
                workflow.importlib, "import_module", side_effect=module):
            result = workflow.refresh(self.root)
        rows = json.loads(self.catalog.read_text())["events"]
        self.assertEqual(result["added"], 1)
        self.assertEqual(result["missing"], 1)
        self.assertEqual(len(rows), 2)
        self.assertTrue(any(row["id"] == "one" for row in rows))
        self.assertTrue(any(row["title"] == "Museum" for row in rows))

    def test_plain_empty_collector_still_blocks_and_preserves_files(self):
        before = self.catalog.read_bytes()
        for source in ("seoul_childcare", "namu"):
            with self.subTest(source=source), patch.object(workflow, "SOURCES", (source,)), patch.object(
                    workflow.importlib, "import_module", return_value=SimpleNamespace(collect=lambda **kwargs: [])):
                with self.assertRaisesRegex(ValueError, "empty or malformed"):
                    workflow.refresh(self.root)
            self.assertEqual(self.catalog.read_bytes(), before)
            self.assertFalse((self.root / "data/discovery").exists())

    def test_unhealthy_childcare_still_aborts_refresh(self):
        from sources import seoul_childcare as childcare
        before = self.catalog.read_bytes()
        collector = lambda output_path: childcare.collect(output_path=output_path,
            fetch_text=lambda url: "Access denied", request_delay=0)
        with patch.object(workflow, "SOURCES", ("seoul_childcare",)), patch.object(
                workflow.importlib, "import_module", return_value=SimpleNamespace(collect=collector)):
            with self.assertRaisesRegex(ValueError, "unrecognized childcare calendar"):
                workflow.refresh(self.root)
        self.assertEqual(self.catalog.read_bytes(), before)
        self.assertFalse((self.root / "data/discovery").exists())

    def test_output_replace_failure_rolls_back_report_state_and_baseline(self):
        before = self.catalog.read_bytes()
        real_replace = workflow.os.replace
        def fail_catalog(src, dst):
            if dst == self.catalog:
                raise OSError("mock write failure")
            return real_replace(src, dst)
        with patch.object(workflow.os, "replace", side_effect=fail_catalog):
            with self.assertRaisesRegex(OSError, "mock write failure"):
                self.refresh([event(title="Changed")])
        self.assertEqual(self.catalog.read_bytes(), before)
        self.assertFalse((self.root / "data/discovery/review.json").exists())
        self.assertEqual(list((self.root / "data/discovery/reports").glob("*.md")), [])

    def test_conflicting_identity_and_duplicate_sequences_fail(self):
        baseline = [event(), event("two", sequence=2)]
        with self.assertRaisesRegex(ValueError, "conflicting"):
            workflow.merge_events(baseline, [event("one", source_event_id="two")], {"test"})
        with self.assertRaisesRegex(ValueError, "duplicate"):
            workflow.validate_events([event(), event("two")])

    def test_null_incoming_keeps_known_baseline_detail(self):
        baseline = event(venue_detail="Curated detail")
        merged, _, changed, _ = workflow.merge_events([baseline], [event(venue_detail=None)], {"test"})
        self.assertEqual(merged[0]["venue_detail"], "Curated detail")
        self.assertEqual(changed, [])

    def test_invalid_dates_fail_before_writes(self):
        before = self.catalog.read_bytes()
        with self.assertRaises(ValueError):
            self.refresh([event(ends_at="2026-02-30")])
        self.assertEqual(self.catalog.read_bytes(), before)

    def test_kids_cafe_full_three_page_collection_in_staging(self):
        from sources import seoul_kids_cafe as cafe
        calls = []
        def fetch(url):
            from urllib.parse import urlsplit, parse_qs
            page = int(parse_qs(urlsplit(url).query)["q_currPage"][0])
            calls.append(page)
            return str(page)
        def parse(page, captured_at, **kwargs):
            return [{"source": "seoul_kids_cafe", "source_event_id": page, "title": "Venue " + page,
                     "url": "https://example.com/" + page, "captured_at": captured_at,
                     "payload": {"starts_at": "2026-01-01", "ends_at": "2026-12-31"}}]
        def collector(**kwargs):
            return cafe.collect(fetch_text=fetch, request_delay=0, fclty_stles=("2001",), **kwargs)
        with patch.object(workflow, "SOURCES", ("seoul_kids_cafe",)), patch.object(
                workflow.importlib, "import_module", return_value=SimpleNamespace(collect=collector)), patch.object(
                cafe, "parse_list_page", side_effect=parse), patch.object(cafe, "parse_last_page", return_value=3):
            rows, _ = workflow.collect_native(self.root)
        self.assertEqual(calls, [1, 2, 3])
        self.assertEqual(len(rows), 3)


class FeederTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.path = Path(self.tmp.name) / "feeder.json"

    def feed(self, generated="2026-11-15", keywords=None, **kwargs):
        self.path.write_text(json.dumps({"generated_at": generated, "keywords": keywords if keywords is not None else {
            "kids": [{"url": "https://example.com/venue", "title": "Venue"}]}}))
        return sample(self.path, today=date(2026, 11, 23), **kwargs)

    def test_freshness_boundaries_real_date_and_empty_search_results(self):
        self.assertEqual(self.feed()["fetched_at"], "2026-11-15")
        self.assertEqual(self.feed(keywords={"kids": []})["candidates"], [])
        self.assertEqual(self.feed(generated="2026-11-14", max_age_days=9)["fetched_at"], "2026-11-14")

    def test_stale_future_bad_nested_and_missing_input_fail(self):
        with self.assertRaises(ValueError):
            sample(self.path)
        for values in ({"generated": "2026-11-14"}, {"generated": "2026-11-24"},
                       {"keywords": {}}, {"keywords": {"kids": "bad"}},
                       {"keywords": {"kids": [{"url": "javascript:alert(1)"}]}},
                       {"keywords": {"kids": [{"url": "https://example.com", "title": {}}]}}):
            with self.subTest(values=values), self.assertRaises(ValueError):
                self.feed(**values)

    def test_source_trust_uses_hostname_boundary(self):
        for url in ("https://example.com/?source=seoul.go.kr", "https://seoul.go.kr.example.com", "https://seoul.go.kr@evil.com", "ftp://seoul.go.kr", None):
            self.assertFalse(is_official(url), url)
        self.assertTrue(is_official("https://parks.seoul.go.kr/event"))
        self.assertTrue(is_official("https://seoul.go.kr./event"))

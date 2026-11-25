import json
import tempfile
import unittest
from datetime import datetime, timezone
from pathlib import Path
from unittest.mock import patch

from babyroo_crawler.dates import seoul_today
from babyroo_crawler.discovery_workflow import refresh
from test_discovery_workflow import event


class ExpiredEventsTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name)
        self.catalog = self.root / "server/data/events.json"
        self.catalog.parent.mkdir(parents=True)

    def seed(self, rows):
        self.catalog.write_text(json.dumps({"count": len(rows), "events": rows}))

    def run_refresh(self, rows):
        return refresh(self.root, today="2026-11-25", native_collector=lambda p: (rows, {"test"}))

    def test_seoul_day_is_used_after_utc_afternoon(self):
        instant = datetime(2026, 11, 25, 15, 1, tzinfo=timezone.utc)
        with patch("babyroo_crawler.dates.datetime") as clock:
            clock.now.side_effect = lambda zone: instant.astimezone(zone)
            self.assertEqual(seoul_today(), "2026-11-26")

    def test_yesterday_excluded_today_future_and_permanent_kept(self):
        self.seed([event()])
        rows = [event(), event("ended", ends_at="2026-11-24", sequence=None),
                event("today", ends_at="2026-11-25", sequence=None),
                event("permanent", starts_at="1970-01-01", ends_at="9999-12-31", sequence=None)]
        result = self.run_refresh(rows)
        active = json.loads(self.catalog.read_text())["events"]
        self.assertEqual({e["id"] for e in active}, {"one", "today", "permanent"})
        self.assertEqual(result["added"], 2)
        self.assertEqual(result["excluded_expired"], 1)
        self.assertFalse(self.run_refresh(rows)["changed"])

    def test_all_expired_catalog_becomes_empty_and_repeat_is_stable(self):
        old = event(sequence=100, ends_at="2026-11-24")
        self.seed([old])
        self.run_refresh([])
        self.assertEqual(json.loads(self.catalog.read_text())["events"], [])
        self.assertEqual(json.loads(self.catalog.read_text())["count"], 0)
        self.assertFalse(self.run_refresh([])["changed"])
        self.assertFalse(self.run_refresh([old])["changed"])
        self.run_refresh([event("next", sequence=None)])
        self.assertEqual(json.loads(self.catalog.read_text())["events"][0]["csv_sequence"], 101)

    def test_official_end_correction_removes_existing_future_record(self):
        self.seed([event()])
        result = self.run_refresh([event(ends_at="2026-11-24")])
        self.assertEqual(result["updated"], 0)
        self.assertEqual(json.loads(self.catalog.read_text())["events"], [])

    def test_previous_ready_outcome_is_updated_when_event_expires(self):
        self.seed([event(ends_at="2026-11-24")])
        review = self.root / "data/discovery/review.json"
        review.parent.mkdir(parents=True)
        review.write_text(json.dumps({"missing": [], "candidates": [], "extractions": [{
            "candidate_id": "candidate", "proposal_id": "proposal", "event_id": "one",
            "status": "ready_for_pr", "reasons": [], "operator_notes": "Keep note"}]}))
        self.run_refresh([])
        outcome = json.loads(review.read_text())["extractions"][0]
        self.assertEqual(outcome["status"], "excluded")
        self.assertEqual(outcome["operator_notes"], "Keep note")
        self.assertFalse(self.run_refresh([])["changed"])

    def test_extension_restores_excluded_event_with_same_id_and_sequence(self):
        old = event(sequence=42, ends_at="2026-11-24")
        self.seed([old])
        self.run_refresh([old])
        self.run_refresh([{**old, "ends_at": "2026-12-01"}])
        current = json.loads(self.catalog.read_text())["events"][0]
        self.assertEqual((current["id"], current["csv_sequence"]), ("one", 42))
        self.assertEqual(json.loads((self.root / "data/discovery/review.json").read_text())["expired"], [])

    def test_invalid_expired_date_still_fails_without_writes(self):
        self.seed([event()])
        before = self.catalog.read_bytes()
        with self.assertRaises(ValueError):
            self.run_refresh([event(ends_at="2026-02-30")])
        self.assertEqual(self.catalog.read_bytes(), before)

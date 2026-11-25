import unittest
from pathlib import Path

from babyroo_crawler.dates import PERMANENT_START, PERMANENT_END
from babyroo_crawler.normalize import normalize_raw_event
from babyroo_crawler.discovery_workflow import merge_events
from crawler.discovery import extraction_schema
from sources import dikidiki, namu, nfm_kids, seoul_family_venues, seoul_kids_cafe


class PermanentDatesTest(unittest.TestCase):
    def admissions(self, captured_at):
        page = (Path(__file__).parent / "fixtures/seoul-kids-cafe-live-20261125.html").read_text()
        return [dikidiki.make_admission_event(captured_at), namu.make_admission_event(captured_at),
                nfm_kids.make_admission_event(captured_at),
                *[seoul_family_venues.make_admission_event(venue, captured_at)
                  for venue in seoul_family_venues.VENUES],
                *seoul_kids_cafe.parse_list_page(page, captured_at)]

    def test_all_native_admissions_use_same_stable_policy_as_extraction(self):
        self.assertEqual((extraction_schema.PERMANENT_START, extraction_schema.PERMANENT_END),
                         (PERMANENT_START, PERMANENT_END))
        for captured_at in ("2026-11-25", "2027-05-30"):
            for raw in self.admissions(captured_at):
                with self.subTest(source=raw["source"], item=raw["source_event_id"], captured_at=captured_at):
                    event = normalize_raw_event(raw).to_dict()
                    self.assertEqual((event["starts_at"], event["ends_at"]), (PERMANENT_START, PERMANENT_END))
                    self.assertEqual(event["last_checked_at"], captured_at)

    def test_existing_admissions_update_once_without_new_ids_then_stay_unchanged(self):
        incoming = [normalize_raw_event(raw).to_dict() for raw in self.admissions("2026-11-25")]
        baseline = [{**row, "starts_at": "2026-11-01", "ends_at": "2027-04-30", "csv_sequence": n}
                    for n, row in enumerate(incoming, 1)]
        merged, added, changed, missing = merge_events(baseline, incoming, {r["source"] for r in incoming})
        self.assertEqual((len(added), len(changed), len(missing)), (0, len(incoming), 0))
        self.assertEqual([r["id"] for r in merged], [r["id"] for r in baseline])
        later = [normalize_raw_event(raw).to_dict() for raw in self.admissions("2027-05-30")]
        again, added, changed, missing = merge_events(merged, later, {r["source"] for r in later})
        self.assertEqual(again, merged)
        self.assertEqual((added, changed, missing), ([], [], []))

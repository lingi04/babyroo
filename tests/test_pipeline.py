import tempfile
import unittest
from pathlib import Path

from babyroo_crawler.io import read_json, write_json
from babyroo_crawler.pipeline import publish


class PublishTest(unittest.TestCase):
    def test_publish_filters_events_that_should_not_be_public(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            normalized_dir = root / "normalized"
            public_dir = root / "public"

            valid_event = make_event(id="valid")
            ended_event = make_event(id="ended", ends_at="2026-06-04")
            missing_url_event = make_event(id="missing-url", source_url="")
            missing_location_event = make_event(id="missing-location", region=None, address=None)

            write_json(
                normalized_dir / "events.json",
                {
                    "events": [
                        valid_event,
                        ended_event,
                        missing_url_event,
                        missing_location_event,
                    ]
                },
            )

            payload = publish(
                normalized_dir=normalized_dir,
                public_dir=public_dir,
                today="2026-06-05",
            )

            self.assertEqual(payload["count"], 1)
            self.assertEqual(payload["events"], [valid_event])
            self.assertEqual(read_json(public_dir / "events.json"), payload)

            report = read_json(normalized_dir / "publish_report.json")
            self.assertEqual(report["input_count"], 4)
            self.assertEqual(report["published_count"], 1)
            self.assertEqual(report["excluded_count"], 3)
            self.assertEqual(
                [event["reasons"] for event in report["excluded"]],
                [["ended"], ["missing_source_url"], ["missing_location"]],
            )


def make_event(**overrides):
    event = {
        "id": "sample",
        "title": "아기와 함께하는 감각놀이 체험",
        "category": "experience",
        "starts_at": "2026-06-13",
        "ends_at": "2026-06-13",
        "region": "서울",
        "locality": "샘플구",
        "venue_name": "샘플 육아지원센터",
        "address": "서울시 샘플구 샘플로 1",
        "age_min_months": 12,
        "age_max_months": 36,
        "guardian_required": True,
        "price_type": "free",
        "price_text": "무료",
        "reservation_required": True,
        "reservation_status": "unknown",
        "indoor": True,
        "stroller_friendly": None,
        "nursing_room": None,
        "parking": None,
        "tags": ["24개월이하", "무료", "보호자동반", "실내", "예약필요"],
        "summary": "12개월 이상 영유아와 보호자가 함께 참여하는 실내 감각놀이 체험입니다.",
        "source": "manual_sample",
        "source_url": "https://example.com/events/sample-001",
        "source_event_id": "sample-001",
        "last_checked_at": "2026-06-05",
    }
    event.update(overrides)
    return event


if __name__ == "__main__":
    unittest.main()

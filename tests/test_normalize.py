import unittest

from babyroo_crawler.normalize import normalize_raw_event


class NormalizeTest(unittest.TestCase):
    def test_normalize_baby_event_fields(self):
        event = normalize_raw_event(
            {
                "source": "manual_sample",
                "source_event_id": "sample-001",
                "title": "아기와 함께하는 감각놀이 체험",
                "url": "https://example.com/events/sample-001",
                "captured_at": "2026-04-29",
                "payload": {
                    "description": "12개월 이상 영유아와 보호자가 함께 참여하는 실내 감각놀이 체험입니다. 사전예약 필요.",
                    "category": "체험",
                    "starts_at": "2026-05-10",
                    "ends_at": "2026-05-10",
                    "region": "서울",
                    "price_text": "무료",
                },
            }
        )

        self.assertEqual(event.age_min_months, 12)
        self.assertEqual(event.category, "experience")
        self.assertIs(event.guardian_required, True)
        self.assertIs(event.indoor, True)
        self.assertEqual(event.price_type, "free")
        self.assertIs(event.reservation_required, True)


if __name__ == "__main__":
    unittest.main()

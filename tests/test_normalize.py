import unittest

from babyroo_crawler.normalize import normalize_raw_event


class NormalizeTest(unittest.TestCase):
    def test_normalize_play_space_from_description(self):
        event = normalize_raw_event(
            {
                "source": "test",
                "title": "영아 전시",
                "url": "https://example.com/event",
                "payload": {
                    "category": "전시/미술",
                    "description": "36개월 미만 영아가 이용하는 서울형 키즈카페",
                    "starts_at": "2026-06-10",
                    "region": "서울",
                },
            }
        )

        self.assertEqual(event.category, "play_space")

    def test_normalize_year_age_range(self):
        event = normalize_raw_event(
            {
                "source": "test",
                "title": "유아 체험",
                "url": "https://example.com/event",
                "payload": {
                    "description": "만 3~5세 유아 대상 체험",
                    "starts_at": "2026-06-10",
                    "region": "서울",
                },
            }
        )

        self.assertEqual(event.age_min_months, 36)
        self.assertEqual(event.age_max_months, 60)

    def test_normalize_month_to_year_age_range(self):
        event = normalize_raw_event(
            {
                "source": "test",
                "title": "오감놀이",
                "url": "https://example.com/event",
                "payload": {
                    "description": "36개월~만8세 대상 워크샵",
                    "starts_at": "2026-06-10",
                    "region": "서울",
                },
            }
        )

        self.assertEqual(event.age_min_months, 36)
        self.assertEqual(event.age_max_months, 96)
        self.assertEqual(event.category, "experience")

    def test_normalize_museum_and_exhibition_categories(self):
        museum = normalize_raw_event(
            {
                "source": "test",
                "title": "박물관 관람",
                "url": "https://example.com/museum",
                "payload": {
                    "category": "박물관",
                    "description": "실내 자연사박물관 관람",
                    "starts_at": "2026-06-10",
                    "region": "서울",
                },
            }
        )
        exhibition = normalize_raw_event(
            {
                "source": "test",
                "title": "특별전시",
                "url": "https://example.com/exhibition",
                "payload": {
                    "category": "특별전시",
                    "description": "식물 감각 전시",
                    "starts_at": "2026-06-10",
                    "region": "서울",
                },
            }
        )

        self.assertEqual(museum.category, "museum")
        self.assertEqual(exhibition.category, "exhibition")

    def test_normalize_elementary_grade_age_range(self):
        event = normalize_raw_event(
            {
                "source": "test",
                "title": "박물관 투어",
                "url": "https://example.com/tour",
                "payload": {
                    "description": "대상 초4~6학년",
                    "starts_at": "2026-07-11",
                    "region": "서울",
                },
            }
        )

        self.assertEqual(event.age_min_months, 120)
        self.assertEqual(event.age_max_months, 144)

    def test_normalize_nfm_kids_age_formats(self):
        year_range = normalize_raw_event(
            {
                "source": "test",
                "title": "전시몰입",
                "url": "https://example.com/program",
                "payload": {
                    "age_text": "6세~10세, 어린이 포함 및 가족",
                    "starts_at": "2026-02-26",
                    "region": "서울",
                },
            }
        )
        elementary_range = normalize_raw_event(
            {
                "source": "test",
                "title": "교과연계",
                "url": "https://example.com/program",
                "payload": {
                    "age_text": "초등학생(1~2학년)",
                    "starts_at": "2026-04-22",
                    "region": "서울",
                },
            }
        )
        preschool = normalize_raw_event(
            {
                "source": "test",
                "title": "유아교육",
                "url": "https://example.com/program",
                "payload": {
                    "age_text": "취학 전 누리과정 어린이 단체 및 기관(20명 내외)",
                    "starts_at": "2026-04-15",
                    "region": "서울",
                },
            }
        )
        mixed_range = normalize_raw_event(
            {
                "source": "test",
                "title": "찾아가는 어린이박물관",
                "url": "https://example.com/program",
                "payload": {
                    "age_text": "25명 내외(1회 기준) 유아(만5~6세), 초등학생(1~2학년)",
                    "starts_at": "2026-04-22",
                    "region": "서울",
                },
            }
        )
        broad_school = normalize_raw_event(
            {
                "source": "test",
                "title": "문화나눔",
                "url": "https://example.com/program",
                "payload": {
                    "age_text": "초·중·고등 특수학급(장애 어린이), 장애인, 노인 단체",
                    "starts_at": "2026-08-19",
                    "region": "서울",
                },
            }
        )

        self.assertEqual(year_range.age_min_months, 72)
        self.assertEqual(year_range.age_max_months, 120)
        self.assertEqual(elementary_range.age_min_months, 84)
        self.assertEqual(elementary_range.age_max_months, 96)
        self.assertEqual(preschool.age_min_months, 36)
        self.assertEqual(preschool.age_max_months, 72)
        self.assertEqual(mixed_range.age_min_months, 60)
        self.assertEqual(mixed_range.age_max_months, 96)
        self.assertIsNone(broad_school.age_min_months)
        self.assertIsNone(broad_school.age_max_months)

    def test_normalize_year_to_elementary_grade_age_range(self):
        event = normalize_raw_event(
            {
                "source": "test",
                "title": "유치부 투어",
                "url": "https://example.com/tour",
                "payload": {
                    "age_text": "6세~초1 학년",
                    "starts_at": "2026-07-12",
                    "region": "서울",
                },
            }
        )

        self.assertEqual(event.age_min_months, 72)
        self.assertEqual(event.age_max_months, 84)

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
                    "address": "서울시 샘플구 샘플로 1",
                    "price_text": "무료",
                },
            }
        )

        self.assertEqual(event.age_min_months, 12)
        self.assertEqual(event.category, "experience")
        self.assertEqual(event.locality, "샘플구")
        self.assertIs(event.guardian_required, True)
        self.assertIs(event.indoor, True)
        self.assertEqual(event.price_type, "free")
        self.assertIs(event.reservation_required, True)
        self.assertEqual(event.reservation_status, "unknown")


if __name__ == "__main__":
    unittest.main()

import tempfile
import unittest
from pathlib import Path

from babyroo_crawler.io import read_json
from sources.seoul_culture import (
    collect,
    is_institution_only,
    is_zero_to_three_relevant,
    parse_detail,
)


DETAIL_HTML = """
<div class="event-detail">
  <div class="event-title">
    <p class="type">교육/체험</p>
    <h2>아기 오감놀이</h2>
  </div>
  <div class="type-box">
    <ul>
      <li><div class="type-th"><span>장소</span></div><div class="type-td"><span>서울상상나라</span></div></li>
      <li><div class="type-th"><span>기간</span></div><div class="type-td"><span>2026-06-13 ~ 2026-06-14</span></div></li>
      <li><div class="type-th"><span>대상</span></div><div class="type-td"><span>12개월 이상 영유아와 보호자</span></div></li>
      <li><div class="type-th"><span>요금</span></div><div class="type-td"><span>무료</span></div></li>
    </ul>
  </div>
  <div class="detail-btn"><a href="https://example.com/reserve" title="홈페이지 바로가기 새창열림">홈페이지 바로가기</a></div>
</div>
<div class="culture-content"><p>실내에서 진행하는 사전예약 체험입니다.</p></div>
"""


class SeoulCultureCollectorTest(unittest.TestCase):
    def test_zero_to_three_relevance_uses_explicit_age(self):
        self.assertTrue(is_zero_to_three_relevant("12개월 이상 영유아 대상"))
        self.assertTrue(is_zero_to_three_relevant("만 3~5세 유아 대상"))
        self.assertFalse(is_zero_to_three_relevant("5세~10세 유아동 대상"))
        self.assertFalse(is_zero_to_three_relevant("6~7세 유아 대상"))

    def test_institution_only_programs_are_excluded(self):
        self.assertTrue(is_institution_only("서울시 소재 어린이집 또는 유치원 신청"))
        self.assertFalse(is_institution_only("36개월 미만 영아와 보호자 이용"))

    def test_parse_detail(self):
        detail = parse_detail(DETAIL_HTML)

        self.assertEqual(detail["title"], "아기 오감놀이")
        self.assertEqual(detail["category"], "교육/체험")
        self.assertEqual(detail["place"], "서울상상나라")
        self.assertEqual(detail["period"], "2026-06-13 ~ 2026-06-14")
        self.assertEqual(detail["target"], "12개월 이상 영유아와 보호자")
        self.assertEqual(detail["price"], "무료")
        self.assertEqual(detail["description"], "실내에서 진행하는 사전예약 체험입니다.")
        self.assertEqual(detail["external_url"], "https://example.com/reserve")

    def test_collect_writes_raw_events(self):
        list_response = {
            "resultList": [
                {
                    "cultcode": 123,
                    "title": "아기 오감놀이",
                    "thumbDesc": "12개월 이상 영유아 대상",
                    "strtdate": "2026-06-13",
                    "endDate": "2026-06-14",
                    "subjcodeGroupNm": "교육/체험",
                    "facName": "서울상상나라",
                    "addr": "서울특별시 광진구 능동로 216",
                }
            ]
        }

        with tempfile.TemporaryDirectory() as tmp:
            output_path = Path(tmp) / "seoul_culture.json"
            events = collect(
                max_pages=1,
                output_path=output_path,
                fetch_json=lambda _: list_response,
                fetch_text=lambda _: DETAIL_HTML,
                request_delay=0,
            )

            self.assertEqual(len(events), 1)
            self.assertEqual(events[0]["source_event_id"], "123")
            self.assertEqual(events[0]["payload"]["age_text"], "12개월 이상 영유아와 보호자")
            self.assertEqual(events[0]["payload"]["price_text"], "무료")
            self.assertEqual(read_json(output_path)["events"], events)


if __name__ == "__main__":
    unittest.main()

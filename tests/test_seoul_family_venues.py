import tempfile
import unittest
from pathlib import Path

from babyroo_crawler.io import read_json
from sources.seoul_family_venues import (
    collect,
    parse_korean_date_range,
    parse_swr_detail,
    parse_swr_home_events,
)


SWR_HTML = """
<a href="javascript:;"><span>이전</span><img src="/museum/resources/images/common/h1.png" alt="서울물재생체험관"></a>
<div class="swiper-slide">
  <a href="/museum/cpage/board/event/view.do?board_seq=307&board_gb=event&menu_cd=C0018">
    <div class="img-wrap">
      <span class="mark">행사</span>
      <img src="/museum/common/nunFileDown.do?file_attach_seq=1025" alt="2026 서울물재생체험관 어린이 물놀이터 운영회차 변경 안내">
    </div>
  </a>
</div>
<div class="edu-list">
  <p><a href="/museum/cpage/board/edu_museum_press/view.do?board_seq=310&board_gb=edu_museum_press&menu_cd=C0015&currRow=1">
    <img src="/museum/common/nunFileDown.do?file_attach_seq=1032" alt="돌고 도는 물의 여행 야호!" >
  </a></p>
  <div><span>진행예정</span><span>교육</span></div>
  <dl>
    <dt><a href="/museum/cpage/board/edu_museum_press/view.do?board_seq=310&board_gb=edu_museum_press&menu_cd=C0015&currRow=1">돌고 도는 물의 여행 야호!</a></dt>
    <dd>2026.8.2. ~ 2026.8.30. (매주 일)</dd>
  </dl>
</div>
"""

SWR_DETAIL_HTML = """
<div class="info_txt">
  <ul>
    <li><span>참여대상</span>2016년생 ~ 2023년생 어린이</li>
    <li><span>행사일시</span>2026-08-04 ~ 2026-08-30</li>
    <li><span>접수기간</span>7.28.(화), 8.11(화) 14시 예약 오픈</li>
    <li><span>이용요금</span>무료</li>
    <li><span>신청방법</span>서울시공공서비스예약 포털</li>
  </ul>
</div>
"""


class SeoulFamilyVenuesCollectorTest(unittest.TestCase):
    def test_parse_korean_date_range_handles_dotted_dates(self):
        self.assertEqual(
            parse_korean_date_range("2026.8.2. ~ 2026.8.30. (매주 일)", "2026-07-22"),
            ("2026-08-02", "2026-08-30"),
        )

    def test_parse_swr_home_events_maps_program_cards(self):
        events = parse_swr_home_events(SWR_HTML, "2026-07-22")

        self.assertEqual(len(events), 2)
        self.assertEqual(events[0]["source"], "seoul_family_venues")
        self.assertEqual(events[0]["payload"]["venue_name"], "서울물재생체험관")
        self.assertEqual(events[0]["payload"]["category"], "행사")
        self.assertEqual(events[0]["payload"]["reservation_required"], True)
        self.assertEqual(events[1]["title"], "돌고 도는 물의 여행 야호!")
        self.assertEqual(events[1]["payload"]["starts_at"], "2026-08-02")
        self.assertEqual(events[1]["payload"]["ends_at"], "2026-08-30")
        self.assertEqual(events[1]["payload"]["reservation_status"], "available")

    def test_parse_swr_home_events_can_enrich_missing_dates_from_detail(self):
        events = parse_swr_home_events(
            SWR_HTML,
            "2026-07-22",
            fetch_detail=lambda _: SWR_DETAIL_HTML,
        )

        event = next(event for event in events if event["title"] == "2026 서울물재생체험관 어린이 물놀이터 운영회차 변경 안내")
        self.assertEqual(event["payload"]["starts_at"], "2026-08-04")
        self.assertEqual(event["payload"]["ends_at"], "2026-08-30")
        self.assertEqual(event["payload"]["age_text"], "2016년생 ~ 2023년생 어린이")
        self.assertIn("접수기간", event["payload"]["notes"])

    def test_parse_swr_detail_extracts_label_values(self):
        detail = parse_swr_detail(SWR_DETAIL_HTML)

        self.assertEqual(detail["행사일시"], "2026-08-04 ~ 2026-08-30")
        self.assertEqual(detail["이용요금"], "무료")

    def test_collect_writes_eight_admissions_and_swr_programs(self):
        with tempfile.TemporaryDirectory() as tmp:
            output_path = Path(tmp) / "seoul_family_venues.json"

            events = collect(
                output_path=output_path,
                fetch_text=lambda _: SWR_HTML,
                captured_at="2026-07-22",
            )

            self.assertEqual(len(events), 10)
            self.assertEqual(events[0]["source_event_id"], "lotteworld-aquarium-admission")
            self.assertEqual(events[0]["payload"]["item_type"], "venue_admission")
            self.assertEqual(events[4]["source_event_id"], "arisu-nara-admission")
            self.assertEqual(events[5]["source_event_id"], "war-memorial-kids-museum-admission")
            self.assertEqual(events[5]["payload"]["venue_name"], "전쟁기념관 어린이박물관")
            self.assertEqual(events[6]["source_event_id"], "national-museum-kids-museum-admission")
            self.assertEqual(events[6]["payload"]["venue_name"], "국립중앙박물관 어린이박물관")
            self.assertEqual(events[7]["source_event_id"], "police-museum-admission")
            self.assertEqual(events[7]["payload"]["venue_name"], "국립경찰박물관")
            self.assertEqual(events[8]["payload"]["item_type"], "program")
            self.assertEqual(read_json(output_path)["events"], events)


if __name__ == "__main__":
    unittest.main()

import tempfile
import unittest
from pathlib import Path

from babyroo_crawler.io import read_json
from sources.namu import (
    collect,
    parse_calendar_year_month,
    parse_education_calendar,
    parse_education_detail,
    parse_exhibitions,
)


EXHIBITION_HTML = """
<meta property="og:url" content="https://namu.sdm.go.kr/web/main/exhibition/special/current/view">
<meta property="og:description" content="식물의 감각 세계를 탐구합니다.">
<img style="width : 350px; height: 500px;" alt="" src="/uploadfile/asa/exhibition/314/poster.png" onerror="this.src='/assets/images/noImage300x300.jpg'"/>
<div class="current-tit">전시명</div>
<div class="current-con">무빙가든 MOVING GARDEN: 식물의 감각</div>
<div class="current-tit">전시장소</div>
<div class="current-con">1층 특별전시실</div>
<div class="current-tit">전시구분</div>
<div class="current-con">특별전시</div>
<div class="current-tit">전시기간</div>
<div class="current-con">2026-06-06 ~ 2026-10-18</div>
"""

EDUCATION_HTML = """
<a href="?calYear=2026&amp;calMonth=6&direction=left" class="option-btn prev-style">이전달</a>
<a href="?calYear=2026&amp;calMonth=8&direction=right" class="option-btn next-style">다음달</a>
<input type="hidden" name="25_class_title1" value="배고픈 식물들1" />
<input type="hidden" name="25_class_time1" value="10:00~11:30" />
<input type="hidden" name="25_class_link1" value="26086" />
<input type="hidden" name="30_science_title1" value="【올해의 과학도서 2강】 호랑이는 숲에 살지 않는다" />
<input type="hidden" name="30_science_time1" value="19:00~21:00" />
<input type="hidden" name="30_science_link1" value="26122" />
"""

EDUCATION_DETAIL_HTML = """
<ul class="ul-dot3">
  <li><span class="item">강좌명</span>(고)투어</li>
  <li><span class="item">장소</span>1층 중앙홀 안내데스크 옆</li>
  <li><span class="item">날짜</span>2026-07-11</li>
  <li><span class="item">시간</span>10:00~12:00</li>
  <li><span class="item">대상</span>초4~6학년</li>
  <li><span class="item">수강료</span>16,000원<ul><li>연간회원 11,000원</li></ul></li>
</ul>
<h4 class="sub-h4-tit">프로그램 구성</h4>
<div class="sub-h4-box">
  <p class="sm-txt">박물관 3층 지구환경관을 관람하는 프로그램입니다.</p>
</div>
"""

EDUCATION_DETAIL_WITH_ANGLE_TITLE_HTML = """
<ul class="ul-dot3">
  <li><span class="item">강좌명</span>(7월)<망원경: 밤하늘 관측 과학도구></li>
  <li><span class="item">장소</span>2층 세미나실(사무실 윗층)</li>
  <li><span class="item">날짜</span>2026-07-18</li>
  <li><span class="item">시간</span>19:00~21:00</li>
  <li><span class="item">대상</span>초등학생 포함 가족</li>
  <li><span class="item">수강료</span>25,000원<ul><li>연간회원(일반) 25,000원</li></ul></li>
</ul>
"""


class NamuCollectorTest(unittest.TestCase):
    def test_parse_exhibitions_maps_current_exhibition(self):
        events = parse_exhibitions([EXHIBITION_HTML], "2026-07-21")

        self.assertEqual(len(events), 1)
        event = events[0]
        self.assertEqual(event["source"], "namu")
        self.assertEqual(event["source_event_id"], "exhibition-special-current")
        self.assertEqual(event["payload"]["item_type"], "exhibition")
        self.assertEqual(event["payload"]["starts_at"], "2026-06-06")
        self.assertEqual(event["payload"]["ends_at"], "2026-10-18")
        self.assertEqual(event["payload"]["category"], "특별전시")
        self.assertEqual(event["payload"]["venue_name"], "서대문자연사박물관")
        self.assertEqual(event["payload"]["venue_detail"], "1층 특별전시실")
        self.assertEqual(
            event["payload"]["image_url"],
            "https://namu.sdm.go.kr/uploadfile/asa/exhibition/314/poster.png",
        )

    def test_parse_education_calendar_uses_calendar_month_and_hidden_inputs(self):
        self.assertEqual(parse_calendar_year_month(EDUCATION_HTML, "2026-07-21"), (2026, 7))

        events = parse_education_calendar(EDUCATION_HTML, "2026-07-21")

        self.assertEqual(len(events), 2)
        self.assertEqual(events[0]["payload"]["starts_at"], "2026-07-25")
        self.assertEqual(events[0]["payload"]["category"], "박물관 교실")
        self.assertEqual(events[0]["payload"]["reservation_required"], True)
        self.assertEqual(events[1]["payload"]["category"], "과학강연")
        self.assertIn("수업시간", events[1]["payload"]["notes"])

    def test_parse_education_detail_extracts_age_price_and_summary(self):
        detail = parse_education_detail(EDUCATION_DETAIL_HTML)

        self.assertEqual(detail["title"], "(고)투어")
        self.assertEqual(detail["venue_name"], "1층 중앙홀 안내데스크 옆")
        self.assertEqual(detail["date"], "2026-07-11")
        self.assertEqual(detail["age_text"], "초4~6학년")
        self.assertEqual(detail["price_text"], "16,000원 연간회원 11,000원")
        self.assertIn("지구환경관", detail["summary"])

    def test_parse_education_detail_preserves_korean_angle_bracket_title(self):
        detail = parse_education_detail(EDUCATION_DETAIL_WITH_ANGLE_TITLE_HTML)

        self.assertEqual(detail["title"], "(7월)<망원경: 밤하늘 관측 과학도구>")

    def test_parse_education_calendar_can_enrich_from_detail_pages(self):
        events = parse_education_calendar(
            EDUCATION_HTML,
            "2026-07-21",
            fetch_detail=lambda _: EDUCATION_DETAIL_HTML,
        )

        self.assertEqual(events[0]["payload"]["age_text"], "초4~6학년")
        self.assertEqual(events[0]["payload"]["price_text"], "16,000원 연간회원 11,000원")
        self.assertEqual(events[0]["payload"]["venue_name"], "서대문자연사박물관")
        self.assertEqual(events[0]["payload"]["venue_detail"], "1층 중앙홀 안내데스크 옆")
        self.assertIn("지구환경관", events[0]["payload"]["summary"])

    def test_collect_writes_admission_exhibition_and_programs(self):
        with tempfile.TemporaryDirectory() as tmp:
            output_path = Path(tmp) / "namu.json"

            def fetch_text(url):
                if "education/all/list" in url:
                    return EDUCATION_HTML
                if "education/" in url:
                    return EDUCATION_DETAIL_HTML
                return EXHIBITION_HTML

            events = collect(
                output_path=output_path,
                fetch_text=fetch_text,
                captured_at="2026-07-21",
                request_delay=0,
            )

            self.assertEqual(len(events), 5)
            self.assertEqual(events[0]["source_event_id"], "admission")
            self.assertEqual(events[0]["payload"]["item_type"], "venue_admission")
            self.assertEqual(read_json(output_path)["events"], events)


if __name__ == "__main__":
    unittest.main()

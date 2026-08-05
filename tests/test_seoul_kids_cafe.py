import tempfile
import unittest
from pathlib import Path

from babyroo_crawler.io import read_json
from sources.seoul_kids_cafe import collect, make_list_url, parse_last_page, parse_list_page


LIST_HTML = """
<div class="kidscafe_wrap">
  <h5>서울형 키즈카페 시립 뚝섬자벌레점</h5>
  <div class="kidscafe_body type2">
    <div class="kidscafe_image">
      <p class="img"><img src="/icare/upload/fcltyInfoManage/2026/1/20/sample.jpg" alt="썸네일"/></p>
    </div>
    <div class="kidscafe_info">
      <dl>
        <dt>이용정원</dt>
        <dd><strong>개인</strong><span>43 명</span><strong>단체</strong><span>43 명</span></dd>
        <dt class="age">이용연령</dt>
        <dd class="age"><strong>0 ~ 6세 (연나이 기준)</strong><br><strong class="year">2026년생 ~ 2020년생</strong></dd>
        <dt class="age">주&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;소</dt>
        <dd class="age">서울특별시 광진구 강변북로 2202 2층 꿈틀나루</dd>
        <dt class="age">전화번호</dt>
        <dd class="age"><a href="tel:02-498-4445">02-498-4445</a></dd>
      </dl>
      <div class="btn_wrap">
        <a href="BD_selectKidsCafeView.do?q_fcltyId=GJ240401&q_fcltyStle=2001" class="md_btn">이용안내</a>
        <a href="/icare/user/kidsCafeResve/BD_selectKidsCafeResveCal.do?q_fcltyId=GJ240401&q_fcltyStle=2001" class="lg_btn">예약 신청</a>
      </div>
    </div>
  </div>
</div><!-- kidscafe_wrap end -->
<div class="paging">
  <a href="#" onclick="jsMovePage(1); return false;">1</a>
  <a href="#" onclick="jsMovePage(2); return false;">2</a>
</div>
"""


class SeoulKidsCafeCollectorTest(unittest.TestCase):
    def test_parse_list_page_maps_cafe_cards(self):
        events = parse_list_page(LIST_HTML, "2026-08-03")

        self.assertEqual(len(events), 1)
        event = events[0]
        self.assertEqual(event["source"], "seoul_kids_cafe")
        self.assertEqual(event["source_event_id"], "2001-GJ240401")
        self.assertEqual(event["title"], "서울형 키즈카페 시립 뚝섬자벌레점 이용")
        self.assertEqual(
            event["url"],
            "https://umppa.seoul.go.kr/icare/user/kidsCafe/BD_selectKidsCafeView.do?q_fcltyId=GJ240401&q_fcltyStle=2001",
        )
        self.assertEqual(event["payload"]["category"], "키즈카페")
        self.assertEqual(event["payload"]["locality"], "광진구")
        self.assertEqual(event["payload"]["age_text"], "0 ~ 6세 (연나이 기준) 2026년생 ~ 2020년생")
        self.assertEqual(event["payload"]["price_text"], "유료")
        self.assertEqual(event["payload"]["reservation_required"], True)
        self.assertEqual(event["payload"]["facility_style"], "2001")
        self.assertEqual(event["payload"]["facility_style_label"], "서울형 키즈카페")
        self.assertIn("02-498-4445", event["payload"]["notes"])

    def test_parse_list_page_prefixes_here_and_there_cafe_ids(self):
        html = LIST_HTML.replace("q_fcltyStle=2001", "q_fcltyStle=2002")

        events = parse_list_page(html, "2026-08-03", fclty_stle="2002")

        self.assertEqual(events[0]["source_event_id"], "2002-GJ240401")
        self.assertEqual(
            events[0]["url"],
            "https://umppa.seoul.go.kr/icare/user/kidsCafe/BD_selectKidsCafeView.do?q_fcltyId=GJ240401&q_fcltyStle=2002",
        )
        self.assertEqual(events[0]["payload"]["facility_style"], "2002")
        self.assertEqual(events[0]["payload"]["facility_style_label"], "여기저기 키즈카페")

    def test_parse_last_page_uses_pagination_links(self):
        self.assertEqual(parse_last_page(LIST_HTML), 2)

    def test_collect_writes_all_pages_until_last_page(self):
        with tempfile.TemporaryDirectory() as tmp:
            output_path = Path(tmp) / "seoul_kids_cafe.json"

            events = collect(
                output_path=output_path,
                fetch_text=lambda _: LIST_HTML,
                captured_at="2026-08-03",
                request_delay=0,
                fclty_stles=("2001",),
            )

            self.assertEqual(len(events), 2)
            self.assertEqual(read_json(output_path)["events"], events)

    def test_collect_fetches_each_facility_style(self):
        seen_urls = []

        with tempfile.TemporaryDirectory() as tmp:
            output_path = Path(tmp) / "seoul_kids_cafe.json"

            events = collect(
                output_path=output_path,
                fetch_text=lambda url: seen_urls.append(url) or LIST_HTML,
                captured_at="2026-08-03",
                max_pages=1,
                request_delay=0,
                fclty_stles=("2001", "2002"),
            )

            self.assertEqual(len(events), 2)
            self.assertEqual(seen_urls, [make_list_url(1, "2001"), make_list_url(1, "2002")])


if __name__ == "__main__":
    unittest.main()

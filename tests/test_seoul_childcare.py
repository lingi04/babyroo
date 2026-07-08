import tempfile
import unittest
from pathlib import Path

from babyroo_crawler.io import read_json
from sources.seoul_childcare import collect, parse_detail, parse_event_links


LIST_HTML = """
<div class="cal_list">
  <a href="#none" onclick="fnCalDetail(100)">다문화부모 양육클래스</a>
  <a href="#none" onclick="fnCalDetail(200)">보육교직원 안전교육</a>
</div>
"""

DETAIL_HTML = """
<div class="com_view">
  <table><tbody>
    <tr><th scope="row">제목</th><td>다문화부모 양육클래스</td></tr>
    <tr><th scope="row">행사기간</th><td>2026-06-10 ~ 2026-06-10</td></tr>
    <tr><th scope="row">접수기간</th><td>2026-05-06 ~ 2026-05-20</td></tr>
    <tr><th scope="row">시간</th><td>10:30 ~ 12:30</td></tr>
    <tr><th scope="row">장소</th><td>서울시육아종합지원센터 강당</td></tr>
    <tr><td colspan="2" class="con_con"><p>부모를 위한 양육 교육입니다.</p></td></tr>
  </tbody></table>
</div>
"""


class SeoulChildcareCollectorTest(unittest.TestCase):
    def test_parse_event_links(self):
        self.assertEqual(
            parse_event_links(LIST_HTML),
            {
                "100": "다문화부모 양육클래스",
                "200": "보육교직원 안전교육",
            },
        )

    def test_parse_detail(self):
        detail = parse_detail(DETAIL_HTML)

        self.assertEqual(detail["제목"], "다문화부모 양육클래스")
        self.assertEqual(detail["행사기간"], "2026-06-10 ~ 2026-06-10")
        self.assertEqual(detail["장소"], "서울시육아종합지원센터 강당")
        self.assertEqual(detail["description"], "부모를 위한 양육 교육입니다.")

    def test_collect_writes_parent_events_only(self):
        with tempfile.TemporaryDirectory() as tmp:
            output_path = Path(tmp) / "seoul_childcare.json"

            def fetch_text(url):
                return DETAIL_HTML if "EdcEventSl.jsp" in url else LIST_HTML

            events = collect(
                months=1,
                output_path=output_path,
                fetch_text=fetch_text,
                request_delay=0,
            )

            self.assertEqual(len(events), 1)
            self.assertEqual(events[0]["source_event_id"], "100")
            self.assertEqual(events[0]["payload"]["starts_at"], "2026-06-10")
            self.assertEqual(
                events[0]["payload"]["address"],
                "서울특별시 마포구 서강로 75-16",
            )
            self.assertIn("접수기간", events[0]["payload"]["notes"])
            self.assertEqual(read_json(output_path)["events"], events)


if __name__ == "__main__":
    unittest.main()

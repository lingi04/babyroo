import tempfile
import unittest
from pathlib import Path

from babyroo_crawler.io import read_json
from sources.seoul_childcare import collect, parse_detail, parse_event_links, checked_event_links


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
    def test_staff_only_months_and_empty_month_are_verified_zero(self):
        staff = '<div class="cal_list"><a onclick="fnCalDetail(1)">원장대상 워크숍</a></div>'
        empty = '<div class="cal_list"><p>등록된 일정이 없습니다.</p></div>'
        pages = iter([staff, staff, empty])
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "raw.json"
            rows = collect(output_path=path, fetch_text=lambda url: next(pages), request_delay=0)
            self.assertEqual(rows, [])
            self.assertEqual(rows.verified_empty_reason, "no_parent_facing_candidates")
            checks = read_json(path)["collection"]["list_checks"]
            self.assertEqual([r["listed_count"] for r in checks], [1, 1, 0])
            self.assertTrue(all(r["parent_count"] == 0 for r in checks))

    def test_fully_empty_recognized_calendars_are_verified_zero(self):
        with tempfile.TemporaryDirectory() as tmp:
            rows = collect(output_path=Path(tmp) / "raw.json", months=1,
                           fetch_text=lambda url: '<div class="cal_list"></div>', request_delay=0)
            self.assertEqual(rows, [])
            self.assertEqual(rows.verified_empty_reason, "no_parent_facing_candidates")

    def test_unknown_blocked_or_changed_empty_page_does_not_replace_output(self):
        bad_pages = ["", "<html>Access denied</html>", '<form>로그인</form>',
                     '<div class="new_calendar"></div>', '<div class="cal_list">',
                     '<div class="cal_list"><a onclick="newDetail(1)">부모 교육</a></div>',
                     '<div class="cal_list"><a onclick="fnCalDetail(abc)">부모 교육</a></div>',
                     '<div class="cal_list"><a onclick="fnCalDetail(1)"></a></div>']
        for html in bad_pages:
            with self.subTest(html=html), tempfile.TemporaryDirectory() as tmp:
                path = Path(tmp) / "raw.json"
                path.write_text("keep")
                with self.assertRaisesRegex(ValueError, "calendar"):
                    collect(output_path=path, months=1, fetch_text=lambda url: html, request_delay=0)
                self.assertEqual(path.read_text(), "keep")

    def test_one_bad_month_cannot_hide_behind_other_valid_staff_months(self):
        pages = iter(['<a onclick="fnCalDetail(1)">보육교직원 교육</a>', "Access denied"])
        with tempfile.TemporaryDirectory() as tmp, self.assertRaisesRegex(ValueError, "calendar"):
            collect(output_path=Path(tmp) / "raw.json", months=2,
                    fetch_text=lambda url: next(pages), request_delay=0)

    def test_parent_detail_missing_or_bad_period_is_not_verified_zero(self):
        for detail in ("<html>로그인</html>", DETAIL_HTML.replace("2026-06-10", "미정")):
            with self.subTest(detail=detail), tempfile.TemporaryDirectory() as tmp:
                path = Path(tmp) / "raw.json"
                path.write_text("keep")
                with self.assertRaisesRegex(ValueError, "detail|period"):
                    collect(output_path=path, months=1, request_delay=0,
                            fetch_text=lambda url: detail if "EdcEventSl.jsp" in url else LIST_HTML)
                self.assertEqual(path.read_text(), "keep")

    def test_network_failure_is_not_an_empty_success(self):
        with tempfile.TemporaryDirectory() as tmp:
            def fail(url):
                raise TimeoutError("network timeout")
            path = Path(tmp) / "raw.json"
            with self.assertRaises(TimeoutError):
                collect(output_path=path, fetch_text=fail)
            self.assertFalse(path.exists())

    def test_zero_months_cannot_attest_success(self):
        with tempfile.TemporaryDirectory() as tmp, self.assertRaises(ValueError):
            collect(months=0, output_path=Path(tmp) / "raw.json")

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

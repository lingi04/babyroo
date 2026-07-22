import tempfile
import unittest
from pathlib import Path

from babyroo_crawler.io import read_json
from sources.nfm_kids import collect, parse_education_list


EDUCATION_HTML = """
<tbody>
  <tr>
    <td class="num">1</td>
    <td class="cate">[주말교육]</td>
    <td class="subject">
      <a href="javascript:void(0);" onClick="javascript:fn_education_detail('13918');">
        <span class="status status1 type1">접수예정</span>
        [2026년 하반기 주말 교육] 찾아라! 민속
      </a>
    </td>
    <td class="target">어린이 동반 가족</td>
    <td class="term wide"><span>2026-08-01</span> ~ <span>2026-11-29</span></td>
  </tr>
  <tr>
    <td class="num">2</td>
    <td class="cate">[유아교육]</td>
    <td class="subject">
      <a href="javascript:void(0);" onClick="javascript:fn_education_detail('13910');">
        <span class="status status1 type3">접수마감</span>
        [2026년 상반기] 유아교육(단체)
      </a>
    </td>
    <td class="target">취학 전 누리과정 어린이 단체 및 기관(20명 내외)</td>
    <td class="term wide"><span>2026-04-15</span> ~ <span>2026-06-17</span></td>
  </tr>
</tbody>
"""


class NfmKidsCollectorTest(unittest.TestCase):
    def test_parse_education_list_maps_program_rows(self):
        events = parse_education_list(EDUCATION_HTML, "2026-07-22")

        self.assertEqual(len(events), 2)
        self.assertEqual(events[0]["source"], "nfm_kids")
        self.assertEqual(events[0]["source_event_id"], "education-13918")
        self.assertEqual(events[0]["payload"]["item_type"], "program")
        self.assertEqual(events[0]["payload"]["category"], "주말교육")
        self.assertEqual(events[0]["payload"]["title"], "[2026년 하반기 주말 교육] 찾아라! 민속")
        self.assertEqual(events[0]["payload"]["age_text"], "어린이 동반 가족")
        self.assertEqual(events[0]["payload"]["starts_at"], "2026-08-01")
        self.assertEqual(events[0]["payload"]["ends_at"], "2026-11-29")
        self.assertEqual(events[0]["payload"]["reservation_status"], "available")
        self.assertEqual(events[1]["payload"]["reservation_status"], "closed")

    def test_collect_writes_admission_and_programs(self):
        with tempfile.TemporaryDirectory() as tmp:
            output_path = Path(tmp) / "nfm_kids.json"

            events = collect(
                output_path=output_path,
                fetch_text=lambda _: EDUCATION_HTML,
                captured_at="2026-07-22",
            )

            self.assertEqual(len(events), 3)
            self.assertEqual(events[0]["source_event_id"], "admission")
            self.assertEqual(events[0]["payload"]["item_type"], "venue_admission")
            self.assertEqual(read_json(output_path)["events"], events)


if __name__ == "__main__":
    unittest.main()

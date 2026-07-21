import tempfile
import unittest
from pathlib import Path

from babyroo_crawler.io import read_json
from sources.dikidiki import collect, make_image_url, make_workshop_events


WORKSHOP_RESPONSE = {
    "list": [
        {
            "workshopSeq": 24,
            "workshopTitle": "모두의 놀이터, 몽클한 촉감놀이터 <발굴 탐험대>",
            "workshopDesc": "천연 클레이로 노는 창의 오감 놀이터",
            "workshopCategory": "SENSE",
            "workshopAge": "36개월~만8세",
            "startDt": "2026-07-25",
            "endDt": "2026-11-17",
            "time": "회차별 상시운영",
            "cost": "15,000원",
            "workshopInfo": "말랑말랑 천연 클레이로 놀이하는 오감놀이",
            "cnt": "15명 정원",
            "applyWay": "당일 현장접수",
            "authorInfo": "디키디키 디디랩 자체운영",
            "fileList": [
                {
                    "saveLocation": "/data/dikidiki/1021/20240915",
                    "saveFilename": "/sample.jpg",
                }
            ],
        }
    ],
    "totalCount": 1,
}


class DikiDikiCollectorTest(unittest.TestCase):
    def test_make_workshop_events_maps_api_items(self):
        events = make_workshop_events(WORKSHOP_RESPONSE, "2026-07-21")

        self.assertEqual(len(events), 1)
        event = events[0]
        self.assertEqual(event["source"], "dikidiki")
        self.assertEqual(event["source_event_id"], "workshop-24")
        self.assertEqual(event["url"], "https://dikidiki.co.kr/workshop_detail.do?seq=24")
        self.assertEqual(event["payload"]["item_type"], "program")
        self.assertEqual(event["payload"]["starts_at"], "2026-07-25")
        self.assertEqual(event["payload"]["reservation_required"], False)
        self.assertEqual(event["payload"]["reservation_status"], "available")
        self.assertIn("수업시간", event["payload"]["notes"])
        self.assertEqual(
            event["payload"]["image_url"],
            "https://datafolder.ezpmp.co.kr/data/dikidiki/1021/20240915/sample.jpg",
        )

    def test_make_image_url_handles_missing_files(self):
        self.assertIsNone(make_image_url({"fileList": []}))

    def test_collect_writes_admission_and_workshops(self):
        with tempfile.TemporaryDirectory() as tmp:
            output_path = Path(tmp) / "dikidiki.json"
            events = collect(
                output_path=output_path,
                fetch_json=lambda _: WORKSHOP_RESPONSE,
                captured_at="2026-07-21",
            )

            self.assertEqual(len(events), 2)
            self.assertEqual(events[0]["source_event_id"], "admission")
            self.assertEqual(events[0]["payload"]["item_type"], "venue_admission")
            self.assertEqual(events[1]["source_event_id"], "workshop-24")
            self.assertEqual(read_json(output_path)["events"], events)


if __name__ == "__main__":
    unittest.main()

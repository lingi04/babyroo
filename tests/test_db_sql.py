import unittest

from babyroo_crawler.db_sql import generate_sql, literal
from babyroo_crawler.discovery_workflow import merge_events
from test_discovery_workflow import event


class DatabaseSqlTest(unittest.TestCase):
    def test_only_changed_fields_are_written_and_db_owned_fields_preserved(self):
        old = event()
        merged, added, changed, _ = merge_events([old], [{**old, "title": "New title"}], {"test"})
        sql = generate_sql([old], added, changed, [])
        self.assertIn('"title" = \'New title\'', sql)
        self.assertNotIn('"source_url" =', sql)
        self.assertNotIn("image_url", sql)
        self.assertNotIn("admin_updated_at", sql)
        self.assertIn("WHERE id = 'one';", sql)
        for removed in ("DO $", "DECLARE", "jsonb_populate_record", "RAISE EXCEPTION", "IS NOT DISTINCT FROM"):
            self.assertNotIn(removed, sql)

    def test_new_records_are_published_in_one_file_without_hard_deletes(self):
        row = event("new", title="제목 ' ; $babyroo$ $data$ \\ quote")
        sql = generate_sql([event("ended")], [row], [], [event("ended", ends_at="2020-01-01")])
        self.assertIn("ON CONFLICT (id) DO NOTHING", sql)
        self.assertIn("publication_status = 'archived'", sql)
        self.assertIn("'published',\n  CURRENT_TIMESTAMP", sql)
        self.assertNotIn("DELETE FROM", sql)
        self.assertIn("E'제목 '' ; $babyroo$ $data$ \\\\ quote'", sql)
        self.assertTrue(sql.rstrip().endswith("COMMIT;"))

    def test_literals_preserve_dates_arrays_booleans_and_nulls(self):
        self.assertEqual(literal(["실내", "it's"]), "ARRAY['실내', 'it''s']::text[]")
        self.assertEqual(literal([]), "ARRAY[]::text[]")
        self.assertEqual([literal(v) for v in (True, False, None, 0)], ["TRUE", "FALSE", "NULL", "0"])
        sql = generate_sql([], [event()], [], [])
        self.assertIn("DATE '2026-01-01'", sql)

    def test_nul_is_rejected_before_sql_can_be_written(self):
        with self.assertRaises(ValueError):
            generate_sql([], [event(title="bad\x00value")], [], [])

import unittest

from babyroo_crawler.db_sql import generate_sql
from babyroo_crawler.discovery_workflow import merge_events
from test_discovery_workflow import event


class DatabaseSqlTest(unittest.TestCase):
    def test_only_changed_fields_are_written_and_db_owned_fields_preserved(self):
        old = event()
        merged, added, changed, _ = merge_events([old], [{**old, "title": "New title"}], {"test"})
        sql = generate_sql([old], added, changed, [])
        self.assertIn('"title" = after_row."title"', sql)
        self.assertNotIn('"source_url" = after_row."source_url"', sql)
        self.assertNotIn("image_url", sql)
        self.assertNotIn("admin_updated_at", sql)
        self.assertIn("IS NOT DISTINCT FROM before_row", sql)
        self.assertIn("transaction aborted", sql)

    def test_new_records_are_published_in_one_file_without_hard_deletes(self):
        row = event("new", title="제목 ' ; $babyroo$ $data$ \\ quote")
        sql = generate_sql([event("ended")], [row], [], [event("ended", ends_at="2020-01-01")])
        self.assertIn("ON CONFLICT (id) DO NOTHING", sql)
        self.assertIn("publication_status = 'archived'", sql)
        self.assertIn("'published', CURRENT_TIMESTAMP", sql)
        self.assertNotIn("DELETE FROM", sql)
        self.assertIn("$babyroo_$", sql)
        self.assertIn("$data_$", sql)

    def test_nul_is_rejected_before_sql_can_be_written(self):
        with self.assertRaises(ValueError):
            generate_sql([], [event(title="bad\x00value")], [], [])

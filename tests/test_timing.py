import contextlib
import io
import json
import os
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from babyroo_crawler.timing import timed_step
from crawler.discovery.queue_state import acquire_run, active_run, finish_run, stage_run
from discovery_run import execute_owned


class TimingTest(unittest.TestCase):
    def test_failed_steps_are_recorded_in_external_journal(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "timings.jsonl"
            with patch.dict(os.environ, {"BABYROO_TIMING_FILE": str(path), "BABYROO_RUN_ID": "run"}), contextlib.redirect_stderr(io.StringIO()):
                with patch("babyroo_crawler.timing.time.perf_counter", side_effect=[10, 12.5]), self.assertRaises(ValueError):
                    with timed_step("collector.test"):
                        raise ValueError("source failed")
            start, end = [json.loads(line) for line in path.read_text().splitlines()]
            self.assertEqual((start["event"], end["status"], end["duration_seconds"]), ("started", "failed", 2.5))
            self.assertEqual(end["run_id"], "run")

    def test_phase_transitions_and_failure_summary_preserve_owner(self):
        with tempfile.TemporaryDirectory() as tmp:
            state = Path(tmp) / "queue.json"
            token = acquire_run(state)["run_id"]
            stage_run(state, token, "search")
            stage_run(state, token, "search")  # Retried boundary does not reset time.
            with self.assertRaises(ValueError):
                stage_run(state, "other", "extraction")
            stage_run(state, token, "extraction")
            phases = active_run(state)["stages"]
            self.assertEqual([p["status"] for p in phases], ["completed", "running"])
            result = finish_run(state, token, Path(tmp) / "outcome.json", "failed")
            self.assertEqual(result["timings"]["stages"][-1]["status"], "failed")
            self.assertGreaterEqual(result["timings"]["total_seconds"], 0)
            self.assertIsNone(active_run(state))

    def test_timing_write_failure_does_not_fail_successful_work(self):
        with patch.dict(os.environ, {"BABYROO_TIMING_FILE": "/nonexistent/parent/timing.jsonl"}), contextlib.redirect_stderr(io.StringIO()):
            with timed_step("test"):
                pass

    def test_execute_propagates_run_id_and_records_child_timing(self):
        with tempfile.TemporaryDirectory() as tmp:
            state = Path(tmp) / "queue.json"
            outcome = Path(tmp) / "outcome.json"
            token = acquire_run(state)["run_id"]
            result, code = execute_owned(state, token, outcome, [sys.executable, "-c",
                'from babyroo_crawler.timing import timed_step\nwith timed_step("child"):\n pass\n'])
            self.assertEqual(code, 0)
            records = [json.loads(line) for line in outcome.with_suffix(".timings.jsonl").read_text().splitlines()]
            self.assertEqual(records[-1]["run_id"], token)
            self.assertEqual(records[-1]["status"], "completed")
            self.assertEqual(result["timings"]["stages"][-1]["name"], "catalog")

    def test_missing_timing_storage_does_not_strand_failed_command(self):
        with tempfile.TemporaryDirectory() as tmp:
            state = Path(tmp) / "queue.json"
            token = acquire_run(state)["run_id"]
            with patch.object(Path, "touch", side_effect=OSError("disk full")), contextlib.redirect_stderr(io.StringIO()):
                result, code = execute_owned(state, token, Path(tmp) / "outcome.json",
                                             [sys.executable, "-c", "raise SystemExit(1)"])
            self.assertEqual(code, 1)
            self.assertEqual(result["ownership"], "released")
            self.assertIsNone(active_run(state))

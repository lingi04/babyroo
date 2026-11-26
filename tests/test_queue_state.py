"""Offline regression coverage for persistent run ownership and queue transactions."""
import contextlib
import io
import json
import os
import subprocess
import sys
import tempfile
import unittest
from datetime import date
from pathlib import Path
from unittest.mock import patch

from crawler.discovery.extraction_queue import build_queue
from crawler.discovery.extraction_schema import BundleError, read_json
from crawler.discovery.queue_state import (AlreadyRunning, acquire_run, active_run,
    atomic_json, coordination_paths, encode_json, finish_run, release_run, require_owner, state_lock)
from test_discovery_workflow import event

SCRIPTS = Path(__file__).resolve().parents[1] / "scripts"
sys.path.insert(0, str(SCRIPTS))
import discovery_queue
import discovery_run


class BacklogTest(unittest.TestCase):
    def test_backlog_boundaries_and_accumulation_round_trip_without_rediscovery(self):
        for count in (999, 1000, 1001):
            with self.subTest(count=count), tempfile.TemporaryDirectory() as tmp:
                leads = [{"discovery_url": f"https://new.example/{i}"} for i in range(count)]
                first, checkpoint = build_queue({"events": []}, {}, {}, leads)
                path = Path(tmp) / "state.json"
                atomic_json(path, checkpoint)
                second, after = build_queue({"events": []}, {}, {}, [], read_json(path))
                self.assertEqual(len(after["backlog"]), count)
                self.assertEqual(len(first["selected"]), 20)
                self.assertEqual(len(second["selected"]), 20)
                self.assertEqual(len(second["deferred"]), count - 20)
                _, accumulated = build_queue({"events": []}, {}, {},
                    [{"discovery_url": "https://new.example/next"}], after)
                self.assertEqual(len(accumulated["backlog"]), count + 1)
                self.assertEqual(len({r["discovery_url"] for r in accumulated["backlog"]}), count + 1)

    def test_malformed_backlog_rows_fail_explicitly(self):
        for backlog in ("bad", [None], [{}], [{"discovery_url": "bad"}]):
            with self.subTest(backlog=backlog), self.assertRaises(BundleError):
                build_queue({"events": []}, {}, {}, [],
                    {"recheck_cursor": 0, "fresh_cursor": 0, "backlog": backlog})

    def test_byte_budget_counts_utf8_indentation_and_newline(self):
        value = {"text": "서울"}
        size = len((json.dumps(value, ensure_ascii=False, indent=2) + "\n").encode("utf-8"))
        with patch("crawler.discovery.queue_state.JSON_LIMIT", size):
            self.assertEqual(len(encode_json(value)), size)
        with patch("crawler.discovery.queue_state.JSON_LIMIT", size - 1), self.assertRaises(BundleError):
            encode_json(value)


class OwnershipTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name)
        self.state = self.root / "state.json"

    def test_owner_survives_process_exit_and_requires_exact_release(self):
        result = subprocess.run([sys.executable, str(SCRIPTS / "discovery_run.py"),
            "acquire", "--state", str(self.state)], capture_output=True, text=True, check=True)
        owner = json.loads(result.stdout)["run_id"]
        self.assertEqual(active_run(self.state)["run_id"], owner)
        with self.assertRaises(AlreadyRunning):
            acquire_run(self.state)
        with self.assertRaises(AlreadyRunning):
            require_owner(self.state, None)
        with self.assertRaises(ValueError):
            release_run(self.state, "wrong")
        require_owner(self.state, owner)
        release_run(self.state, owner)
        with self.assertRaises(ValueError):
            require_owner(self.state, owner)
        self.assertNotEqual(acquire_run(self.state)["run_id"], owner)

    def test_two_processes_acquire_only_one_owner(self):
        command = [sys.executable, str(SCRIPTS / "discovery_run.py"), "acquire", "--state", str(self.state)]
        processes = [subprocess.Popen(command, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True) for _ in range(2)]
        results = []
        for proc in processes:
            stdout, stderr = proc.communicate(timeout=10)
            self.assertEqual(proc.returncode, 0, stderr)
            results.append(json.loads(stdout))
        self.assertEqual(sorted(r["status"] for r in results), ["acquired", "skipped-already-running"])
        owner = next(r["run_id"] for r in results if r["status"] == "acquired")
        self.assertEqual(active_run(self.state)["run_id"], owner)

    def test_malformed_marker_fails_closed(self):
        coordination_paths(self.state)[2].write_text('{"run_id": "bad"}')
        with self.assertRaises(BundleError):
            acquire_run(self.state)

    def test_release_cli_requires_token(self):
        with contextlib.redirect_stderr(io.StringIO()), self.assertRaises(SystemExit):
            discovery_run.main(["release", "--state", str(self.state)])

    def execute_cli(self, token, command):
        return subprocess.run([sys.executable, str(SCRIPTS / "discovery_run.py"), "execute",
            "--state", str(self.state), "--run-id", token, "--outcome", str(self.root / "outcome.json"),
            "--command", *command], capture_output=True, text=True, timeout=10)

    def test_real_command_success_and_failure_both_release_exact_owner(self):
        self.state.write_text('{"checkpoint": "keep"}')
        for code in (0, 1, 7):
            with self.subTest(code=code):
                token = acquire_run(self.state)["run_id"]
                result = self.execute_cli(token, [sys.executable, "-c", f"raise SystemExit({code})"])
                self.assertEqual(result.returncode, 0 if code == 0 else 1, result.stderr)
                report = json.loads(result.stdout)
                self.assertEqual(report["ownership"], "released")
                self.assertEqual(report["status"], "completed" if code == 0 else "failed")
                self.assertIsNone(active_run(self.state))
                self.assertEqual(read_json(self.root / "outcome.json")["details"]["returncode"], code)
                self.assertEqual(self.state.read_text(), '{"checkpoint": "keep"}')

    def test_command_start_failure_also_releases(self):
        token = acquire_run(self.state)["run_id"]
        result = self.execute_cli(token, [str(self.root / "nonexistent")])
        self.assertEqual(result.returncode, 1)
        self.assertIsNone(active_run(self.state))
        self.assertIn("start_error", read_json(self.root / "outcome.json")["details"])

    def test_wrong_owner_cannot_start_command_or_release(self):
        token = acquire_run(self.state)["run_id"]
        result = self.execute_cli("wrong", [sys.executable, "-c", "raise SystemExit(0)"])
        self.assertEqual(result.returncode, 1)
        self.assertEqual(active_run(self.state)["run_id"], token)
        self.assertFalse((self.root / "outcome.json").exists())

    def test_signalled_child_retains_uncertain_owner(self):
        token = acquire_run(self.state)["run_id"]
        result = self.execute_cli(token, [sys.executable, "-c",
            "import os, signal; os.kill(os.getpid(), signal.SIGTERM)"])
        self.assertEqual(result.returncode, 1)
        self.assertEqual(active_run(self.state)["run_id"], token)
        self.assertEqual(read_json(self.root / "outcome.json")["status"], "interrupted")

    def test_wrapper_interruption_retains_owner(self):
        token = acquire_run(self.state)["run_id"]
        with patch.object(discovery_run.subprocess, "run", side_effect=KeyboardInterrupt), self.assertRaises(KeyboardInterrupt):
            discovery_run.execute_owned(self.state, token, self.root / "outcome.json", ["command"])
        self.assertEqual(active_run(self.state)["run_id"], token)

    def test_outcome_save_failure_cannot_strand_stopped_run(self):
        token = acquire_run(self.state)["run_id"]
        with patch("crawler.discovery.queue_state.atomic_json", side_effect=OSError("disk full")):
            result = finish_run(self.state, token, self.root / "outcome.json", "failed")
        self.assertIsNone(active_run(self.state))
        self.assertFalse(result["outcome_saved"])
        self.assertEqual(result["ownership"], "released")
        self.assertIn("disk full", result["outcome_error"])

    def test_finish_early_failed_stage_releases_and_retains_failure(self):
        token = acquire_run(self.state)["run_id"]
        with contextlib.redirect_stdout(io.StringIO()):
            code = discovery_run.main(["finish", "--state", str(self.state), "--run-id", token,
                "--outcome", str(self.root / "outcome.json"), "--status", "failed", "--error", "queue invalid"])
        self.assertEqual(code, 0)
        self.assertIsNone(active_run(self.state))
        report = read_json(self.root / "outcome.json")
        self.assertEqual((report["status"], report["details"]["error"]), ("failed", "queue invalid"))

    def test_outcome_alias_rejected_before_command_runs(self):
        token = acquire_run(self.state)["run_id"]
        for path in coordination_paths(self.state):
            with self.subTest(path=path), patch.object(discovery_run.subprocess, "run") as command, self.assertRaises(ValueError):
                discovery_run.execute_owned(self.state, token, path, ["command"])
            command.assert_not_called()
        self.assertEqual(active_run(self.state)["run_id"], token)


class QueueTransactionTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name)
        self.repo = self.root / "repo"
        self.repo.mkdir()
        def git(*args):
            subprocess.run(["git", *args], cwd=self.repo, capture_output=True, check=True)
        git("init", "-b", "main")
        git("config", "user.name", "Test")
        git("config", "user.email", "test@example.com")
        catalog = self.repo / "server/data/events.json"
        catalog.parent.mkdir(parents=True)
        catalog.write_text(json.dumps({"count": 1, "events": [event(source="namu")]}))
        git("add", ".")
        git("commit", "-m", "fixture")
        git("update-ref", "refs/remotes/origin/main", "HEAD")
        self.state, self.output, self.feed = [self.root / n for n in ("state.json", "queue.json", "search.json")]
        self.write_feed("first")
        self.args = ["--catalog-root", str(self.repo), "--state", str(self.state),
                     "--output", str(self.output), "--discovery-input", str(self.feed)]

    def write_feed(self, name):
        self.feed.write_text(json.dumps({"generated_at": date.today().isoformat(),
            "keywords": {"kids": [{"url": "https://new.example/" + name}]}}))

    def invoke(self, args=None):
        with contextlib.redirect_stdout(io.StringIO()) as out:
            self.assertEqual(discovery_queue.main(self.args if args is None else args), 0)
        return json.loads(out.getvalue())

    def test_sequential_independent_searches_preserve_both_leads(self):
        self.invoke()
        self.write_feed("second")
        self.invoke()
        self.assertEqual({r["discovery_url"] for r in read_json(self.state)["backlog"]},
            {"https://new.example/first", "https://new.example/second"})

    def test_real_process_contention_skips_without_touching_files(self):
        self.invoke()
        before = (self.state.read_bytes(), self.output.read_bytes())
        code = ("import sys; from pathlib import Path; "
                "from crawler.discovery.queue_state import state_lock; "
                "\nwith state_lock(Path(sys.argv[1])):\n print('locked', flush=True); sys.stdin.read(1)\n")
        proc = subprocess.Popen([sys.executable, "-c", code, str(self.state)], cwd=SCRIPTS.parent,
            stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True,
            env={**os.environ, "PYTHONDONTWRITEBYTECODE": "1"})
        try:
            self.assertEqual(proc.stdout.readline().strip(), "locked")
            self.assertEqual(self.invoke()["status"], "skipped-already-running")
            self.assertEqual((self.state.read_bytes(), self.output.read_bytes()), before)
        finally:
            proc.communicate(input="x", timeout=10)
        self.assertEqual(self.invoke()["status"], "prepared")

    def test_queue_requires_active_token_and_rejects_stale_tokens(self):
        token = acquire_run(self.state)["run_id"]
        self.assertEqual(self.invoke()["status"], "skipped-already-running")
        self.assertFalse(self.state.exists())
        with self.assertRaises(ValueError):
            self.invoke(self.args + ["--run-id", "wrong"])
        self.assertEqual(self.invoke(self.args + ["--run-id", token])["status"], "prepared")
        release_run(self.state, token)
        with self.assertRaises(ValueError):
            self.invoke(self.args + ["--run-id", token])

    def test_capacity_rejection_preserves_checkpoint_queue_and_feed(self):
        self.invoke()
        before = [p.read_bytes() for p in (self.state, self.output, self.feed)]
        # Permit the queue bytes but reject the checkpoint on the second preflight.
        real_encode = encode_json
        def encode(value):
            if "backlog" in value:
                raise BundleError("capacity")
            return real_encode(value)
        with patch.object(discovery_queue, "encode_json", side_effect=encode), self.assertRaises(BundleError):
            self.invoke()
        self.assertEqual([p.read_bytes() for p in (self.state, self.output, self.feed)], before)
        with patch("crawler.discovery.queue_state.JSON_LIMIT", 1), self.assertRaises(BundleError):
            self.invoke()
        self.assertEqual([p.read_bytes() for p in (self.state, self.output, self.feed)], before)

    def test_reserved_and_symlink_aliases_are_rejected_before_writes(self):
        self.invoke()
        before = [p.read_bytes() for p in (self.state, self.output, self.feed)]
        for reserved in (*coordination_paths(self.state), self.feed):
            with self.subTest(reserved=reserved), self.assertRaises(ValueError):
                self.invoke(self.args + ["--output", str(reserved)])
        for reserved in coordination_paths(self.state):
            with self.subTest(input=reserved), self.assertRaises(ValueError):
                self.invoke(self.args + ["--discovery-input", str(reserved)])
        alias = self.root / "alias"
        alias.symlink_to(coordination_paths(self.state)[1])
        with self.assertRaises(ValueError):
            self.invoke(self.args + ["--output", str(alias)])
        with self.assertRaises(ValueError):
            self.invoke(self.args + ["--output", str(self.feed)])
        self.assertEqual([p.read_bytes() for p in (self.state, self.output, self.feed)], before)

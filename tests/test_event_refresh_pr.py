import argparse
import importlib.util
import json
import subprocess
import tempfile
import unittest
from datetime import date
from pathlib import Path
from unittest.mock import patch

SPEC = importlib.util.spec_from_file_location("event_refresh_pr", Path(__file__).resolve().parents[1] / "scripts/event_refresh_pr.py")
runner = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(runner)


class RunnerTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name)
        self.repo = self.root / "source"
        self.repo.mkdir()
        self.git("init", "-b", "main")
        self.git("config", "user.name", "Test")
        self.git("config", "user.email", "test@example.com")
        (self.repo / "server/data").mkdir(parents=True)
        (self.repo / "server/data/events.json").write_text('{"count": 1, "events": [{"id":"one"}]}\n')
        # A local fixture refresh process, to test actual Git isolation without network crawls.
        (self.repo / "refresh_places.py").write_text(
            'import json\nfrom pathlib import Path\np=Path("server/data/events.json")\n'
            'd=json.loads(p.read_text())\nd["events"][0]["title"]="Refreshed"\n'
            'p.write_text(json.dumps(d,indent=2)+"\\n")\n')
        self.git("add", ".")
        self.git("commit", "-m", "fixture")
        self.feeder = self.root / "feeder.json"
        self.feeder.write_text(json.dumps({"generated_at": date.today().isoformat(), "keywords": {"kids": []}}))
        self.args = argparse.Namespace(repository=str(self.repo), github_repo="owner/repo",
            discovery_input=self.feeder, discovery_max_age_days=8, state_dir=self.root / "runs", submit=False)

    def git(self, *args):
        return subprocess.check_output(["git", *args], cwd=self.repo, text=True, stderr=subprocess.DEVNULL).strip()

    def test_dry_run_uses_committed_main_and_preserves_dirty_source(self):
        baseline = self.git("rev-parse", "HEAD")
        original = (self.repo / "server/data/events.json").read_text()
        (self.repo / "developer-work.txt").write_text("KEEP")
        result = runner.execute(self.args)
        self.assertEqual(result["status"], "dry-run")
        self.assertEqual(result["baseline"], baseline)
        self.assertEqual(result["paths"], [runner.CATALOG])
        self.assertEqual((self.repo / "server/data/events.json").read_text(), original)
        self.assertEqual((self.repo / "developer-work.txt").read_text(), "KEEP")
        self.assertFalse((Path(result["checkout"]) / "developer-work.txt").exists())

    def test_noop_creates_no_pr(self):
        (self.repo / "refresh_places.py").write_text("print('no changes')\n")
        self.git("add", "."); self.git("commit", "-m", "no-op fixture")
        self.assertEqual(runner.execute(self.args)["status"], "no-changes")

    def test_open_automation_pr_skips_cloning(self):
        self.args.submit = True
        def fake_run(args, cwd=None):
            if args[:3] == ["gh", "auth", "status"]:
                return "authenticated"
            if args[:3] == ["gh", "pr", "list"]:
                return json.dumps([{"headRefName": runner.BRANCH_PREFIX + "old", "url": "https://example.com/pr/1"}])
            self.fail("No Git operation expected when PR is already open")
        with patch.object(runner.shutil, "which", return_value="/mock/executable"), patch.object(runner, "run", side_effect=fake_run):
            self.assertEqual(runner.execute(self.args)["status"], "skipped-open-pr")

    def test_submit_pushes_only_allowlisted_diff_and_uses_body_file(self):
        self.args.submit = True
        real_run = runner.run
        calls = []
        def routed(args, cwd=None):
            calls.append(args)
            if args[0] == "gh":
                if args[1:3] == ["pr", "list"]:
                    return "[]"
                if args[1:3] == ["pr", "create"]:
                    body = Path(args[args.index("--body-file") + 1]).read_text()
                    self.assertIn("DB import is a separate manual step", body)
                    self.assertIn("--base", args)
                    return "https://example.com/pr/2"
                return "authenticated"
            return real_run(args, cwd)
        with patch.object(runner.shutil, "which", return_value="/mock/executable"), patch.object(runner, "run", side_effect=routed):
            result = runner.execute(self.args)
        self.assertEqual(result["status"], "pr-created")
        staged = next(args for args in calls if args[:2] == ["git", "add"])
        self.assertEqual(staged, ["git", "add", "--", runner.CATALOG])
        self.assertFalse(any("--force" in args for args in calls))

    def test_advancing_main_aborts_before_push_or_pr(self):
        self.args.submit = True
        real_run = runner.run
        def routed(args, cwd=None):
            if args[0] == "gh":
                return "[]" if args[1:3] == ["pr", "list"] else "authenticated"
            output = real_run(args, cwd)
            if str(args[0]) == str(runner.sys.executable):
                (self.repo / "advance.txt").write_text("new main")
                self.git("add", "."); self.git("commit", "-m", "main advanced")
            return output
        with patch.object(runner.shutil, "which", return_value="/mock/executable"), patch.object(runner, "run", side_effect=routed):
            with self.assertRaisesRegex(RuntimeError, "main advanced"):
                runner.execute(self.args)

    def test_failed_refresh_and_unexpected_path_cannot_be_submitted(self):
        (self.repo / "refresh_places.py").write_text("raise RuntimeError('mock outage')\n")
        self.git("add", "."); self.git("commit", "-m", "failure fixture")
        with self.assertRaisesRegex(RuntimeError, "mock outage"):
            runner.execute(self.args)
        (self.repo / "refresh_places.py").write_text('from pathlib import Path\nPath("unexpected.txt").write_text("bad")\n')
        self.git("add", "."); self.git("commit", "-m", "unsafe fixture")
        with self.assertRaisesRegex(RuntimeError, "unexpected paths"):
            runner.execute(self.args)

    def test_lock_rejects_overlap(self):
        with runner.lock(self.args.state_dir):
            with self.assertRaisesRegex(RuntimeError, "another event refresh"):
                with runner.lock(self.args.state_dir):
                    pass

    def test_missing_gh_is_an_explicit_prerequisite_failure(self):
        self.args.submit = True
        with patch.object(runner.shutil, "which", side_effect=lambda tool: "/mock/git" if tool == "git" else None):
            with self.assertRaisesRegex(RuntimeError, "GitHub CLI gh is required"):
                runner.execute(self.args)
        self.assertFalse(self.args.state_dir.exists())

    def test_extraction_artifact_allowlist_does_not_allow_raw_source_documents(self):
        for name in ('data/discovery/identities.json', 'data/discovery/reports/extraction-test.json'):
            self.assertTrue(runner.allowed(name))
        for name in ('data/discovery/documents/source.txt', 'data/discovery/reports/extraction-test.json/../../secret',
                     'data/discovery/reports/extraction-test.json.txt', 'crawler/prompts/discovery-extraction.md'):
            self.assertFalse(runner.allowed(name))

    def test_push_and_pr_api_failures_preserve_main_and_do_not_claim_success(self):
        self.args.submit = True
        baseline = self.git("rev-parse", "main")
        real_run = runner.run
        for failure in ("push", "pr-create"):
            calls = []
            def routed(args, cwd=None):
                calls.append(args)
                if args[0] == "gh":
                    if args[1:3] == ["pr", "list"]:
                        return "[]"
                    if args[1:3] == ["pr", "create"]:
                        raise RuntimeError("mock pr-create failure")
                    return "authenticated"
                if args[:2] == ["git", "push"] and failure == "push":
                    raise RuntimeError("mock push failure")
                return real_run(args, cwd)
            with self.subTest(failure=failure), patch.object(runner.shutil, "which", return_value="/mock/executable"), patch.object(runner, "run", side_effect=routed):
                with self.assertRaisesRegex(RuntimeError, f"mock {failure} failure"):
                    runner.execute(self.args)
            self.assertEqual(self.git("rev-parse", "main"), baseline)
            if failure == "push":
                self.assertFalse(any(args[:3] == ["gh", "pr", "create"] for args in calls))

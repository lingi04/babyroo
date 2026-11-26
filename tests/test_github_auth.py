import contextlib
import io
import json
import os
import subprocess
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

import check_github_auth
import event_refresh_pr
import github_repo
from crawler.discovery.github_auth import github_env, github_repository, github_url


class GithubAuthTest(unittest.TestCase):
    def test_explicit_profile_token_is_bridged_without_mutating_process(self):
        with patch.dict(os.environ, {"BABYROO_GITHUB_TOKEN": "profile-token", "GH_TOKEN": "launch-token"}, clear=True):
            env = github_env()
            self.assertEqual(env["GH_TOKEN"], "profile-token")
            self.assertEqual(os.environ["GH_TOKEN"], "launch-token")

    def test_stored_login_or_inherited_token_still_supported(self):
        with patch.dict(os.environ, {}, clear=True):
            self.assertNotIn("GH_TOKEN", github_env())
        with patch.dict(os.environ, {"GH_TOKEN": "existing-token"}, clear=True):
            self.assertEqual(github_env()["GH_TOKEN"], "existing-token")

    def test_runner_uses_same_bridge_for_gh_and_git(self):
        response = subprocess.CompletedProcess([], 0, stdout="ok", stderr="")
        with patch.dict(os.environ, {"BABYROO_GITHUB_TOKEN": "profile-token"}, clear=True), patch.object(
                event_refresh_pr.subprocess, "run", return_value=response) as command:
            event_refresh_pr._run(["gh", "auth", "status"])
            self.assertEqual(command.call_args.kwargs["env"]["GH_TOKEN"], "profile-token")
            event_refresh_pr._run(["git", "status"])
            self.assertEqual(command.call_args.kwargs["env"]["GH_TOKEN"], "profile-token")

    def test_preflight_checks_auth_and_pr_access_without_logging_token(self):
        response = subprocess.CompletedProcess([], 0)
        out = io.StringIO()
        with patch.dict(os.environ, {"BABYROO_GITHUB_TOKEN": "private-test-token"}), patch.object(
                check_github_auth.shutil, "which", return_value="/usr/bin/gh"), patch.object(
                check_github_auth.subprocess, "run", return_value=response) as command, contextlib.redirect_stdout(out):
            self.assertEqual(check_github_auth.main([]), 0)
        self.assertEqual(command.call_count, 2)
        self.assertEqual(command.call_args.kwargs["env"]["GH_TOKEN"], "private-test-token")
        self.assertEqual(json.loads(out.getvalue())["status"], "ready")
        self.assertNotIn("private-test-token", out.getvalue())

    def test_preflight_failure_never_echoes_raw_diagnostic_secrets(self):
        response = subprocess.CompletedProcess([], 1, stderr=b"private-test-token")
        err = io.StringIO()
        with patch.object(check_github_auth.shutil, "which", return_value="/usr/bin/gh"), patch.object(
                check_github_auth.subprocess, "run", return_value=response), contextlib.redirect_stderr(err):
            self.assertEqual(check_github_auth.main([]), 1)
        self.assertNotIn("private-test-token", err.getvalue())

    def test_runner_redacts_tokens_from_failed_command_output(self):
        response = subprocess.CompletedProcess([], 1, stdout="", stderr="bad private-test-token")
        with patch.dict(os.environ, {"BABYROO_GITHUB_TOKEN": "private-test-token"}), patch.object(
                event_refresh_pr.subprocess, "run", return_value=response), self.assertRaises(RuntimeError) as failure:
            event_refresh_pr._run(["gh", "auth", "status"])
        self.assertNotIn("private-test-token", str(failure.exception))
        self.assertIn("[REDACTED]", str(failure.exception))

    def test_github_inputs_use_https_and_reject_foreign_or_credential_urls(self):
        for value in ("lingi04/babyroo", "https://github.com/lingi04/babyroo.git",
                      "git@github.com:lingi04/babyroo.git", "ssh://git@github.com/lingi04/babyroo.git"):
            self.assertEqual(github_url(value), "https://github.com/lingi04/babyroo.git")
        for value in ("https://evil.example/owner/repo", "https://token@github.com/owner/repo", "owner/repo/extra"):
            with self.assertRaises(ValueError):
                github_repository(value)

    def test_real_git_resolves_legacy_remote_and_uses_gh_credential_helper(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            gh = root / "gh"
            gh.write_text('#!/usr/bin/env python3\nimport os,sys\n'
                'assert sys.argv[1:3] == ["auth", "git-credential"]\n'
                'sys.stdin.read()\n'
                'print("username=x-access-token\\npassword=" + os.environ["GH_TOKEN"])\n')
            gh.chmod(0o700)
            with patch.dict(os.environ, {"BABYROO_GITHUB_TOKEN": "fake-test-token"}):
                env = github_env()
            env.update(PATH=str(root) + os.pathsep + env["PATH"],
                       GIT_CONFIG_GLOBAL=str(root / "empty-config"), GIT_CONFIG_NOSYSTEM="1")
            url = subprocess.check_output(["git", "ls-remote", "--get-url", "git@github.com:lingi04/babyroo.git"],
                                          env=env, text=True).strip()
            self.assertEqual(url, "https://github.com/lingi04/babyroo.git")
            result = subprocess.run(["git", "credential", "fill"], env=env, text=True, capture_output=True,
                input="protocol=https\nhost=github.com\n\n", check=True)
            self.assertIn("password=fake-test-token", result.stdout)
            self.assertFalse((root / "empty-config").exists())

    def test_remote_clone_is_gh_with_explicit_https(self):
        with patch.object(event_refresh_pr.shutil, "which", return_value="/usr/bin/gh"), patch.object(
                event_refresh_pr, "run") as command:
            event_refresh_pr.clone_repository("lingi04/babyroo", Path("/tmp/new-checkout"))
        args = command.call_args.args[0]
        self.assertEqual(args[:4], ["gh", "repo", "clone", "https://github.com/lingi04/babyroo.git"])
        self.assertIn("--branch", args)
        self.assertNotIn("git@github.com", str(args))

    def test_failed_gh_clone_has_no_ssh_or_git_clone_fallback(self):
        with patch.object(event_refresh_pr.shutil, "which", return_value="/usr/bin/gh"), patch.object(
                event_refresh_pr, "run", side_effect=RuntimeError("authentication failed")) as command:
            with self.assertRaisesRegex(RuntimeError, "authentication failed"):
                event_refresh_pr.clone_repository("lingi04/babyroo", Path("/tmp/new-checkout"))
        self.assertEqual(command.call_count, 1)
        self.assertEqual(command.call_args.args[0][:3], ["gh", "repo", "clone"])

    def test_command_scoped_git_config_preserves_existing_entries(self):
        with patch.dict(os.environ, {"GIT_CONFIG_COUNT": "1", "GIT_CONFIG_KEY_0": "core.quotePath",
                                     "GIT_CONFIG_VALUE_0": "false"}):
            env = github_env()
        self.assertEqual(env["GIT_CONFIG_KEY_0"], "core.quotePath")
        self.assertEqual(env["GIT_CONFIG_VALUE_0"], "false")
        self.assertGreater(int(env["GIT_CONFIG_COUNT"]), 1)
        self.assertEqual(env["GIT_SSH_COMMAND"], "false")

    def test_pull_refuses_dirty_or_wrong_branch_without_network_or_remote_change(self):
        for values in (["feature/test"], ["main", " M file"]):
            with patch.object(github_repo, "run", side_effect=values) as command, self.assertRaises(ValueError):
                github_repo.pull_main("/tmp/repo", "lingi04/babyroo")
            self.assertFalse(any("pull" in c.args[0] or "set-url" in c.args[0] for c in command.call_args_list))

    def test_pull_converts_verified_origin_to_https_and_fast_forwards(self):
        with patch.object(github_repo, "run", side_effect=["main", "", "git@github.com:lingi04/babyroo.git", "", "", "sha"]) as command:
            result = github_repo.pull_main("/tmp/repo", "lingi04/babyroo")
        self.assertEqual(result["status"], "updated")
        self.assertIn(["git", "remote", "set-url", "origin", "https://github.com/lingi04/babyroo.git"],
                      [c.args[0] for c in command.call_args_list])
        self.assertIn(["git", "pull", "--ff-only", "origin", "main"], [c.args[0] for c in command.call_args_list])

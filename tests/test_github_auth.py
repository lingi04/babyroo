import contextlib
import io
import json
import os
import subprocess
import unittest
from unittest.mock import patch

import check_github_auth
import event_refresh_pr
from crawler.discovery.github_auth import github_env


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

    def test_runner_uses_same_bridge_only_for_gh(self):
        response = subprocess.CompletedProcess([], 0, stdout="ok", stderr="")
        with patch.dict(os.environ, {"BABYROO_GITHUB_TOKEN": "profile-token"}, clear=True), patch.object(
                event_refresh_pr.subprocess, "run", return_value=response) as command:
            event_refresh_pr._run(["gh", "auth", "status"])
            self.assertEqual(command.call_args.kwargs["env"]["GH_TOKEN"], "profile-token")
            event_refresh_pr._run(["git", "status"])
            self.assertNotIn("GH_TOKEN", command.call_args.kwargs["env"])

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

#!/usr/bin/env python3
"""Run on Mac/Hermes: latest main -> isolated branch -> refresh -> optional PR.

Default mode makes only local changes. --submit enables commit/push/PR creation.
There is no merge, DB connection or import step.
"""
from __future__ import annotations

import argparse
import fcntl
import json
import os
import shutil
import subprocess
import sys
import tempfile
import uuid
from contextlib import contextmanager
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from crawler.babyroo_crawler.timing import timed_step

BRANCH_PREFIX = "automation/event-refresh/"
CATALOG = "server/data/events.json"
REVIEW = "data/discovery/review.json"


def run(args, cwd=None):
    executable = Path(str(args[0])).name
    if executable == "git":
        name = "git." + next((str(a) for a in args[1:] if str(a) in {
            "clone", "rev-parse", "checkout", "fetch", "diff", "ls-files", "add", "commit", "push"}), "command")
    elif executable == "gh":
        name = ".".join(str(a) for a in args[:3])
    else:
        name = "catalog.refresh"
    with timed_step(name):
        return _run(args, cwd)


def _run(args, cwd=None):
    result = subprocess.run([str(a) for a in args], cwd=cwd, text=True,
                            stdout=subprocess.PIPE, stderr=subprocess.PIPE,
                            stdin=subprocess.DEVNULL, timeout=1800,
                            env={**os.environ, "GIT_TERMINAL_PROMPT": "0", "GH_PROMPT_DISABLED": "1"})
    for line in result.stderr.splitlines():
        if line.startswith("[TIMING] "):
            print(line, file=sys.stderr, flush=True)
    if result.returncode:
        # Avoid echoing command arguments (which may contain private repository URLs).
        raise RuntimeError(f"{Path(str(args[0])).name} failed (exit {result.returncode}): {(result.stderr or result.stdout).strip()}")
    return result.stdout.strip()


@contextmanager
def lock(state_dir: Path):
    state_dir.mkdir(parents=True, exist_ok=True)
    with (state_dir / "runner.lock").open("a+") as stream:
        try:
            fcntl.flock(stream, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            raise RuntimeError("another event refresh is running in this state directory")
        try:
            yield
        finally:
            fcntl.flock(stream, fcntl.LOCK_UN)


def allowed(path: str) -> bool:
    return path in (CATALOG, REVIEW, "data/discovery/identities.json") or (
        path.startswith("data/discovery/reports/refresh-") and path.endswith(".md")
        and "/" not in path[len("data/discovery/reports/"):]) or (
        path.startswith("data/discovery/reports/extraction-") and path.endswith(".json")
        and "/" not in path[len("data/discovery/reports/"):]) or (
        path.startswith("data/discovery/reports/refresh-") and path.endswith(".sql")
        and "/" not in path[len("data/discovery/reports/"):])


def changed_files(checkout: Path) -> list[str]:
    tracked = run(["git", "diff", "--name-only", "-z", "HEAD"], cwd=checkout)
    untracked = run(["git", "ls-files", "--others", "--exclude-standard", "-z"], cwd=checkout)
    paths = sorted(set(filter(None, (tracked + "\0" + untracked).split("\0"))))
    if any(not allowed(path) for path in paths):
        raise RuntimeError("refresh changed unexpected paths; refusing to stage")
    return paths


def ensure_main_unchanged(checkout: Path, baseline_sha: str):
    run(["git", "fetch", "origin", "main"], cwd=checkout)
    if run(["git", "rev-parse", "origin/main"], cwd=checkout) != baseline_sha:
        raise RuntimeError("origin/main advanced during refresh; rerun against its new baseline")


def execute(args) -> dict:
    if not shutil.which("git"):
        raise RuntimeError("git is required on PATH")
    if args.submit and not shutil.which("gh"):
        raise RuntimeError("GitHub CLI gh is required for --submit; install and run gh auth login")
    if args.submit and not args.github_repo:
        raise ValueError("--github-repo OWNER/REPO is required for --submit")
    feeder = args.discovery_input.expanduser().resolve()
    # Validate feeder before cloning or any GitHub mutations.
    project = Path(__file__).resolve().parents[1]
    sys.path.insert(0, str(project))
    from crawler.discovery.google_alerts import sample
    sample(feeder, args.discovery_max_age_days)
    with lock(args.state_dir):
        if args.submit:
            run(["gh", "auth", "status"])
            prs = json.loads(run(["gh", "pr", "list", "--repo", args.github_repo,
                                  "--state", "open", "--json", "number,headRefName,url"]))
            for pr in prs:
                if pr["headRefName"].startswith(BRANCH_PREFIX):
                    return {"status": "skipped-open-pr", "url": pr["url"]}
        directory = Path(tempfile.mkdtemp(prefix="run-", dir=args.state_dir))
        checkout = directory / "repo"
        run(["git", "clone", "--depth", "1", "--single-branch", "--branch", "main",
             "--", args.repository, checkout])
        baseline_sha = run(["git", "rev-parse", "HEAD"], cwd=checkout)
        stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
        branch = BRANCH_PREFIX + stamp + "-" + uuid.uuid4().hex[:8]
        run(["git", "checkout", "-b", branch], cwd=checkout)
        print(f"Isolated checkout: {checkout}; baseline main: {baseline_sha}")
        # Invoke code from the checked-out main, not from a developer's dirty tree.
        output = run([sys.executable, checkout / "refresh_places.py", "--discovery-input", feeder,
                      "--discovery-max-age-days", args.discovery_max_age_days], cwd=checkout)
        paths = changed_files(checkout)
        if not paths:
            return {"status": "no-changes", "checkout": str(checkout), "baseline": baseline_sha}
        run(["git", "diff", "--check"], cwd=checkout)
        if not args.submit:
            return {"status": "dry-run", "checkout": str(checkout), "branch": branch,
                    "baseline": baseline_sha, "paths": paths, "refresh": output}
        ensure_main_unchanged(checkout, baseline_sha)
        run(["git", "add", "--", *paths], cwd=checkout)
        run(["git", "-c", "user.name=Babyroo Refresh", "-c",
             "user.email=babyroo-refresh@users.noreply.github.com", "commit", "-m",
             "data: refresh event catalog and discovery review"], cwd=checkout)
        run(["git", "push", "origin", f"HEAD:refs/heads/{branch}"], cwd=checkout)
        ensure_main_unchanged(checkout, baseline_sha)
        body = directory / "pr-body.md"
        reports = [p for p in paths if p.startswith("data/discovery/reports/")]
        body.write_text(
            f"Refresh against main `{baseline_sha}`.\n\n"
            "Review the event diff and discovery report before merging. Non-expired missing events were retained; "
            "ended events were excluded from the catalog and preserved in review history.\n\n"
            + "\n".join(f"- {p}" for p in reports)
            + "\n\nRevalidate against main if it advances before merge.\n"
            "DB import is a separate manual step after merge; this job does not import or merge.\n",
            encoding="utf-8")
        url = run(["gh", "pr", "create", "--repo", args.github_repo, "--base", "main",
                   "--head", branch, "--title", "Refresh event catalog and discovery review",
                   "--body-file", body], cwd=checkout)
        return {"status": "pr-created", "url": url, "checkout": str(checkout), "baseline": baseline_sha}


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--repository", default="git@github.com:lingi04/babyroo.git")
    parser.add_argument("--github-repo", help="OWNER/REPO for GitHub CLI")
    parser.add_argument("--discovery-input", required=True, type=Path)
    parser.add_argument("--discovery-max-age-days", type=int, default=8)
    parser.add_argument("--state-dir", type=Path, default=Path.home() / ".cache/babyroo-refresh")
    parser.add_argument("--submit", action="store_true")
    args = parser.parse_args(argv)
    args.state_dir = args.state_dir.expanduser().resolve()
    try:
        print(json.dumps(execute(args), ensure_ascii=False))
        return 0
    except Exception as exc:
        print(f"[FAILED] {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())

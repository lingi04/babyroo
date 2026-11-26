#!/usr/bin/env python3
"""Read-only GitHub submission preflight in the actual Hermes tool environment."""
import argparse
import json
import shutil
import subprocess
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from crawler.discovery.github_auth import github_env


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--repo", default="lingi04/babyroo")
    args = parser.parse_args(argv)
    if not shutil.which("gh"):
        print("[FAILED] gh is not on the job's PATH", file=sys.stderr)
        return 1
    env = github_env()
    for label, command in (
        ("authentication", ["gh", "auth", "status", "--hostname", "github.com"]),
        ("pull-request access", ["gh", "pr", "list", "--repo", args.repo, "--limit", "1", "--json", "number"]),
    ):
        try:
            result = subprocess.run(command, env=env, stdin=subprocess.DEVNULL,
                                    stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=30)
        except (OSError, subprocess.TimeoutExpired):
            print(f"[FAILED] GitHub {label} check could not complete", file=sys.stderr)
            return 1
        if result.returncode:
            # Never echo credentials, raw environment, or gh diagnostic bodies.
            print(f"[FAILED] GitHub {label} check failed; verify profile token/login and repository permissions", file=sys.stderr)
            return 1
    print(json.dumps({"status": "ready", "repository": args.repo,
                      "profile_token_present": bool(env.get("BABYROO_GITHUB_TOKEN", "").strip())}))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

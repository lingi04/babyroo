#!/usr/bin/env python3
"""Clone/update a clean main checkout using the profile's gh HTTPS credentials."""
import argparse
import json
import shutil
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from crawler.discovery.github_auth import github_repository, github_url
from event_refresh_pr import clone_repository, run


def pull_main(checkout, repository):
    checkout = Path(checkout).expanduser().resolve()
    if run(["git", "branch", "--show-current"], cwd=checkout) != "main":
        raise ValueError("bootstrap checkout must be on main")
    if run(["git", "status", "--porcelain"], cwd=checkout):
        raise ValueError("bootstrap checkout must be clean; refusing to discard work")
    origin = run(["git", "remote", "get-url", "origin"], cwd=checkout)
    if github_repository(origin) != github_repository(repository):
        raise ValueError("origin does not match the requested GitHub repository")
    # Upgrade this checkout's origin only; account-wide config and SSH keys stay untouched.
    run(["git", "remote", "set-url", "origin", github_url(repository)], cwd=checkout)
    run(["git", "pull", "--ff-only", "origin", "main"], cwd=checkout)
    return {"status": "updated", "checkout": str(checkout),
            "baseline": run(["git", "rev-parse", "HEAD"], cwd=checkout)}


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("action", choices=("clone", "pull"))
    parser.add_argument("--repository", default="lingi04/babyroo")
    parser.add_argument("--checkout", required=True, type=Path)
    args = parser.parse_args(argv)
    try:
        if not shutil.which("gh") or not shutil.which("git"):
            raise RuntimeError("gh and git are required on PATH")
        repository = github_repository(args.repository)
        if args.action == "clone":
            clone_repository(repository, args.checkout.expanduser().resolve())
            result = {"status": "cloned", "checkout": str(args.checkout.expanduser().resolve())}
        else:
            result = pull_main(args.checkout, repository)
        print(json.dumps(result))
        return 0
    except Exception as exc:
        print(f"[FAILED] {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())

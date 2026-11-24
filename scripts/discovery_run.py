#!/usr/bin/env python3
"""Acquire/release persistent ownership for one complete Hermes discovery run."""
import argparse
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from crawler.discovery.queue_state import AlreadyRunning, acquire_run, release_run


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("action", choices=("acquire", "release"))
    parser.add_argument("--state", type=Path, required=True, help="Same external checkpoint used by discovery_queue.py")
    parser.add_argument("--run-id", help="Exact token returned by acquire; required for release")
    args = parser.parse_args(argv)
    if (args.action == "release") != (args.run_id is not None):
        parser.error("--run-id is required only for release")
    try:
        result = acquire_run(args.state) if args.action == "acquire" else release_run(args.state, args.run_id)
    except AlreadyRunning as exc:
        result = {"status": "skipped-already-running", "reason": str(exc)}
    except Exception as exc:
        print(f"[FAILED] {exc}", file=sys.stderr)
        return 1
    print(json.dumps(result))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

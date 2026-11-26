#!/usr/bin/env python3
"""Acquire/release persistent ownership for one complete Hermes discovery run."""
import argparse
import json
import subprocess
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from crawler.discovery.queue_state import (AlreadyRunning, acquire_run, finish_run,
    release_run, require_owner, state_lock, atomic_json, validate_outcome_path)


def execute_owned(state, run_id, outcome, command):
    outcome = validate_outcome_path(state, outcome)
    # Check before starting any command. A skipped/wrong-token run owns nothing.
    with state_lock(state):
        require_owner(state, run_id)
    try:
        code = subprocess.run(command, stdin=subprocess.DEVNULL).returncode
        details = {"returncode": code}
    except OSError as exc:
        # Failure to start the command is terminal too: no child is running.
        code, details = 1, {"start_error": str(exc)}
    if code < 0:
        # A signalled child may have orphaned grandchildren. Do not unlock until
        # the operator has checked the whole process tree.
        result = {"status": "interrupted", "run_id": run_id, "ownership": "retained", **details}
        atomic_json(outcome, result)
        return result, 1
    # Wrapper interruptions/forced termination do not reach here either.
    result = finish_run(state, run_id, outcome, "completed" if code == 0 else "failed", details)
    return result, 0 if code == 0 and result["outcome_saved"] else 1


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("action", choices=("acquire", "release", "finish", "execute"))
    parser.add_argument("--state", type=Path, required=True, help="Same external checkpoint used by discovery_queue.py")
    parser.add_argument("--run-id", help="Exact token returned by acquire; required except for acquire")
    parser.add_argument("--outcome", type=Path, help="External outcome JSON for finish/execute")
    parser.add_argument("--status", choices=("completed", "failed"), help="Known terminal status for finish")
    parser.add_argument("--error", help="Failure details for finish")
    parser.add_argument("--command", nargs=argparse.REMAINDER, help="Command and arguments; must be last")
    args = parser.parse_args(argv)
    if (args.action != "acquire") != (args.run_id is not None):
        parser.error("--run-id is required except for acquire")
    if (args.action in {"finish", "execute"}) != (args.outcome is not None):
        parser.error("--outcome is required only for finish/execute")
    if (args.action == "finish") != (args.status is not None):
        parser.error("--status is required only for finish")
    if (args.action == "execute") != bool(args.command):
        parser.error("--command is required only for execute")
    exit_code = 0
    try:
        if args.action == "acquire":
            result = acquire_run(args.state)
        elif args.action == "release":
            result = release_run(args.state, args.run_id)
        elif args.action == "finish":
            result = finish_run(args.state, args.run_id, args.outcome, args.status, {"error": args.error} if args.error else {})
            exit_code = 0 if result["outcome_saved"] else 1
        else:
            result, exit_code = execute_owned(args.state, args.run_id, args.outcome, args.command)
    except AlreadyRunning as exc:
        result = {"status": "skipped-already-running", "reason": str(exc)}
    except Exception as exc:
        print(f"[FAILED] {exc}", file=sys.stderr)
        return 1
    print(json.dumps(result))
    return exit_code


if __name__ == "__main__":
    raise SystemExit(main())

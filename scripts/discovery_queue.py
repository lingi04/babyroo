#!/usr/bin/env python3
"""Build a Hermes extraction queue from an explicitly selected clean-main checkout."""
import argparse
import hashlib
import json
import sys
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
sys.path.insert(0, str(ROOT / "crawler"))
from crawler.discovery.extraction_queue import build_queue
from crawler.discovery.google_alerts import sample
from crawler.discovery.extraction_schema import read_json
from crawler.discovery.queue_state import (AlreadyRunning, atomic_json, atomic_bytes,
                                           coordination_paths, encode_json, require_owner, state_lock)
from babyroo_crawler.discovery_workflow import SOURCES, validate_events


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--catalog-root", type=Path, required=True, help="Clean latest-main checkout; never a developer's dirty worktree")
    parser.add_argument("--discovery-input", type=Path, required=True)
    parser.add_argument("--state", type=Path, required=True, help="Local operational checkpoint outside Git")
    parser.add_argument("--output", type=Path, required=True, help="External batch queue file")
    parser.add_argument("--budget", type=int, default=20)
    parser.add_argument("--run-id", help="Token from discovery_run.py acquire for the active Hermes run")
    args = parser.parse_args(argv)
    args.state, lock_path, marker = coordination_paths(args.state)
    args.output = args.output.expanduser().resolve()
    args.discovery_input = args.discovery_input.expanduser().resolve()
    reserved = {args.state, lock_path.resolve(), marker.resolve()}
    if args.output in reserved or args.discovery_input in reserved or args.output == args.discovery_input:
        raise ValueError("queue input/output cannot alias checkpoint, lock, active marker or each other")
    def git(*values):
        return subprocess.check_output(["git", "-C", str(args.catalog_root), *values], text=True, stderr=subprocess.PIPE).strip()
    if git("rev-parse", "HEAD") != git("rev-parse", "origin/main"):
        raise ValueError("catalog checkout must be at fetched origin/main")
    if git("status", "--porcelain", "--", "server/data/events.json", "data/discovery/review.json", "data/discovery/identities.json"):
        raise ValueError("catalog/review/identity files must be clean before queue preparation")
    catalog = read_json(args.catalog_root / "server/data/events.json")
    validate_events(catalog["events"])
    if catalog.get("count") != len(catalog["events"]):
        raise ValueError("catalog count must match events")
    if args.catalog_root.resolve() in args.state.resolve().parents or args.catalog_root.resolve() in args.output.resolve().parents:
        raise ValueError("queue output and operational state must be outside the catalog checkout")
    base = args.catalog_root / "data/discovery"
    review = read_json(base / "review.json") if (base / "review.json").exists() else {}
    registry = read_json(base / "identities.json") if (base / "identities.json").exists() else {"entries": []}
    try:
        with state_lock(args.state):
            require_owner(args.state, args.run_id)
            operational = read_json(args.state) if args.state.exists() else None
            queue, checkpoint = build_queue(catalog, review, registry, sample(args.discovery_input)["candidates"],
                                            operational, args.budget, SOURCES)
            # Check the exact encoded bytes for BOTH files before installing either.
            encoded_queue, encoded_checkpoint = encode_json(queue), encode_json(checkpoint)
            atomic_bytes(args.output, encoded_queue)
            atomic_bytes(args.state, encoded_checkpoint)
            result = {"status": "prepared", "selected": len(queue["selected"]),
                      "deferred": len(queue["deferred"]), "backlog": len(checkpoint["backlog"]),
                      "output": str(args.output), "queue_sha256": hashlib.sha256(encoded_queue).hexdigest()}
    except AlreadyRunning as exc:
        result = {"status": "skipped-already-running", "reason": str(exc)}
    print(json.dumps(result))
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as exc:
        print(f"[FAILED] {exc}", file=sys.stderr)
        raise SystemExit(1)

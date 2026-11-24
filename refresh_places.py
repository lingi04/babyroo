#!/usr/bin/env python3
"""Refresh the approved catalog locally; never upload, import or merge."""
import argparse
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT / "crawler"))
from babyroo_crawler.discovery_workflow import refresh


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--discovery-input", type=Path, help="Fresh external feeder JSON; omit for native-only refresh")
    parser.add_argument("--discovery-max-age-days", type=int, default=8)
    args = parser.parse_args(argv)
    try:
        print(json.dumps(refresh(ROOT, args.discovery_input, args.discovery_max_age_days), ensure_ascii=False))
        return 0
    except Exception as exc:
        print(f"[FAILED] {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())

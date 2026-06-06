from __future__ import annotations

import argparse

from babyroo_crawler.pipeline import normalize_all, publish
from sources.manual_sample import collect as collect_manual_sample
from sources.seoul_culture import collect as collect_seoul_culture


def main() -> None:
    parser = argparse.ArgumentParser(description="Babyroo crawler pipeline")
    subparsers = parser.add_subparsers(dest="command", required=True)
    subparsers.add_parser("collect-sample", help="Write a sample raw event file")
    seoul_parser = subparsers.add_parser(
        "collect-seoul",
        help="Collect baby-relevant events from Seoul Culture Portal",
    )
    seoul_parser.add_argument("--pages", type=int, default=5)
    subparsers.add_parser("normalize", help="Normalize raw files into data/normalized/events.json")
    subparsers.add_parser("publish", help="Publish normalized events into public/events.json")
    subparsers.add_parser("run-sample", help="Run collect-sample, normalize, and publish")
    run_seoul_parser = subparsers.add_parser(
        "run-seoul",
        help="Collect Seoul Culture Portal, normalize, and publish",
    )
    run_seoul_parser.add_argument("--pages", type=int, default=5)

    args = parser.parse_args()

    if args.command == "collect-sample":
        collect_manual_sample()
    elif args.command == "collect-seoul":
        events = collect_seoul_culture(max_pages=args.pages)
        print(f"collected {len(events)} Seoul Culture Portal events")
    elif args.command == "normalize":
        events = normalize_all()
        print(f"normalized {len(events)} events")
    elif args.command == "publish":
        payload = publish()
        print(f"published {payload['count']} events")
    elif args.command == "run-sample":
        collect_manual_sample()
        events = normalize_all()
        payload = publish()
        print(f"normalized {len(events)} events")
        print(f"published {payload['count']} events")
    elif args.command == "run-seoul":
        collected = collect_seoul_culture(max_pages=args.pages)
        events = normalize_all()
        payload = publish()
        print(f"collected {len(collected)} Seoul Culture Portal events")
        print(f"normalized {len(events)} events")
        print(f"published {payload['count']} events")


if __name__ == "__main__":
    main()

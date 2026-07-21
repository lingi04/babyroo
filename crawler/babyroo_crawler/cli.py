from __future__ import annotations

import argparse

from babyroo_crawler.pipeline import normalize_all, publish
from sources.dikidiki import collect as collect_dikidiki
from sources.manual_sample import collect as collect_manual_sample
from sources.seoul_childcare import collect as collect_seoul_childcare
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
    childcare_parser = subparsers.add_parser(
        "collect-childcare",
        help="Collect parent-facing events from Seoul Childcare Center",
    )
    childcare_parser.add_argument("--months", type=int, default=3)
    subparsers.add_parser("collect-dikidiki", help="Collect DikiDiki admission and workshop data")
    subparsers.add_parser("normalize", help="Normalize raw files into data/normalized/events.json")
    subparsers.add_parser("publish", help="Publish normalized events into public/events.json")
    subparsers.add_parser("run-sample", help="Run collect-sample, normalize, and publish")
    run_seoul_parser = subparsers.add_parser(
        "run-seoul",
        help="Collect Seoul Culture Portal, normalize, and publish",
    )
    run_seoul_parser.add_argument("--pages", type=int, default=5)
    run_childcare_parser = subparsers.add_parser(
        "run-childcare",
        help="Collect Seoul Childcare Center, normalize, and publish",
    )
    run_childcare_parser.add_argument("--months", type=int, default=3)
    subparsers.add_parser(
        "run-dikidiki",
        help="Collect DikiDiki, normalize, and publish",
    )
    run_all_parser = subparsers.add_parser(
        "run-all",
        help="Collect all real sources, normalize, and publish",
    )
    run_all_parser.add_argument("--pages", type=int, default=5)
    run_all_parser.add_argument("--months", type=int, default=3)

    args = parser.parse_args()

    if args.command == "collect-sample":
        collect_manual_sample()
    elif args.command == "collect-seoul":
        events = collect_seoul_culture(max_pages=args.pages)
        print(f"collected {len(events)} Seoul Culture Portal events")
    elif args.command == "collect-childcare":
        events = collect_seoul_childcare(months=args.months)
        print(f"collected {len(events)} Seoul Childcare Center events")
    elif args.command == "collect-dikidiki":
        events = collect_dikidiki()
        print(f"collected {len(events)} DikiDiki events")
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
    elif args.command == "run-childcare":
        collected = collect_seoul_childcare(months=args.months)
        events = normalize_all()
        payload = publish()
        print(f"collected {len(collected)} Seoul Childcare Center events")
        print(f"normalized {len(events)} events")
        print(f"published {payload['count']} events")
    elif args.command == "run-dikidiki":
        collected = collect_dikidiki()
        events = normalize_all()
        payload = publish()
        print(f"collected {len(collected)} DikiDiki events")
        print(f"normalized {len(events)} events")
        print(f"published {payload['count']} events")
    elif args.command == "run-all":
        seoul_events = collect_seoul_culture(max_pages=args.pages)
        childcare_events = collect_seoul_childcare(months=args.months)
        dikidiki_events = collect_dikidiki()
        events = normalize_all()
        payload = publish()
        print(f"collected {len(seoul_events)} Seoul Culture Portal events")
        print(f"collected {len(childcare_events)} Seoul Childcare Center events")
        print(f"collected {len(dikidiki_events)} DikiDiki events")
        print(f"normalized {len(events)} events")
        print(f"published {payload['count']} events")


if __name__ == "__main__":
    main()

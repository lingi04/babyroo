"""Pure official-host classification, with an optional standalone report."""
import argparse
import json
from urllib.parse import urlsplit

OFFICIAL_DOMAINS = (
    "seoul.go.kr", "visitseoul.net", "seoulchildrensmuseum.org",
    "dikidiki.co.kr", "nfm.go.kr", "museum.go.kr", "policemuseum.go.kr",
    "swr.or.kr", "warmemo.or.kr",
)


def is_official(url: str) -> bool:
    try:
        parsed = urlsplit(url)
        host = (parsed.hostname or "").lower().rstrip(".")
        return bool(parsed.scheme in ("http", "https") and not parsed.username
                    and not parsed.password and any(
                        host == domain or host.endswith("." + domain)
                        for domain in OFFICIAL_DOMAINS))
    except (TypeError, ValueError):
        return False


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("input", help="External feeder JSON")
    args = parser.parse_args()
    with open(args.input, encoding="utf-8") as stream:
        data = json.load(stream)
    for keyword, hits in data["keywords"].items():
        for hit in hits:
            url = hit.get("official_url") or hit.get("url", "")
            print(f"{'official host' if is_official(url) else 'unverified'} | {keyword} | {url}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

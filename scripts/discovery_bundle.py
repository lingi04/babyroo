#!/usr/bin/env python3
"""Local helpers for Hermes: normalize/hash captured text and finalize a v2 batch.

These helpers do not fetch pages or call a model. Source text is supplied by Hermes.
"""
import argparse
import hashlib
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
sys.path.insert(0, str(ROOT / "scripts"))
from crawler.discovery.extraction_schema import identifier, normalized_text, http_url, fresh_date, Limits
from crawler.discovery.google_alerts import sample
from discovery_queue import atomic_json


def capture(root, document_id, candidate_ids, url, fetched_at, kind="official_detail", tool_reference=None):
    identifier(document_id)
    for cid in candidate_ids:
        identifier(cid)
    if not candidate_ids or len(set(candidate_ids)) != len(candidate_ids) or not http_url(url):
        raise ValueError("invalid candidate association or URL")
    fresh_date(fetched_at)
    root = Path(root).resolve()
    raw_path = root / "raw" / f"{document_id}.txt"
    if root not in raw_path.resolve().parents or raw_path.stat().st_size > Limits().document_bytes:
        raise ValueError("raw source text escapes root or exceeds budget")
    text = normalized_text(raw_path.read_text(encoding="utf-8"))
    data = text.encode("utf-8")
    if len(data) > Limits().document_bytes:
        raise ValueError("normalized source text exceeds budget")
    target = root / "documents" / f"{document_id}.txt"
    if root not in target.resolve().parents:
        raise ValueError("document output escapes batch root")
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_bytes(data)
    result = {"document_id": document_id, "candidate_ids": candidate_ids, "url": url,
              "fetched_at": fetched_at, "kind": kind, "text_file": f"documents/{document_id}.txt",
              "text_sha256": hashlib.sha256(data).hexdigest()}
    if tool_reference:
        result["tool_reference"] = tool_reference
    atomic_json(root / "documents" / f"{document_id}.metadata.json", result)
    return result


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    sub = parser.add_subparsers(dest="action", required=True)
    capture_parser = sub.add_parser("capture")
    capture_parser.add_argument("--batch-root", type=Path, required=True)
    capture_parser.add_argument("--document-id", required=True)
    capture_parser.add_argument("--candidate-id", action="append", required=True)
    capture_parser.add_argument("--url", required=True)
    capture_parser.add_argument("--fetched-at", required=True)
    capture_parser.add_argument("--kind", choices=["official_detail", "secondary", "search_snippet"], default="official_detail")
    capture_parser.add_argument("--tool-reference")
    finalize = sub.add_parser("finalize")
    finalize.add_argument("--batch-root", type=Path, required=True)
    finalize.add_argument("--max-age-days", type=int, default=8)
    args = parser.parse_args(argv)
    if args.action == "capture":
        print(json.dumps(capture(args.batch_root, args.document_id, args.candidate_id, args.url,
                                 args.fetched_at, args.kind, args.tool_reference), ensure_ascii=False))
    else:
        draft = args.batch_root / "batch.draft.json"
        result = sample(draft, args.max_age_days)
        if "extraction_bundle" not in result:
            raise ValueError("finalize requires a version-2 extraction bundle")
        # Install exactly the payload validated with the captured in-memory source units.
        # Never reread a concurrently replaceable draft or restamp acquisition.
        payload = result["extraction_bundle"]["payload"]
        atomic_json(args.batch_root / "bundle.json", payload)
        print(json.dumps({"output": str(args.batch_root / "bundle.json"), "proposals": len(payload["proposals"])}))
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as exc:
        print(f"[FAILED] {exc}", file=sys.stderr)
        raise SystemExit(1)

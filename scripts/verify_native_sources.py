#!/usr/bin/env python3
"""Verify every live native source and refresh an isolated catalog copy.

No Git operations, LLM calls, PRs or DB access. Output must be outside the repo.
The optional --discovery-input reuses an existing finalized evidence bundle.
"""
import argparse
from concurrent.futures import ThreadPoolExecutor, as_completed
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import traceback

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
sys.path.insert(0, str(ROOT / "crawler"))
from babyroo_crawler import discovery_workflow as workflow


def write_json(path, data):
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def worker(source, output):
    output.mkdir(parents=True, exist_ok=True)
    workflow.SOURCES = (source,)
    try:
        # Same collectors, empty-result checks and normalization as production.
        rows, checked = workflow.collect_native(output)
        write_json(output / "normalized.json", rows)
        print(json.dumps({"source": source, "status": "passed", "count": len(rows),
                          "checked": sorted(checked)}), flush=True)
        return 0
    except Exception:
        traceback.print_exc()
        return 1


def run_source(source, output, timeout):
    target = output / source
    target.mkdir()
    try:
        result = subprocess.run([sys.executable, str(Path(__file__).resolve()),
            "--worker", source, "--output", str(target)], capture_output=True, text=True,
            stdin=subprocess.DEVNULL, timeout=timeout,
            env={**os.environ, "PYTHONDONTWRITEBYTECODE": "1"})
        (target / "stdout.log").write_text(result.stdout, encoding="utf-8")
        (target / "stderr.log").write_text(result.stderr, encoding="utf-8")
        if result.returncode:
            return {"source": source, "status": "failed", "error": result.stderr.strip()}
        return json.loads(result.stdout.strip().splitlines()[-1])
    except subprocess.TimeoutExpired:
        return {"source": source, "status": "failed", "error": f"source exceeded {timeout}s"}


def verify(output, sources, timeout=300, discovery_input=None):
    results = []
    with ThreadPoolExecutor(max_workers=4) as pool:
        pending = {pool.submit(run_source, name, output, timeout): name for name in sources}
        for future in as_completed(pending):
            try:
                result = future.result()
            except Exception as exc:
                result = {"source": pending[future], "status": "failed", "error": str(exc)}
            results.append(result)
            print(f"{result['source']}: {result['status']} ({result.get('count', '-')} records)", flush=True)
    results.sort(key=lambda row: row["source"])
    report = {"sources": results, "catalog_refresh": {"status": "not_run"},
              "discovery_bundle_supplied": discovery_input is not None, "discovery_bundle_checked": False}
    if any(row["status"] != "passed" for row in results):
        report["catalog_refresh"]["reason"] = "source failure; original catalog untouched"
    elif set(sources) != set(workflow.SOURCES):
        report["catalog_refresh"]["reason"] = "source subset only; full catalog not verified"
    else:
        isolated = output / "isolated-catalog"
        for relative in ("server/data/events.json", "data/discovery/review.json", "data/discovery/identities.json"):
            original = ROOT / relative
            if original.exists():
                target = isolated / relative
                target.parent.mkdir(parents=True, exist_ok=True)
                shutil.copy2(original, target)
        rows = [row for source in sources for row in json.loads((output / source / "normalized.json").read_text())]
        try:
            result = workflow.refresh(isolated, feeder=discovery_input,
                                      native_collector=lambda staging: (rows, set(sources)))
            report["catalog_refresh"] = {"status": "passed", **result}
            report["discovery_bundle_checked"] = discovery_input is not None
            repeat = workflow.refresh(isolated, feeder=discovery_input,
                                       native_collector=lambda staging: (rows, set(sources)))
            report["repeat_refresh"] = repeat
            if repeat["changed"]:
                raise ValueError("refresh is not stable when repeated with identical captured inputs")
        except Exception as exc:
            report["catalog_refresh"] = {"status": "failed", "error": str(exc)}
    report["status"] = "failed" if (any(r["status"] != "passed" for r in results)
        or report["catalog_refresh"]["status"] == "failed") else "passed"
    write_json(output / "report.json", report)
    return report


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, help="New external diagnostics directory (default: a new /tmp directory)")
    parser.add_argument("--source", action="append", choices=workflow.SOURCES, help="Check only this source; repeatable")
    parser.add_argument("--timeout", type=int, default=300, help="Per-source deadline in seconds")
    parser.add_argument("--discovery-input", type=Path, help="Optional retained bundle.json; freshness checks still apply")
    parser.add_argument("--worker", choices=workflow.SOURCES, help=argparse.SUPPRESS)
    args = parser.parse_args(argv)
    if args.timeout < 1:
        parser.error("timeout must be positive")
    if args.output is not None:
        args.output = args.output.expanduser().resolve()
        if args.output == ROOT or ROOT in args.output.parents:
            parser.error("output must be outside the repository")
    if args.worker:
        if args.output is None:
            parser.error("worker needs output")
        return worker(args.worker, args.output)
    if args.output is None:
        output = Path(tempfile.mkdtemp(prefix="babyroo-live-verification-"))
    else:
        output = args.output
        output.mkdir(parents=True, exist_ok=False)
    print(f"Diagnostics: {output}", flush=True)
    sources = tuple(dict.fromkeys(args.source or workflow.SOURCES))
    report = verify(output, sources, args.timeout,
                    args.discovery_input.expanduser().resolve() if args.discovery_input else None)
    print(f"Overall: {report['status']}; catalog: {report['catalog_refresh']['status']}; report: {output / 'report.json'}", flush=True)
    return 0 if report["status"] == "passed" else 1


if __name__ == "__main__":
    raise SystemExit(main())

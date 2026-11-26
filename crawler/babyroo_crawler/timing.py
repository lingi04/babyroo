"""Structured elapsed-time events for local run artifacts, never catalog data."""
from contextlib import contextmanager
from datetime import datetime, timezone
import json
import os
import sys
import time


def emit(record):
    record = {"run_id": os.environ.get("BABYROO_RUN_ID"), **record}
    line = json.dumps(record, ensure_ascii=False)
    print("[TIMING] " + line, file=sys.stderr, flush=True)
    path = os.environ.get("BABYROO_TIMING_FILE")
    if path:
        try:
            import fcntl
            with open(path, "a", encoding="utf-8") as stream:
                fcntl.flock(stream, fcntl.LOCK_EX)
                stream.write(line + "\n")
        except OSError as exc:
            print(f"[TIMING_WRITE_FAILED] {type(exc).__name__}", file=sys.stderr)


@contextmanager
def timed_step(name):
    started_at = datetime.now(timezone.utc).isoformat()
    start = time.perf_counter()
    emit({"name": name, "event": "started", "started_at": started_at})
    status = "failed"
    try:
        yield
        status = "completed"
    finally:
        emit({"name": name, "event": "finished", "started_at": started_at,
              "finished_at": datetime.now(timezone.utc).isoformat(), "status": status,
              "duration_seconds": round(time.perf_counter() - start, 3)})

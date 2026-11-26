"""Cooperative run ownership and short POSIX locks for an external queue checkpoint.

The active-run marker deliberately survives process exit. Hermes research spans
multiple tool processes, so a process lock alone cannot cover the whole run.
This coordinates cooperating jobs; it is not a filesystem or credential sandbox.
"""
from __future__ import annotations

import fcntl
import json
import os
import tempfile
import uuid
from contextlib import contextmanager
from datetime import datetime, timezone
from pathlib import Path

from .extraction_schema import BundleError, Limits, read_json

JSON_LIMIT = Limits().bundle_bytes


class AlreadyRunning(RuntimeError):
    """Another transaction or full discovery run owns this state."""


def coordination_paths(state):
    state = Path(state).expanduser().resolve()
    return state, state.with_name(state.name + ".lock"), state.with_name(state.name + ".active-run.json")


def encode_json(value):
    data = (json.dumps(value, ensure_ascii=False, indent=2) + "\n").encode("utf-8")
    if len(data) > JSON_LIMIT:
        raise BundleError("JSON output exceeds 5 MiB budget; checkpoint unchanged, retain the search batch and reduce intake")
    return data


def atomic_bytes(path, data):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    name = None
    try:
        with tempfile.NamedTemporaryFile(dir=path.parent, mode="wb", delete=False) as stream:
            name = Path(stream.name)
            stream.write(data)
        os.replace(name, path)
    finally:
        if name:
            name.unlink(missing_ok=True)


def atomic_json(path, value):
    atomic_bytes(path, encode_json(value))


@contextmanager
def state_lock(state):
    state, lock_path, _ = coordination_paths(state)
    state.parent.mkdir(parents=True, exist_ok=True)
    # Never unlink/replace this inode: every process must flock the same file.
    with lock_path.open("a+") as stream:
        try:
            fcntl.flock(stream, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError as exc:
            raise AlreadyRunning("another discovery operation is running") from exc
        try:
            yield
        finally:
            fcntl.flock(stream, fcntl.LOCK_UN)


def active_run(state):
    marker = coordination_paths(state)[2]
    if not marker.exists():
        return None
    value = read_json(marker)
    try:
        token = value["run_id"]
        if uuid.UUID(token).hex != token:
            raise ValueError()
    except (ValueError, TypeError, KeyError, AttributeError):
        raise BundleError("invalid active-run marker; inspect it before recovery")
    return value


def require_owner(state, run_id):
    active = active_run(state)
    if active is None:
        if run_id is not None:
            raise ValueError("run-id has no active discovery run; acquire ownership first")
    elif run_id is None:
        raise AlreadyRunning("a discovery run owns this checkpoint")
    elif run_id != active["run_id"]:
        raise ValueError("run-id does not own the active discovery run")


def acquire_run(state):
    with state_lock(state):
        if active_run(state) is not None:
            raise AlreadyRunning("a discovery run is already active; inspect before manual recovery")
        owner = {"run_id": uuid.uuid4().hex, "started_at": datetime.now(timezone.utc).isoformat()}
        atomic_json(coordination_paths(state)[2], owner)
        return {"status": "acquired", **owner, "state": str(coordination_paths(state)[0])}


def release_run(state, run_id):
    with state_lock(state):
        require_owner(state, run_id)
        coordination_paths(state)[2].unlink()
        return {"status": "released", "run_id": run_id}


def validate_outcome_path(state, outcome_path):
    outcome_path = Path(outcome_path).expanduser().resolve()
    if outcome_path in coordination_paths(state):
        raise ValueError("outcome must not overwrite checkpoint or coordination files")
    return outcome_path


def finish_run(state, run_id, outcome_path, status, details=None):
    """Finish a known-stopped owner; never use this for uncertain/live work."""
    if status not in {"completed", "failed"}:
        raise ValueError("only completed or failed runs may be finalized")
    outcome_path = validate_outcome_path(state, outcome_path)
    with state_lock(state):
        require_owner(state, run_id)
        report = {"status": status, "run_id": run_id,
                  "finished_at": datetime.now(timezone.utc).isoformat(), "details": details or {}}
        result = {"status": status, "run_id": run_id, "outcome": str(outcome_path),
                  "ownership": "released", "outcome_saved": False}
        try:
            atomic_json(outcome_path, report)
            result["outcome_saved"] = True
        except Exception as exc:
            result["outcome_error"] = str(exc)
        finally:
            # The command has ended. Even a full disk must not strand its owner.
            # This exact-token check and unlink share the same transaction lock.
            coordination_paths(state)[2].unlink()
        return result

"""Channel registry for place discovery beyond the native crawler sources.

Every discovery channel is a small, isolated unit: it collects raw venue
candidates, normalizes nothing on its own, and returns a list of dicts.
Plugging in a new source only requires implementing `collect()` and
registering it here.

Access reality
--------------
* Instagram: automation needs a Meta Graph API token (business/management
  app).  Personal-account scraping is blocked and breaks Meta policy.
  Until a token is available, this channel runs in "manual input" mode so
  the user can paste candidates they see, and it is treated as a fresh
  discovery source.  Tokens are read from env only if/when provisioned.
"""
from __future__ import annotations

from typing import Any, Callable

# One discovery sample: a channel name + the raw candidates it surfaced.
Sample = dict[str, Any]

# registry[name] -> callable returning the channel's sample dict.
CHANNELS: dict[str, Callable[[], Sample]] = {}


def register(name: str, func: Callable[[], Sample]) -> None:
    """Register a discovery channel under ``name``."""
    CHANNELS[name] = func


def list_channels() -> list[str]:
    return sorted(CHANNELS)


def collect(name: str) -> Sample:
    if name not in CHANNELS:
        raise KeyError(f"unknown discovery channel: {name!r} (available: {sorted(CHANNELS)})")
    return CHANNELS[name]()

"""Small registry for external discovery readers."""
from typing import Callable

CHANNELS: dict[str, Callable] = {}


def register(name: str, reader: Callable) -> None:
    CHANNELS[name] = reader


def list_channels() -> list[str]:
    return sorted(CHANNELS)


def collect(name: str, **kwargs) -> dict:
    return CHANNELS[name](**kwargs)

"""Shared catalog availability policy; these are not venue opening/closing dates."""

from datetime import datetime
from zoneinfo import ZoneInfo

PERMANENT_START = "1970-01-01"
PERMANENT_END = "9999-12-31"


def seoul_today() -> str:
    return datetime.now(ZoneInfo("Asia/Seoul")).date().isoformat()

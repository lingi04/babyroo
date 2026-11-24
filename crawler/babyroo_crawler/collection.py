"""Collector results compatible with legacy callers expecting a list of rows."""
from __future__ import annotations


class CollectedEvents(list):
    """A collector may positively attest a healthy, intentionally empty result.

    A plain empty list remains ambiguous and must not bypass refresh safeguards.
    The collector, which understands its source's pages and filters, owns this
    attestation. It is not inferred from an HTTP 200 response or an empty array.
    """

    def __init__(self, events=(), *, verified_empty_reason=None):
        super().__init__(events)
        self.verified_empty_reason = verified_empty_reason

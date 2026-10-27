"""DataHub lookups run concurrently, stay bounded, and merge in a stable order."""
from __future__ import annotations

import asyncio

from app.agents import metadata_analyst
from app.agents.base import RunContext
from app.agents.metadata_analyst import find_candidates
from app.datahub.mock_gateway import MockDataHubGateway
from app.llm.mock_provider import MockLLMProvider


class CountingGateway(MockDataHubGateway):
    """Mock catalog that records how many calls are in flight at once."""

    def __init__(self) -> None:
        super().__init__(latency_seconds=0)
        self.in_flight = 0
        self.peak = 0
        self.calls = 0

    async def _track(self, coro):
        self.in_flight += 1
        self.calls += 1
        self.peak = max(self.peak, self.in_flight)
        await asyncio.sleep(0.02)
        try:
            return await coro
        finally:
            self.in_flight -= 1

    async def search_datasets(self, query, *, limit=10):
        return await self._track(super().search_datasets(query, limit=limit))

    async def get_schema(self, urn):
        return await self._track(super().get_schema(urn))


def _ctx(gateway) -> RunContext:
    async def emit_log(_: str) -> None:
        pass

    return RunContext(
        run_id="r", prompt="p", llm=MockLLMProvider(fixtures={}), datahub=gateway,
        emit_log=emit_log,
    )


async def test_lookups_overlap_but_stay_within_the_limit(monkeypatch):
    monkeypatch.setattr(metadata_analyst, "MAX_CONCURRENT_LOOKUPS", 2)
    gateway = CountingGateway()

    candidates = await find_candidates(_ctx(gateway), ["customer", "payment", "order", "revenue"])

    assert gateway.peak == 2
    assert gateway.calls == 4 + len(candidates)
    assert all("schema" in ds for ds in candidates.values())


async def test_candidate_order_is_stable():
    first = await find_candidates(_ctx(CountingGateway()), ["payment", "customer"])
    second = await find_candidates(_ctx(CountingGateway()), ["payment", "customer"])

    assert list(first) == list(second)
    assert len(first) > 0

from __future__ import annotations

from abc import ABC, abstractmethod
from typing import Any


class DataHubError(RuntimeError):
    """Raised when a DataHub call fails after retries."""


class DataHubGateway(ABC):
    @abstractmethod
    async def search_datasets(self, query: str, *, limit: int = 10) -> list[dict[str, Any]]:
        """Full-text search over dataset entities. Returns raw entity dicts
        (urn, name, platform, description, tags) ranked by relevance."""
        raise NotImplementedError

    @abstractmethod
    async def get_schema(self, urn: str) -> dict[str, Any]:
        """Fetch the schema (field names, types, descriptions) for a dataset URN."""
        raise NotImplementedError

    @abstractmethod
    async def get_lineage(self, urn: str, *, direction: str = "upstream") -> list[dict[str, Any]]:
        """Fetch upstream or downstream lineage edges for a dataset URN."""
        raise NotImplementedError

    @abstractmethod
    async def upsert_metadata(self, urn: str, aspect: str, payload: dict[str, Any]) -> None:
        """Write a metadata aspect (e.g. documentation, glossary terms,
        ownership) back onto an entity."""
        raise NotImplementedError

    @abstractmethod
    async def emit_lineage(self, upstream_urn: str, downstream_urn: str) -> None:
        """Emit a lineage edge between two dataset URNs."""
        raise NotImplementedError

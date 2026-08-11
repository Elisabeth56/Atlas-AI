"""
Mock DataHub gateway — returns realistic fixture metadata (Stripe events,
Postgres customer/order tables) with artificial network-like delay. This
is what the Metadata Analyst and Write-back agents run against in demo
mode, so the pipeline is fully demoable without a running DataHub instance.
"""

from __future__ import annotations

import asyncio
import logging
from typing import Any

from app.datahub.gateway import DataHubGateway

logger = logging.getLogger("atlas.datahub.mock")

_FIXTURE_DATASETS: list[dict[str, Any]] = [
    {
        "urn": "urn:li:dataset:(urn:li:dataPlatform:stripe,raw.stripe_payments,PROD)",
        "name": "raw.stripe_payments",
        "platform": "stripe",
        "description": "Raw Stripe payment events landed via webhook ingestion.",
        "tags": ["pii", "finance"],
        "owners": ["data-platform@atlas.ai"],
        "schema": [
            {"name": "payment_id", "type": "string", "description": "Stripe payment intent ID"},
            {"name": "customer_id", "type": "string", "description": "Stripe customer ID"},
            {"name": "amount_cents", "type": "long", "description": "Payment amount in cents"},
            {"name": "currency", "type": "string", "description": "ISO currency code"},
            {"name": "card_last4", "type": "string", "description": "Last 4 digits of card — PII"},
            {"name": "created_at", "type": "timestamp", "description": "Event timestamp (UTC)"},
        ],
    },
    {
        "urn": "urn:li:dataset:(urn:li:dataPlatform:postgres,public.customers,PROD)",
        "name": "public.customers",
        "platform": "postgres",
        "description": "Operational customer records from the primary application database.",
        "tags": ["core"],
        "owners": ["backend-team@atlas.ai"],
        "schema": [
            {"name": "customer_id", "type": "string", "description": "Primary key"},
            {"name": "customer_name", "type": "string", "description": "Full name — PII"},
            {"name": "email", "type": "string", "description": "Email address — PII"},
            {"name": "signup_at", "type": "timestamp", "description": "Account creation timestamp"},
            {"name": "plan_tier", "type": "string", "description": "Subscription tier"},
        ],
    },
    {
        "urn": "urn:li:dataset:(urn:li:dataPlatform:postgres,public.orders,PROD)",
        "name": "public.orders",
        "platform": "postgres",
        "description": "Order line items linked to Stripe payments and customers.",
        "tags": ["core", "finance"],
        "owners": ["backend-team@atlas.ai"],
        "schema": [
            {"name": "order_id", "type": "string", "description": "Primary key"},
            {"name": "customer_id", "type": "string", "description": "FK to customers"},
            {"name": "payment_id", "type": "string", "description": "FK to stripe_payments"},
            {"name": "order_total", "type": "numeric", "description": "Order value in USD"},
            {"name": "created_at", "type": "timestamp", "description": "Order timestamp (UTC)"},
        ],
    },
]

_LINEAGE_FIXTURE: dict[str, list[dict[str, Any]]] = {
    "urn:li:dataset:(urn:li:dataPlatform:postgres,public.orders,PROD)": [
        {"urn": "urn:li:dataset:(urn:li:dataPlatform:stripe,raw.stripe_payments,PROD)", "type": "upstream"},
        {"urn": "urn:li:dataset:(urn:li:dataPlatform:postgres,public.customers,PROD)", "type": "upstream"},
    ],
}


class MockDataHubGateway(DataHubGateway):
    def __init__(self, *, latency_seconds: float = 0.25) -> None:
        self._latency = latency_seconds
        self._written_aspects: list[tuple[str, str, dict[str, Any]]] = []
        self._emitted_lineage: list[tuple[str, str]] = []

    async def search_datasets(self, query: str, *, limit: int = 10) -> list[dict[str, Any]]:
        await asyncio.sleep(self._latency)
        query_lower = query.lower()
        # Naive relevance: substring match across name/description/tags, then
        # fall back to returning everything so the demo never comes back empty.
        matches = [
            ds for ds in _FIXTURE_DATASETS
            if query_lower in ds["name"].lower()
            or query_lower in ds["description"].lower()
            or any(query_lower in t for t in ds["tags"])
        ]
        results = matches or _FIXTURE_DATASETS
        return results[:limit]

    async def get_schema(self, urn: str) -> dict[str, Any]:
        await asyncio.sleep(self._latency)
        for ds in _FIXTURE_DATASETS:
            if ds["urn"] == urn:
                return {"urn": urn, "fields": ds["schema"]}
        return {"urn": urn, "fields": []}

    async def get_lineage(self, urn: str, *, direction: str = "upstream") -> list[dict[str, Any]]:
        await asyncio.sleep(self._latency)
        edges = _LINEAGE_FIXTURE.get(urn, [])
        return [e for e in edges if e["type"] == direction] if direction else edges

    async def upsert_metadata(self, urn: str, aspect: str, payload: dict[str, Any]) -> None:
        await asyncio.sleep(self._latency)
        self._written_aspects.append((urn, aspect, payload))
        logger.info("mock datahub upsert urn=%s aspect=%s", urn, aspect)

    async def emit_lineage(self, upstream_urn: str, downstream_urn: str) -> None:
        await asyncio.sleep(self._latency)
        self._emitted_lineage.append((upstream_urn, downstream_urn))
        logger.info("mock datahub lineage %s -> %s", upstream_urn, downstream_urn)

    def all_dataset_urns(self) -> list[str]:
        return [ds["urn"] for ds in _FIXTURE_DATASETS]

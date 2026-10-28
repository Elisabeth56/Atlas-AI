import pytest

from app.config import Settings


@pytest.mark.parametrize("given", [
    "postgresql://u:p@host:5432/postgres",
    "postgres://u:p@host:5432/postgres",
    "postgresql+asyncpg://u:p@host:5432/postgres",
])
def test_database_url_always_uses_asyncpg(given):
    assert Settings(DATABASE_URL=given).DATABASE_URL == "postgresql+asyncpg://u:p@host:5432/postgres"

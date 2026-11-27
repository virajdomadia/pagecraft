"""Shared fixtures: a fresh app per test and an in-process httpx client, plus the DB harness
(the Frontrow recipe).

`raise_app_exceptions=False` so unhandled errors reach the test as the 500 envelope (what a real
client sees) instead of a traceback out of the transport.

DB harness: tests marked `db` need `TEST_DATABASE_URL`. Once per session the schema is rebuilt
through Alembic (downgrade base → upgrade head, so the downgrade path is exercised too); before
every test all tables are truncated. Without the variable, `db` tests are skipped.
"""

import os
from collections.abc import AsyncIterator, Iterator

import pytest
from alembic import command
from alembic.config import Config
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.pool import NullPool

from app import db as db_module
from app.db import asyncpg_url, get_session
from app.main import create_app
from app.models import Base, SiteMember, User
from app.seed.__main__ import seed
from tests.live import live_server
from tests.settings import make_settings

API_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TEST_DATABASE_URL = os.environ.get("TEST_DATABASE_URL")


def pytest_configure(config: pytest.Config) -> None:
    config.addinivalue_line("markers", "db: needs TEST_DATABASE_URL (Postgres)")


def pytest_collection_modifyitems(config: pytest.Config, items: list[pytest.Item]) -> None:
    if TEST_DATABASE_URL:
        return
    skip = pytest.mark.skip(reason="TEST_DATABASE_URL not set")
    for item in items:
        if "db" in item.keywords:
            item.add_marker(skip)


@pytest.fixture
def settings_overrides() -> dict[str, object]:
    """Override per test module/test to give the app secrets (e.g. `revalidate_secret`)."""
    return {}


@pytest.fixture
def app(settings_overrides: dict[str, object]) -> FastAPI:
    # Pure defaults (tests/settings.py): no env, no .env.local — the DB stays off.
    return create_app(settings=make_settings(**settings_overrides))


@pytest.fixture
async def client(app: FastAPI) -> AsyncIterator[AsyncClient]:
    transport = ASGITransport(app=app, raise_app_exceptions=False)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        yield c


# --- DB harness ---------------------------------------------------------------------------------


@pytest.fixture(scope="session")
def migrated_database_url() -> Iterator[str]:
    """Rebuild the schema via Alembic once per session (sync: env.py owns its own event loop)."""
    assert TEST_DATABASE_URL  # `db` tests are skipped without it
    os.environ["ALEMBIC_URL"] = TEST_DATABASE_URL
    cfg = Config(os.path.join(API_DIR, "alembic.ini"))
    command.downgrade(cfg, "base")
    command.upgrade(cfg, "head")
    yield asyncpg_url(TEST_DATABASE_URL)


@pytest.fixture
async def db_engine(migrated_database_url: str) -> AsyncIterator[AsyncEngine]:
    engine = create_async_engine(migrated_database_url, poolclass=NullPool)
    tables = ", ".join(t.name for t in Base.metadata.sorted_tables)
    async with engine.begin() as conn:
        await conn.execute(text(f"truncate table {tables} restart identity cascade"))
    yield engine
    await engine.dispose()


@pytest.fixture
async def db(db_engine: AsyncEngine) -> AsyncIterator[AsyncSession]:
    async with async_sessionmaker(db_engine, expire_on_commit=False)() as session:
        yield session


@pytest.fixture
async def db_app(app: FastAPI, db_engine: AsyncEngine) -> AsyncIterator[FastAPI]:
    """The app wired to the test database (routes that use the `get_session` dependency)."""
    factory = async_sessionmaker(db_engine, expire_on_commit=False)

    async def override() -> AsyncIterator[AsyncSession]:
        async with factory() as session:
            yield session

    app.dependency_overrides[get_session] = override
    try:
        yield app
    finally:
        app.dependency_overrides.pop(get_session, None)
        await db_module.dispose_engine()


@pytest.fixture
async def db_client(db_app: FastAPI) -> AsyncIterator[AsyncClient]:
    transport = ASGITransport(app=db_app, raise_app_exceptions=False)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        yield c


@pytest.fixture
async def seeded(db: AsyncSession) -> AsyncSession:
    """The real seed: templates, the demo logins and six published showcase sites."""
    from app.seed.__main__ import seed

    await seed(db, make_settings())
    return db


# --- live server (L1/L2 two-client tests) -------------------------------------------------------


@pytest.fixture
def base_url(migrated_database_url: str) -> Iterator[str]:
    with live_server(migrated_database_url) as url:
        yield url


@pytest.fixture
async def site(db: AsyncSession, base_url: str) -> AsyncIterator[dict]:
    """Asha (owner) and Ravi (editor) on one café site, each with their own client."""
    await seed(db, make_settings())
    async with AsyncClient(base_url=base_url) as asha, AsyncClient(base_url=base_url) as ravi:
        for client, email, name in (
            (asha, "asha@example.com", "Asha"),
            (ravi, "ravi@example.com", "Ravi"),
        ):
            res = await client.post(
                "/auth/sign-up", json={"email": email, "password": "correct horse", "name": name}
            )
            assert res.status_code == 201, res.text
        res = await asha.post("/sites", json={"name": "Chai Point", "template": "cafe"})
        site_id = res.json()["id"]
        ravi_id = (
            await db.execute(select(User.id).where(User.email == "ravi@example.com"))
        ).scalar_one()
        db.add(SiteMember(site_id=site_id, user_id=ravi_id, role="editor"))
        await db.commit()
        yield {"id": site_id, "asha": asha, "ravi": ravi, "ravi_id": ravi_id}

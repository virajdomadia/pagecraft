"""A real HTTP server for the two-client tests: httpx's in-process ASGI transport buffers a
response until it ends, which an SSE stream never does. uvicorn runs the real app (its own
engine on the test database) in a thread; clients talk to it over TCP."""

import asyncio
import base64
import json
import socket
import threading
from collections.abc import AsyncGenerator, AsyncIterator, Iterator
from contextlib import contextmanager
from typing import Any

import uvicorn
from httpx import AsyncClient
from pycrdt import Doc

from app.main import create_app
from app.services import crdt
from tests.settings import make_settings


@contextmanager
def live_server(database_url: str, **settings: Any) -> Iterator[str]:
    app = create_app(settings=make_settings(database_url=database_url, **settings))
    sock = socket.socket()
    sock.bind(("127.0.0.1", 0))
    port = sock.getsockname()[1]
    server = uvicorn.Server(uvicorn.Config(app, log_level="warning", lifespan="on"))
    thread = threading.Thread(target=server.run, kwargs={"sockets": [sock]}, daemon=True)
    thread.start()
    while not server.started:
        threading.Event().wait(0.02)
    try:
        yield f"http://127.0.0.1:{port}"
    finally:
        server.should_exit = True
        thread.join(10)
        sock.close()


async def sse(client: AsyncClient, url: str, **kw: Any) -> AsyncGenerator[tuple[str, Any]]:
    """Yield (event, data) from an SSE endpoint; comments (pings) are skipped."""
    async with client.stream("GET", url, **kw) as res:
        assert res.status_code == 200, await res.aread()
        name, data = "message", ""
        async for line in res.aiter_lines():
            if line == "":
                if data:
                    yield name, json.loads(data)
                name, data = "message", ""
            elif line.startswith("event:"):
                name = line[6:].strip()
            elif line.startswith("data:"):
                data += line[5:].strip()


async def collect(agen: AsyncIterator[tuple[str, Any]], until: Any, timeout: float = 5.0) -> list:
    """Events from `agen` until `until(events)` is true (or fail after `timeout`)."""
    got: list[tuple[str, Any]] = []

    async def run() -> None:
        async for item in agen:
            got.append(item)
            if until(got):
                return

    await asyncio.wait_for(run(), timeout)
    return got


def apply_events(doc: Doc, events: list[tuple[str, Any]]) -> None:
    for name, data in events:
        if name == "update":
            doc.apply_update(base64.b64decode(data["data"]))


def edit_update(doc: Doc, edit: Any) -> str:
    before = doc.get_state()
    site, sections = crdt.roots(doc)
    with doc.transaction():
        edit(site, sections)
    return base64.b64encode(doc.get_update(before)).decode()

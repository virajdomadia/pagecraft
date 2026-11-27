"""Pure-ASGI middleware shared by every route.

- RequestIdMiddleware: honour a well-formed incoming `X-Request-Id`, else uuid4; echo it back.
- BlankQueryParamsMiddleware: `?date=&type=` → params absent, so no-JS GET filter forms that
  submit empty selects validate as "not provided" rather than as bad input.
- SameOriginWritesMiddleware: refuse a state-changing request the browser marks as coming
  from another site (L4). Same-site counts too: every *.virajdomadia.com app is "same site".
  Browsers without Sec-Fetch-Site (and non-browser clients) pass; the cookie is still Lax.
- NoSniffMiddleware: `X-Content-Type-Options: nosniff` on every response, so nothing the api
  sends is ever content-sniffed into something executable. (500s render outside the middleware
  stack; `errors.envelope` sets it on those itself.)
"""

import re
import uuid
from urllib.parse import parse_qsl, urlencode

from starlette.types import ASGIApp, Message, Receive, Scope, Send

from app.errors import envelope

REQUEST_ID_HEADER = b"x-request-id"
REQUEST_ID_RE = re.compile(r"^[A-Za-z0-9._:-]{1,128}$")
NOSNIFF = (b"x-content-type-options", b"nosniff")


class RequestIdMiddleware:
    def __init__(self, app: ASGIApp) -> None:
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        incoming = next((v for k, v in scope["headers"] if k == REQUEST_ID_HEADER), None)
        request_id = incoming.decode("latin-1") if incoming else ""
        if not REQUEST_ID_RE.match(request_id):
            request_id = str(uuid.uuid4())
        scope.setdefault("state", {})["request_id"] = request_id

        async def send_with_id(message: Message) -> None:
            if message["type"] == "http.response.start":
                headers = list(message.get("headers", []))
                headers.append((REQUEST_ID_HEADER, request_id.encode("latin-1")))
                message["headers"] = headers
            await send(message)

        await self.app(scope, receive, send_with_id)


class BlankQueryParamsMiddleware:
    def __init__(self, app: ASGIApp) -> None:
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] == "http" and scope.get("query_string"):
            pairs = parse_qsl(scope["query_string"].decode("latin-1"), keep_blank_values=True)
            kept = [(k, v) for k, v in pairs if v != ""]
            if len(kept) != len(pairs):
                scope["query_string"] = urlencode(kept).encode("latin-1")
        await self.app(scope, receive, send)


class NoSniffMiddleware:
    def __init__(self, app: ASGIApp) -> None:
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        async def send_nosniff(message: Message) -> None:
            if message["type"] == "http.response.start":
                headers = list(message.get("headers", []))
                if not any(k.lower() == NOSNIFF[0] for k, _ in headers):
                    headers.append(NOSNIFF)
                message["headers"] = headers
            await send(message)

        await self.app(scope, receive, send_nosniff)


SAFE_METHODS = {"GET", "HEAD", "OPTIONS"}
FOREIGN = {b"cross-site", b"same-site"}


class SameOriginWritesMiddleware:
    def __init__(self, app: ASGIApp) -> None:
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] == "http" and scope["method"] not in SAFE_METHODS:
            site = next((v for k, v in scope["headers"] if k == b"sec-fetch-site"), None)
            if site in FOREIGN:
                await envelope("forbidden", "Cross-site request refused")(scope, receive, send)
                return
        await self.app(scope, receive, send)

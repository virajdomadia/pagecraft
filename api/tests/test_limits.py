"""The rate-limit key's address: the web tier's forwarded visitor IP only with PROXY_SECRET."""

from starlette.requests import Request

from app.services.limits import client_ip
from tests.settings import make_settings


def request(headers: dict[str, str], secret: str | None) -> Request:
    from fastapi import FastAPI

    app = FastAPI()
    app.state.settings = make_settings(proxy_secret=secret)
    raw = [(k.lower().encode(), v.encode()) for k, v in headers.items()]
    return Request({"type": "http", "headers": raw, "client": ("10.0.0.9", 1), "app": app})


VISITOR = {"x-pagecraft-client-ip": "203.0.113.7", "x-forwarded-for": "64.252.1.1"}


def test_forwarded_ip_is_used_with_the_right_secret() -> None:
    assert client_ip(request({**VISITOR, "x-pagecraft-proxy": "s3cret"}, "s3cret")) == "203.0.113.7"


def test_forwarded_ip_is_ignored_without_the_right_secret() -> None:
    assert client_ip(request({**VISITOR, "x-pagecraft-proxy": "guess"}, "s3cret")) == "64.252.1.1"
    assert client_ip(request(VISITOR, "s3cret")) == "64.252.1.1"
    # No secret configured (local, tests): the header is never trusted.
    assert client_ip(request({**VISITOR, "x-pagecraft-proxy": ""}, None)) == "64.252.1.1"
    assert client_ip(request({}, None)) == "10.0.0.9"

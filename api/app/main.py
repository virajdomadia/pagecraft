"""App factory. Vercel's FastAPI preset imports the module-level `app` from here."""

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.openapi.docs import get_swagger_ui_html
from fastapi.responses import HTMLResponse

from app.config import Settings, get_settings
from app.db import dispose_engine
from app.errors import install_error_handlers
from app.middleware import (
    BlankQueryParamsMiddleware,
    NoSniffMiddleware,
    RequestIdMiddleware,
    SameOriginWritesMiddleware,
)
from app.routers import auth, invites, public, sites

# Swagger UI from jsdelivr at an exact version, not FastAPI's floating `@5`.
SWAGGER_UI = "https://cdn.jsdelivr.net/npm/swagger-ui-dist@5.34.1"


@asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncIterator[None]:
    try:
        yield
    finally:
        await dispose_engine()


def create_app(settings: Settings | None = None) -> FastAPI:
    """`settings` lets tests build an app that ignores the local .env."""
    settings = settings or get_settings()
    app = FastAPI(
        title="Pagecraft API",
        version="1.0.0",
        description="Sites as Yjs documents: an update log, pycrdt compaction, server-side "
        "export on publish. See docs/04-technical-design.md.",
        docs_url=None,
        redoc_url=None,
        lifespan=lifespan,
    )
    app.state.settings = settings

    app.add_middleware(RequestIdMiddleware)
    app.add_middleware(NoSniffMiddleware)
    app.add_middleware(BlankQueryParamsMiddleware)
    app.add_middleware(SameOriginWritesMiddleware)
    install_error_handlers(app)

    app.include_router(public.router)
    app.include_router(auth.router)
    app.include_router(sites.router)
    app.include_router(invites.router)

    @app.get("/docs", include_in_schema=False)
    async def docs() -> HTMLResponse:
        return get_swagger_ui_html(
            openapi_url=app.openapi_url or "/openapi.json",
            title=f"{app.title} - Swagger UI",
            swagger_js_url=f"{SWAGGER_UI}/swagger-ui-bundle.js",
            swagger_css_url=f"{SWAGGER_UI}/swagger-ui.css",
        )

    return app


app = create_app()

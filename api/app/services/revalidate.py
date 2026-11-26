"""Tell web to drop a published page from its cache: `POST {WEB_URL}/api/revalidate`
`{ tags, secret }` (04 §6 step 4). Never raises — if web is unreachable the publish still
succeeds and ISR's 60 s revalidate catches up — but every failure is logged."""

import logging
from collections.abc import Sequence

import httpx

from app.config import Settings

log = logging.getLogger(__name__)
TIMEOUT_SECONDS = 5.0


def site_tag(slug: str) -> str:
    return f"site:{slug}"


async def revalidate(
    tags: Sequence[str],
    settings: Settings,
    *,
    transport: httpx.AsyncBaseTransport | None = None,
) -> bool:
    if not tags:
        return True
    if settings.revalidate_secret is None:
        log.info("REVALIDATE_SECRET not set; %s will refresh within 60 s", list(tags))
        return False
    url = settings.web_url.rstrip("/") + "/api/revalidate"
    body = {"secret": settings.revalidate_secret.get_secret_value(), "tags": list(tags)}
    try:
        async with httpx.AsyncClient(transport=transport, timeout=TIMEOUT_SECONDS) as client:
            res = await client.post(url, json=body)
    except httpx.HTTPError as exc:
        log.warning("Revalidation of %s failed: %s", list(tags), exc)
        return False
    if not res.is_success:
        log.warning("Revalidation of %s rejected: HTTP %s", list(tags), res.status_code)
    return res.is_success

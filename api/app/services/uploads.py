"""Image uploads (04 §8): ≤ 4 MB (Vercel refuses bodies over 4.5 MB before the API runs),
JPEG / PNG / WebP sniffed by Pillow (never trusted from the filename or the Content-Type),
≤ 25 megapixels, resized to ≤ 2000 px and re-encoded — which also strips EXIF, GPS included.

Storage: Vercel Blob (`sites/{site_id}/{uuid}.{ext}`) when `BLOB_READ_WRITE_TOKEN` is set;
otherwise the bytes go to the `uploads` table and are served at `/media/{id}` (through web's
`/api/*` rewrite: `/api/media/{id}`), so the editor works before the Blob store exists.
"""

import io
import logging
import uuid
from dataclasses import dataclass

import httpx
from PIL import Image, UnidentifiedImageError
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import Settings
from app.errors import ApiError
from app.models import Upload

log = logging.getLogger(__name__)

MAX_BYTES = 4 * 1024 * 1024
MAX_SIDE = 2000
FORMATS = {"JPEG", "PNG", "WEBP"}
BLOB_API = "https://blob.vercel-storage.com"
TIMEOUT = 15.0

MAX_PIXELS = 25_000_000  # checked before decoding; ~100 MB as RGBA
Image.MAX_IMAGE_PIXELS = (
    MAX_PIXELS  # Pillow only *raises* at twice this; the check below won't wait
)


@dataclass
class Processed:
    data: bytes
    content_type: str
    ext: str
    width: int
    height: int


def too_large_message(size: int) -> str:
    return f"That image is {size / 1024 / 1024:.1f} MB — the limit is 4 MB"


def process(data: bytes) -> Processed:
    if len(data) > MAX_BYTES:
        raise ApiError("file_too_large", too_large_message(len(data)), status=413)
    try:
        with Image.open(io.BytesIO(data)) as probe:
            fmt, (width, height) = probe.format, probe.size
            probe.verify()
        if width * height > MAX_PIXELS:
            raise ApiError(
                "file_too_large",
                f"That image is {width}×{height} — the limit is 25 megapixels",
                status=413,
            )
        img = Image.open(io.BytesIO(data))
        img.draft("RGB", (MAX_SIDE, MAX_SIDE))  # JPEG: decode at a reduced scale
        img.load()
    except (UnidentifiedImageError, OSError, Image.DecompressionBombError) as exc:
        raise ApiError("unsupported_type", "Upload a JPEG, PNG or WebP image", status=415) from exc
    if fmt not in FORMATS:
        raise ApiError("unsupported_type", "Upload a JPEG, PNG or WebP image", status=415)

    img.thumbnail((MAX_SIDE, MAX_SIDE))
    out = io.BytesIO()
    has_alpha = img.mode in ("RGBA", "LA") or (img.mode == "P" and "transparency" in img.info)
    if has_alpha:
        img.convert("RGBA").save(out, "PNG", optimize=True)
        content_type, ext = "image/png", "png"
    else:
        img.convert("RGB").save(out, "JPEG", quality=82, optimize=True, progressive=True)
        content_type, ext = "image/jpeg", "jpg"
    return Processed(out.getvalue(), content_type, ext, img.width, img.height)


async def store(
    db: AsyncSession,
    site_id: uuid.UUID,
    image: Processed,
    settings: Settings,
    *,
    transport: httpx.AsyncBaseTransport | None = None,
) -> str:
    if settings.blob_read_write_token is not None:
        pathname = f"sites/{site_id}/{uuid.uuid4().hex}.{image.ext}"
        headers = {
            "Authorization": f"Bearer {settings.blob_read_write_token.get_secret_value()}",
            "x-api-version": "7",
            "x-content-type": image.content_type,
            "x-add-random-suffix": "0",
        }
        async with httpx.AsyncClient(transport=transport, timeout=TIMEOUT) as client:
            res = await client.put(f"{BLOB_API}/{pathname}", content=image.data, headers=headers)
        if not res.is_success:
            raise ApiError("unavailable", "Image storage is unavailable — try again")
        return str(res.json()["url"])

    row = Upload(
        site_id=site_id,
        content_type=image.content_type,
        data=image.data,
        width=image.width,
        height=image.height,
    )
    db.add(row)
    await db.commit()
    return f"/api/media/{row.id}.{image.ext}"


async def delete_prefix(
    site_id: uuid.UUID, settings: Settings, *, transport: httpx.AsyncBaseTransport | None = None
) -> None:
    """Delete a site's Blob objects (R6). DB-stored uploads go with the site's cascade."""
    if settings.blob_read_write_token is None:
        return
    headers = {
        "Authorization": f"Bearer {settings.blob_read_write_token.get_secret_value()}",
        "x-api-version": "7",
    }
    try:
        async with httpx.AsyncClient(transport=transport, timeout=TIMEOUT) as client:
            params = {"prefix": f"sites/{site_id}/"}
            while True:
                res = await client.get(f"{BLOB_API}/", params=params, headers=headers)
                res.raise_for_status()
                body = res.json()
                urls = [b["url"] for b in body.get("blobs", [])]
                if urls:
                    await client.post(f"{BLOB_API}/delete", json={"urls": urls}, headers=headers)
                if not body.get("hasMore") or not body.get("cursor"):
                    break
                params["cursor"] = body["cursor"]
    except Exception:  # orphaned images are harmless; the site row is already gone
        log.warning("Blob cleanup failed for site %s", site_id, exc_info=True)

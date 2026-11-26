"""Image uploads (04 §8): ≤ 5 MB, JPEG / PNG / WebP sniffed by Pillow (never trusted from the
filename or the Content-Type), resized to ≤ 2000 px and re-encoded — which also strips EXIF,
GPS included.

Storage: Vercel Blob (`sites/{site_id}/{uuid}.{ext}`) when `BLOB_READ_WRITE_TOKEN` is set;
otherwise the bytes go to the `uploads` table and are served at `/media/{id}` (through web's
`/api/*` rewrite: `/api/media/{id}`), so the editor works before the Blob store exists.
"""

import io
import uuid
from dataclasses import dataclass

import httpx
from PIL import Image, UnidentifiedImageError
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import Settings
from app.errors import ApiError
from app.models import Upload

MAX_BYTES = 5 * 1024 * 1024
MAX_SIDE = 2000
FORMATS = {"JPEG", "PNG", "WEBP"}
BLOB_API = "https://blob.vercel-storage.com"
TIMEOUT = 15.0

Image.MAX_IMAGE_PIXELS = 50_000_000  # refuse decompression bombs early


@dataclass
class Processed:
    data: bytes
    content_type: str
    ext: str
    width: int
    height: int


def too_large_message(size: int) -> str:
    return f"That image is {size / 1024 / 1024:.1f} MB — the limit is 5 MB"


def process(data: bytes) -> Processed:
    if len(data) > MAX_BYTES:
        raise ApiError("file_too_large", too_large_message(len(data)), status=413)
    try:
        with Image.open(io.BytesIO(data)) as probe:
            fmt = probe.format
            probe.verify()
        img = Image.open(io.BytesIO(data))
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
            res = await client.get(
                f"{BLOB_API}/", params={"prefix": f"sites/{site_id}/"}, headers=headers
            )
            urls = [b["url"] for b in res.json().get("blobs", [])] if res.is_success else []
            if urls:
                await client.post(f"{BLOB_API}/delete", json={"urls": urls}, headers=headers)
    except httpx.HTTPError:
        pass  # orphaned images are harmless; the site row is gone either way

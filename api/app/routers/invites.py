"""`/invites/{token}` (L4): what an invite link is for, and accepting it."""

import datetime as dt
from typing import Annotated

from fastapi import APIRouter, Depends, Request

from app.deps import AppSettings, CurrentUser, Db, current_user, load_access
from app.models import User
from app.schemas.models import InvitePreview, SiteCard
from app.services import documents, invites, limits, sites

router = APIRouter(prefix="/invites", tags=["invites"])


@router.get("/{token}", response_model=InvitePreview)
async def preview(
    token: str,
    request: Request,
    db: Db,
    _: Annotated[User | None, Depends(current_user)],
) -> InvitePreview:
    await limits.hit(db, f"invite-view:{limits.client_ip(request)}", 60, limits.HOUR)
    invite, site, inviter = await invites.find(db, token)
    status = (
        "used"
        if invite.accepted_at
        else "expired"
        if invite.expires_at <= dt.datetime.now(dt.UTC)
        else "pending"
    )
    return InvitePreview(
        site_name=site.name,
        invited_by=inviter.name if inviter else None,
        email=invite.email,
        status=status,
        demo=bool(inviter and inviter.demo),
    )


@router.post("/{token}/accept", response_model=SiteCard)
async def accept(
    token: str, request: Request, db: Db, user: CurrentUser, settings: AppSettings
) -> SiteCard:
    await limits.hit(db, f"invite-accept:{limits.client_ip(request)}", 30, limits.HOUR)
    site = await invites.accept(db, token, user)
    access = await load_access(db, site.id, user)
    content = await documents.current_content(db, access.site)
    return sites.card(access.site, access.role, content, settings, user)

"""Request / response models (06 §C, §D). One module: the v1 contract is small."""

import uuid
from datetime import datetime
from typing import Any, Literal

from pydantic import ConfigDict, Field, field_validator

from app.schemas import ApiModel


class Health(ApiModel):
    ok: bool
    service: str
    version: str


# --- auth ---------------------------------------------------------------------------------------


class Me(ApiModel):
    id: uuid.UUID
    name: str
    email: str
    plan: Literal["free", "pro"]
    avatar_colour: str
    demo: bool


class SignUp(ApiModel):
    email: str = Field(max_length=254, pattern=r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
    password: str = Field(min_length=8, max_length=200)
    name: str = Field(min_length=1, max_length=80)

    @field_validator("email", mode="before")
    @classmethod
    def _strip_email(cls, value: object) -> object:
        return value.strip() if isinstance(value, str) else value


class SignIn(ApiModel):
    email: str = Field(min_length=3, max_length=254)
    password: str = Field(min_length=1, max_length=200)


class DemoSignIn(ApiModel):
    as_: Literal["creator", "collaborator"] = Field(alias="as")


class TeammateOut(ApiModel):
    """A session for the demo teammate, for one browser tab (sent as `x-pagecraft-session`)."""

    token: str
    me: Me


# --- templates ----------------------------------------------------------------------------------


class SiteContentModel(ApiModel):
    """`SiteContent` (06 §D) — validated in depth by `app.sections`, kept loose here."""

    site: dict[str, Any]
    sections: list[dict[str, Any]]


class TemplateOut(ApiModel):
    key: str
    name: str
    business: str
    description: str
    premium: bool
    locked: bool
    preview_url: str
    content: SiteContentModel


# --- sites --------------------------------------------------------------------------------------


Status = Literal["draft", "published"]
Role = Literal["owner", "editor"]


class SiteCard(ApiModel):
    id: uuid.UUID
    name: str
    template: str
    slug: str
    status: Status
    published_url: str | None
    published_version: int
    updated_at: datetime
    role: Role
    protected: bool
    # Theme + the first sections (nav, hero) — the dashboard renders a live mini hero (R1).
    preview: SiteContentModel


class Member(ApiModel):
    id: uuid.UUID
    name: str
    email: str
    role: Role
    avatar_colour: str


class SeoIn(ApiModel):
    title: str = Field(default="", max_length=70)
    description: str = Field(default="", max_length=160)
    og_image: str = Field(default="", max_length=300)


class SiteDetail(SiteCard):
    seo: SeoIn
    members: list[Member]
    published_at: datetime | None
    site_host: str


class SitesOut(ApiModel):
    sites: list[SiteCard]
    limit: int
    owned: int


class CreateSite(ApiModel):
    name: str = Field(min_length=1, max_length=60)
    template: str
    slug: str | None = Field(default=None, max_length=60)


class SlugCheck(ApiModel):
    slug: str
    available: bool
    reason: Literal["ok", "taken", "reserved", "invalid"]
    message: str
    suggestion: str | None


class PatchSite(ApiModel):
    name: str | None = Field(default=None, min_length=1, max_length=60)
    slug: str | None = Field(default=None, max_length=60)
    seo: SeoIn | None = None


class DocOut(ApiModel):
    snapshot: str  # base64 Yjs update ("" when `since` made it unnecessary)
    updates: list[str]
    seq: int


class UpdatesIn(ApiModel):
    updates: list[str] = Field(min_length=1, max_length=200)


class SeqOut(ApiModel):
    seq: int


class PublishIn(ApiModel):
    slug: str = Field(max_length=60)
    seo: SeoIn


class PublishOut(ApiModel):
    version: int
    slug: str
    url: str
    path: str


class UploadOut(ApiModel):
    url: str
    width: int
    height: int


# --- public -------------------------------------------------------------------------------------


class PublishedSite(ApiModel):
    slug: str
    version: int
    content: SiteContentModel
    seo: SeoIn
    plan: Literal["free", "pro"]
    template: str
    # Made in a landing-page demo sandbox: the page is noindexed and carries a banner (H1).
    demo: bool
    published_at: datetime


# --- presence (L2) ------------------------------------------------------------------------------


class Strict(ApiModel):
    model_config = ConfigDict(from_attributes=True, extra="forbid")


class YId(Strict):
    client: int = Field(ge=0, le=2**53)
    clock: int = Field(ge=0, le=2**53)


class RelPos(Strict):
    """`Y.relativePositionToJSON` output: where a caret sits, stable under concurrent edits."""

    type: YId | None = None
    tname: str | None = Field(default=None, max_length=40)
    item: YId | None = None
    assoc: int = Field(default=0, ge=-1, le=0)


class Caret(Strict):
    anchor: RelPos
    head: RelPos


class Pointer(Strict):
    s: str = Field(max_length=40)  # section id; x / y are fractions of that section's box
    x: float = Field(ge=0, le=1)
    y: float = Field(ge=0, le=1)


class PresenceState(Strict):
    section: str | None = Field(default=None, max_length=40)
    pointer: Pointer | None = None
    caret: Caret | None = None


class AwarenessIn(Strict):
    client: int = Field(ge=0, le=2**53)  # the tab's Y.Doc clientID
    n: int = Field(ge=1, le=2**53)  # the tab's post counter: later posts win
    state: PresenceState | None  # null = this tab is leaving


# --- invites, members, password reset (L4) ------------------------------------------------------


class InviteIn(ApiModel):
    email: str = Field(max_length=254, pattern=r"^\s*[^@\s]+@[^@\s]+\.[^@\s]+\s*$")


class InviteOut(ApiModel):
    id: uuid.UUID
    email: str
    expires_at: datetime


class InviteCreated(ApiModel):
    invite: InviteOut
    emailed: bool
    # Only when the email didn't go out (email is off, or a demo invite): for the owner to share.
    link: str | None


class InvitePreview(ApiModel):
    site_name: str
    invited_by: str | None
    email: str
    status: Literal["pending", "used", "expired"]
    demo: bool


class ForgotIn(ApiModel):
    email: str = Field(min_length=3, max_length=254)


class ForgotOut(ApiModel):
    # False: email is off, so no link can be sent (the screen says so; it never shows one).
    email_on: bool


class ResetIn(ApiModel):
    token: str = Field(min_length=10, max_length=100)
    password: str = Field(min_length=8, max_length=200)

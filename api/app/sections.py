"""The pydantic mirror of the section registry (`web/src/sections/`), used to validate a site's
document on publish (04 §2, §6). Hand-kept — the one duplicated contract.

Drift guard: `catalog_summary()` (types → variants, every field's kind and max length) is
compared with `tests/catalog.snapshot.json` by `tests/test_sections.py`, and the web compares
its own registry with the same file (`web/src/sections/catalog.test.ts`). Change a limit on one
side only and one of the two suites fails.

Shape (04 §2): `{ site: { name, theme, seo }, sections: [{ id, type, variant, props }] }`.
Text is plain (no HTML anywhere); links are `#anchor`, `http(s)://`, `mailto:` or `tel:`;
images are template photos (`/templates/…`), Pagecraft media (`/api/media/…`) or the Blob
store. Alt text is required whenever an image is set.
"""

import re
from typing import Annotated, Any, Literal

from pydantic import (
    AfterValidator,
    BaseModel,
    ConfigDict,
    Field,
    ValidationError,
    model_validator,
)

MAX_SECTIONS = 30

PALETTES = ("espresso", "blush", "paper", "iron", "graphite", "bistro", "sage", "midnight")
FONT_PAIRS = (
    "fraunces-inter",
    "playfair-karla",
    "dmserif-dmsans",
    "oswald-inter",
    "spacegrotesk-inter",
    "cormorant-manrope",
)
RADII = ("sharp", "soft", "round")
TONES = ("default", "surface", "accent")
ICONS = (
    "cup",
    "leaf",
    "clock",
    "wifi",
    "star",
    "heart",
    "scissors",
    "sparkle",
    "dumbbell",
    "bolt",
    "shield",
    "truck",
    "pin",
    "phone",
    "calendar",
    "chef",
    "wine",
    "palette",
    "pen",
    "camera",
    "check",
    "gift",
)

VARIANTS: dict[str, tuple[str, ...]] = {
    "nav": ("inline", "centered"),
    "hero": ("split", "full", "centered"),
    "features": ("grid-3", "icons", "rows"),
    "gallery": ("grid", "mosaic", "strip"),
    "testimonials": ("cards", "spotlight"),
    "pricing": ("cards", "table"),
    "faq": ("accordion", "two-column"),
    "contact": ("details", "split"),
    "cta": ("band", "card"),
    "footer": ("simple", "columns"),
}

_LINK_RE = re.compile(r"^(#[A-Za-z0-9_-]*|https?://[^\s<>\"]+|mailto:[^\s<>\"]+|tel:[+0-9 ()-]+)$")
_IMAGE_RE = re.compile(
    r"^(/templates/[A-Za-z0-9/_.-]+|/api/media/[A-Za-z0-9_.-]+"
    r"|https://[a-z0-9]+\.public\.blob\.vercel-storage\.com/[A-Za-z0-9/_.%-]+)$"
)
_ANCHOR_RE = re.compile(r"^[a-z0-9-]{0,40}$")
_ID_RE = re.compile(r"^[A-Za-z0-9_-]{1,40}$")


def _link(value: str) -> str:
    if value and not _LINK_RE.match(value):
        raise ValueError("Links must start with #, https://, mailto: or tel:")
    return value


def _image_url(value: str) -> str:
    if value and not _IMAGE_RE.match(value):
        raise ValueError("Images must be uploaded to Pagecraft or come from the template library")
    return value


def _anchor(value: str) -> str:
    if not _ANCHOR_RE.match(value):
        raise ValueError("Anchors are lower-case letters, digits and dashes")
    return value


def _item_id(value: str) -> str:
    if not _ID_RE.match(value):
        raise ValueError("Invalid id")
    return value


# Plain-text fields (a `Y.Text` in the document), by maximum length.
T24 = Annotated[str, Field(max_length=24)]
T32 = Annotated[str, Field(max_length=32)]
T40 = Annotated[str, Field(max_length=40)]
T60 = Annotated[str, Field(max_length=60)]
T70 = Annotated[str, Field(max_length=70)]
T80 = Annotated[str, Field(max_length=80)]
T90 = Annotated[str, Field(max_length=90)]
T120 = Annotated[str, Field(max_length=120)]
T140 = Annotated[str, Field(max_length=140)]
T160 = Annotated[str, Field(max_length=160)]
T200 = Annotated[str, Field(max_length=200)]
T220 = Annotated[str, Field(max_length=220)]
T240 = Annotated[str, Field(max_length=240)]
T280 = Annotated[str, Field(max_length=280)]
T320 = Annotated[str, Field(max_length=320)]
T400 = Annotated[str, Field(max_length=400)]
T600 = Annotated[str, Field(max_length=600)]
Href = Annotated[str, Field(max_length=300), AfterValidator(_link)]
ImageUrl = Annotated[str, Field(max_length=300), AfterValidator(_image_url)]
Anchor = Annotated[str, AfterValidator(_anchor)]
ItemId = Annotated[str, AfterValidator(_item_id)]
Tone = Literal["default", "surface", "accent"]
Icon = Literal[ICONS]  # type: ignore[valid-type]


class Strict(BaseModel):
    model_config = ConfigDict(extra="forbid")


class Link(Strict):
    label: T32 = ""
    href: Href = ""


class Image(Strict):
    url: ImageUrl = ""
    alt: T140 = ""

    @model_validator(mode="after")
    def _alt_required(self) -> "Image":
        if self.url and not self.alt.strip():
            raise ValueError("Every image needs alt text")
        return self


class NavLink(Strict):
    id: ItemId
    label: T32
    href: Href = ""


class Feature(Strict):
    id: ItemId
    icon: Icon = "star"  # pyright: ignore[reportInvalidTypeForm]
    title: T60
    body: T220 = ""
    meta: T32 = ""


class Photo(Strict):
    id: ItemId
    url: ImageUrl
    alt: T140
    caption: T80 = ""

    @model_validator(mode="after")
    def _alt_required(self) -> "Photo":
        if self.url and not self.alt.strip():
            raise ValueError("Every image needs alt text")
        return self


class Quote(Strict):
    id: ItemId
    quote: T320
    name: T60
    role: T60 = ""


class Plan(Strict):
    id: ItemId
    name: T40
    price: T24
    period: T24 = ""
    features: T400 = ""  # one per line
    cta: Link = Field(default_factory=Link)
    featured: bool = False


class Faq(Strict):
    id: ItemId
    question: T140
    answer: T600


class Common(Strict):
    anchor: Anchor = ""
    tone: Tone = "default"


class NavProps(Common):
    brand: T40
    links: list[NavLink] = Field(default_factory=list, max_length=6)
    cta: Link = Field(default_factory=Link)


class HeroProps(Common):
    eyebrow: T60 = ""
    headline: T90
    body: T280 = ""
    image: Image = Field(default_factory=Image)
    cta: Link = Field(default_factory=Link)
    cta2: Link = Field(default_factory=Link)


class FeaturesProps(Common):
    kicker: T40 = ""
    heading: T80
    intro: T240 = ""
    items: list[Feature] = Field(default_factory=list, max_length=12)


class GalleryProps(Common):
    kicker: T40 = ""
    heading: T80 = ""
    images: list[Photo] = Field(default_factory=list, max_length=12)


class TestimonialsProps(Common):
    kicker: T40 = ""
    heading: T80 = ""
    items: list[Quote] = Field(default_factory=list, max_length=9)


class PricingProps(Common):
    kicker: T40 = ""
    heading: T80
    intro: T240 = ""
    plans: list[Plan] = Field(default_factory=list, max_length=4)
    note: T160 = ""


class FaqProps(Common):
    kicker: T40 = ""
    heading: T80
    items: list[Faq] = Field(default_factory=list, max_length=12)


class ContactProps(Common):
    kicker: T40 = ""
    heading: T80
    body: T240 = ""
    address: T200 = ""
    hours: T200 = ""
    phone: T40 = ""
    email: T80 = ""
    cta: Link = Field(default_factory=Link)
    image: Image = Field(default_factory=Image)


class CtaProps(Common):
    heading: T90
    body: T200 = ""
    cta: Link = Field(default_factory=Link)


class FooterProps(Common):
    brand: T40
    tagline: T140 = ""
    links: list[NavLink] = Field(default_factory=list, max_length=8)
    note: T120 = ""


PROPS: dict[str, type[Common]] = {
    "nav": NavProps,
    "hero": HeroProps,
    "features": FeaturesProps,
    "gallery": GalleryProps,
    "testimonials": TestimonialsProps,
    "pricing": PricingProps,
    "faq": FaqProps,
    "contact": ContactProps,
    "cta": CtaProps,
    "footer": FooterProps,
}

SectionType = Literal[
    "nav",
    "hero",
    "features",
    "gallery",
    "testimonials",
    "pricing",
    "faq",
    "contact",
    "cta",
    "footer",
]


class Section(Strict):
    id: ItemId
    type: SectionType
    variant: str
    props: dict[str, Any]


class Theme(Strict):
    palette: Literal[PALETTES]  # type: ignore[valid-type]
    fonts: Literal[FONT_PAIRS]  # type: ignore[valid-type]
    radius: Literal[RADII]  # type: ignore[valid-type]


class Seo(Strict):
    title: T70 = ""
    description: T160 = ""
    og_image: ImageUrl = ""


class SiteMeta(Strict):
    name: T60
    theme: Theme
    seo: Seo


class SiteContent(Strict):
    site: SiteMeta
    sections: list[dict[str, Any]] = Field(max_length=MAX_SECTIONS)


class ContentError(ValueError):
    """Validation failure that names the section (06 §C: 422 `invalid_content`)."""

    def __init__(self, message: str, section_id: str | None = None, field: str | None = None):
        super().__init__(message)
        self.message = message
        self.section_id = section_id
        self.field = field


def _first_error(exc: ValidationError) -> tuple[str, str]:
    err = exc.errors()[0]
    path = ".".join(str(p) for p in err["loc"])
    msg = str(err["msg"]).removeprefix("Value error, ")
    return path, msg


def validate_content(content: Any) -> dict[str, Any]:
    """Validate a whole document export; returns it normalised (defaults filled in).

    Raises `ContentError` with the offending section's id, so the editor can select it."""
    try:
        doc = SiteContent.model_validate(content)
    except ValidationError as exc:
        path, msg = _first_error(exc)
        raise ContentError(f"{path}: {msg}", field=path) from exc

    seen: set[str] = set()
    sections: list[dict[str, Any]] = []
    for index, raw in enumerate(doc.sections):
        section_id = raw.get("id") if isinstance(raw, dict) else None
        sid = section_id if isinstance(section_id, str) else None
        try:
            section = Section.model_validate(raw)
        except ValidationError as exc:
            path, msg = _first_error(exc)
            raise ContentError(f"Section {index + 1}: {path} — {msg}", sid, path) from exc
        if section.id in seen:
            raise ContentError(f"Section id {section.id} is used twice", section.id, "id")
        seen.add(section.id)
        if section.variant not in VARIANTS[section.type]:
            raise ContentError(
                f"{section.type.capitalize()} has no “{section.variant}” layout",
                section.id,
                "variant",
            )
        try:
            props = PROPS[section.type].model_validate(section.props)
        except ValidationError as exc:
            path, msg = _first_error(exc)
            label = section.type.capitalize()
            raise ContentError(f"{label} · {path}: {msg}", section.id, path) from exc
        sections.append(
            {
                "id": section.id,
                "type": section.type,
                "variant": section.variant,
                "props": props.model_dump(),
            }
        )
    return {"site": doc.site.model_dump(), "sections": sections}


def shape_problem(content: dict[str, Any]) -> str | None:
    """The structure every reader relies on, checked on every save (H2). Content limits stay
    at publish: two people typing at once may briefly go over a length, never off-shape."""
    site, sections = content.get("site"), content.get("sections")
    if not isinstance(site, dict) or not isinstance(sections, list):
        return "The document must have a site and a list of sections"
    if not isinstance(site.get("name", ""), str):
        return "site.name must be text"
    for key in ("theme", "seo"):
        if not isinstance(site.get(key, {}), dict):
            return f"site.{key} must be a map"
    if not all(isinstance(v, str) for v in site.get("seo", {}).values()):
        return "site.seo values must be text"
    if len(sections) > 2 * MAX_SECTIONS:
        return f"A site has at most {MAX_SECTIONS} sections"
    for section in sections:
        if not (
            isinstance(section, dict)
            and all(isinstance(section.get(k), str) for k in ("id", "type", "variant"))
            and isinstance(section.get("props"), dict)
        ):
            return "Every section needs an id, a type, a variant and props"
    return None


# --- drift guard ---------------------------------------------------------------------------------


def _field_summary(model: type[BaseModel]) -> dict[str, Any]:
    out: dict[str, Any] = {}
    for name, field in model.model_fields.items():
        ann = field.annotation
        max_len = next((m.max_length for m in field.metadata if hasattr(m, "max_length")), None)
        if isinstance(ann, type) and issubclass(ann, BaseModel):
            out[name] = {"kind": "object", "fields": _field_summary(ann)}
        elif getattr(ann, "__origin__", None) is list:
            (inner,) = ann.__args__  # type: ignore[union-attr]
            out[name] = {"kind": "list", "max": max_len, "item": _field_summary(inner)}
        elif ann is bool:
            out[name] = {"kind": "bool"}
        elif getattr(ann, "__origin__", None) is Literal:
            out[name] = {"kind": "enum", "values": list(ann.__args__)}  # type: ignore[union-attr]
        else:
            out[name] = {"kind": "text", "max": max_len}
    return out


def catalog_summary() -> dict[str, Any]:
    """Everything the web registry must agree with, as plain JSON."""
    return {
        "palettes": list(PALETTES),
        "fonts": list(FONT_PAIRS),
        "radii": list(RADII),
        "icons": list(ICONS),
        "max_sections": MAX_SECTIONS,
        "sections": {
            t: {"variants": list(VARIANTS[t]), "props": _field_summary(PROPS[t])} for t in PROPS
        },
    }

"""The error envelope as contract models — only for the OpenAPI document (06 §C)."""

from typing import Any

from pydantic import Field
from pydantic.json_schema import SkipJsonSchema

from app.schemas import ApiModel


class ApiErrorBody(ApiModel):
    code: str = Field(
        description="`validation` · `unauthorized` · `forbidden` · `not_found` · `conflict` · "
        "`rate_limited` · `unavailable` · `internal`, plus business codes such as "
        "`slug_taken` (409), `reserved_slug` (422), `invalid_content` (422), `plan_limit` (402), "
        "`file_too_large` (413), `unsupported_type` (415)."
    )
    message: str
    # Optional but never null on the wire (the handlers omit the key), hence SkipJsonSchema.
    details: dict[str, Any] | SkipJsonSchema[None] = Field(
        default=None,
        description="Code-specific payload, e.g. `{suggestion: 'kaapi-corner-2'}`, "
        "`{section_id, field}` or `{fields: {path: msg}}`.",
    )


class ApiErrorResponse(ApiModel):
    error: ApiErrorBody

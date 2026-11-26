"""pydantic v2 request/response models — the API contract (05 §2).

Field names are snake_case on the wire, exactly as docs/06-data-and-api.md §C/§D write them;
`web/src/lib/api-types.ts` is generated from the OpenAPI document (`pnpm gen:api`).
"""

from pydantic import BaseModel, ConfigDict


class ApiModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)

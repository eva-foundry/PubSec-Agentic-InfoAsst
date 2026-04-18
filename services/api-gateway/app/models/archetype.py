from __future__ import annotations

from pydantic import BaseModel, Field


class ArchetypeDefinition(BaseModel):
    """A workspace archetype — a bilingual template of retrieval + assurance
    defaults that new workspaces can be provisioned from.

    Archetypes are template metadata, not workspace instances. Keeping them
    server-side lets ops add or retire archetypes without a UI release.
    """

    key: str = Field(description="Stable identifier, e.g. 'kb', 'policy', 'case', 'bi', 'decision'")
    name: str
    name_fr: str = ""
    description: str = ""
    description_fr: str = ""
    assurance: str = Field(description="'Advisory' or 'Decision-informing'")
    cost_band: str = Field(description="Human-readable monthly cost band, e.g. '$49-$120/mo'")
    sample_questions: list[str] = Field(default_factory=list)
    sample_questions_fr: list[str] = Field(default_factory=list)
    default_capacity: int = Field(
        default=0,
        ge=0,
        description="Default document_capacity for workspaces of this archetype",
    )

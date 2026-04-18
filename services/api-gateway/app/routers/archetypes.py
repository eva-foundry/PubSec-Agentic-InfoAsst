"""Archetype catalog endpoint (template metadata for workspace provisioning)."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException

from ..auth import UserContext, get_current_user
from ..models.archetype import ArchetypeDefinition
from ..stores import archetype_store

router = APIRouter()


@router.get("/archetypes")
async def list_archetypes(
    _user: UserContext = Depends(get_current_user),
) -> list[ArchetypeDefinition]:
    """Return the catalog of workspace archetypes (bilingual template metadata)."""
    return archetype_store.list()


@router.get("/archetypes/{key}")
async def get_archetype(
    key: str,
    _user: UserContext = Depends(get_current_user),
) -> ArchetypeDefinition:
    """Return a single archetype definition by stable key."""
    archetype = archetype_store.get(key)
    if archetype is None:
        raise HTTPException(status_code=404, detail=f"Archetype '{key}' not found")
    return archetype

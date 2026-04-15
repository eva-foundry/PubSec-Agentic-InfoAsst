"""Strategy factory — selects a chunking strategy based on workspace archetype."""

from __future__ import annotations

from .base import ChunkingStrategy
from .case_law import CaseLawChunkingStrategy
from .default import DefaultChunkingStrategy
from .legislation import LegislationChunkingStrategy

STRATEGY_MAP: dict[str, type[ChunkingStrategy]] = {
    "default": DefaultChunkingStrategy,
    "legislation": LegislationChunkingStrategy,
    "case_law": CaseLawChunkingStrategy,
}


def get_chunking_strategy(
    archetype: str,
    target_size: int = 1500,
) -> ChunkingStrategy:
    """Return a chunking strategy instance for the given *archetype*.

    Falls back to ``DefaultChunkingStrategy`` for unknown archetypes.
    """
    strategy_class = STRATEGY_MAP.get(archetype, DefaultChunkingStrategy)
    return strategy_class(target_size=target_size)

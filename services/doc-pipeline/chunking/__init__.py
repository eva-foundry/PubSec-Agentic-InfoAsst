"""Archetype-configurable chunking engine.

Re-exports the public API so consumers can do::

    from chunking import Chunk, ChunkMetadata, ChunkingStrategy, get_chunking_strategy
"""

from .base import Chunk, ChunkMetadata, ChunkingStrategy
from .factory import get_chunking_strategy

__all__ = [
    "Chunk",
    "ChunkMetadata",
    "ChunkingStrategy",
    "get_chunking_strategy",
]

"""Abstract base class and data structures for chunking strategies."""

from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass, field

import tiktoken

# Module-level singleton to avoid re-instantiating the encoder on every call.
_ENCODER = tiktoken.get_encoding("cl100k_base")


@dataclass
class ChunkMetadata:
    """Metadata attached to every chunk produced by a chunking strategy."""

    file_name: str
    file_uri: str
    file_class: str  # "text" | "image" | "email"
    title: str
    subtitle: str
    section: str
    pages: list[int] = field(default_factory=list)
    token_count: int = 0
    chunk_index: int = 0


@dataclass
class Chunk:
    """A single chunk of document content with associated metadata."""

    content: str
    metadata: ChunkMetadata


class ChunkingStrategy(ABC):
    """Base class for all chunking strategies.

    Sub-classes implement ``chunk()`` to split a *document map* (a list of
    paragraph dicts produced by the extraction layer) into a list of
    ``Chunk`` objects whose token counts stay at or near ``target_size``.
    """

    def __init__(self, target_size: int = 1500) -> None:
        self.target_size = target_size

    @abstractmethod
    def chunk(
        self,
        document_map: list[dict],
        file_name: str,
        file_uri: str,
    ) -> list[Chunk]:
        """Split a document map into chunks.

        Parameters
        ----------
        document_map:
            List of paragraph dicts.  Each dict has at minimum the keys
            ``text``, ``type`` (``"text"`` | ``"table"``), ``title``,
            ``subtitle``, ``section``, and ``page_number``.
        file_name:
            The source file name (e.g. blob path).
        file_uri:
            The source file URI.

        Returns
        -------
        list[Chunk]
        """
        ...

    @staticmethod
    def token_count(text: str) -> int:
        """Return the number of tokens in *text* using the cl100k_base encoding."""
        return len(_ENCODER.encode(text))

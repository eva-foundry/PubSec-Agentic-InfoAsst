"""In-memory vector store with cosine similarity search.

Replaced by Azure AI Search in production — same interface.
"""

from __future__ import annotations

import math
from dataclasses import dataclass, field


@dataclass
class VectorDocument:
    """A single embedded chunk stored in the vector index."""

    id: str
    workspace_id: str
    file_name: str
    chunk_index: int
    content: str
    embedding: list[float]
    title: str = ""
    section: str = ""
    pages: list[int] = field(default_factory=list)
    last_verified: str = ""


class VectorStore:
    """In-memory vector store using brute-force cosine similarity.

    Documents are partitioned by *workspace_id* so searches are
    automatically scoped to the correct workspace.
    """

    def __init__(self) -> None:
        self._documents: dict[str, list[VectorDocument]] = {}  # workspace_id -> docs

    def add_documents(self, workspace_id: str, docs: list[VectorDocument]) -> int:
        """Add documents to the store. Returns the number added."""
        if workspace_id not in self._documents:
            self._documents[workspace_id] = []
        self._documents[workspace_id].extend(docs)
        return len(docs)

    def search(
        self,
        workspace_id: str,
        query_embedding: list[float],
        top_k: int = 5,
    ) -> list[dict]:
        """Cosine similarity search. Returns results sorted by relevance (descending)."""
        docs = self._documents.get(workspace_id, [])
        if not docs:
            return []

        scored: list[tuple[float, VectorDocument]] = []
        for doc in docs:
            score = self._cosine_similarity(query_embedding, doc.embedding)
            scored.append((score, doc))

        scored.sort(key=lambda x: x[0], reverse=True)

        results: list[dict] = []
        for score, doc in scored[:top_k]:
            results.append({
                "id": doc.id,
                "file": doc.file_name,
                "content": doc.content,
                "relevance_score": round(score, 4),
                "page": doc.pages[0] if doc.pages else 0,
                "section": doc.section,
                "title": doc.title,
                "chunk_index": doc.chunk_index,
            })
        return results

    def delete_by_file(self, workspace_id: str, file_name: str) -> int:
        """Remove all chunks for a given file. Returns count removed."""
        docs = self._documents.get(workspace_id, [])
        if not docs:
            return 0
        before = len(docs)
        self._documents[workspace_id] = [
            d for d in docs if d.file_name != file_name
        ]
        return before - len(self._documents[workspace_id])

    def document_count(self, workspace_id: str) -> int:
        """Return the number of chunks stored for a workspace."""
        return len(self._documents.get(workspace_id, []))

    def list_files(self, workspace_id: str) -> list[str]:
        """Return unique file names stored for a workspace."""
        docs = self._documents.get(workspace_id, [])
        seen: set[str] = set()
        result: list[str] = []
        for d in docs:
            if d.file_name not in seen:
                seen.add(d.file_name)
                result.append(d.file_name)
        return result

    def get_chunks_by_file(self, file_name: str, workspace_id: str | None = None) -> list[VectorDocument]:
        """Return all chunks for a file, optionally scoped to a workspace."""
        result: list[VectorDocument] = []
        workspaces = [workspace_id] if workspace_id else list(self._documents.keys())
        for ws_id in workspaces:
            for doc in self._documents.get(ws_id, []):
                if doc.file_name == file_name or doc.id == file_name or file_name in doc.file_name:
                    result.append(doc)
        return sorted(result, key=lambda d: d.chunk_index)

    def get_all_workspace_ids(self) -> list[str]:
        """Return all workspace IDs that have documents."""
        return list(self._documents.keys())

    @staticmethod
    def _cosine_similarity(a: list[float], b: list[float]) -> float:
        """Compute cosine similarity between two vectors."""
        dot = sum(x * y for x, y in zip(a, b))
        norm_a = math.sqrt(sum(x * x for x in a))
        norm_b = math.sqrt(sum(x * x for x in b))
        if norm_a == 0 or norm_b == 0:
            return 0.0
        return dot / (norm_a * norm_b)

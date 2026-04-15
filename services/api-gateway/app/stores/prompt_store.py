"""In-memory prompt versioning store. Replaced by Cosmos DB adapter in production."""

from __future__ import annotations

import uuid
from datetime import datetime, timezone

from ..models.admin import PromptVersion


class PromptStore:
    """In-memory store for versioned system prompts with activation tracking."""

    def __init__(self) -> None:
        self._prompts: dict[str, list[PromptVersion]] = {}  # name -> versions
        self._seed()

    def _seed(self) -> None:
        """Seed with default system prompts."""
        seeds = [
            (
                "rag-system",
                "You are a Government of Canada assistant. Answer questions using ONLY "
                "the provided context documents. Always cite your sources with document "
                "name and section. If the context does not contain the answer, say so.",
                "Initial RAG system prompt",
            ),
            (
                "ungrounded-system",
                "You are a helpful Government of Canada assistant. Provide clear, "
                "accurate, and bilingual-ready responses. Always note when your answer "
                "is based on general knowledge rather than specific documents.",
                "Initial ungrounded chat prompt",
            ),
            (
                "query-rewrite",
                "Rewrite the user's question into 3 search queries optimized for "
                "hybrid retrieval (keyword + semantic). Return as a JSON array of strings. "
                "Consider synonyms, acronyms, and bilingual terms.",
                "Initial query rewrite prompt",
            ),
        ]
        now = datetime.now(timezone.utc).isoformat()
        for name, content, rationale in seeds:
            pv = PromptVersion(
                id=str(uuid.uuid4()),
                prompt_name=name,
                version=1,
                content=content,
                author="system",
                rationale=rationale,
                created_at=now,
                is_active=True,
            )
            self._prompts[name] = [pv]

    def list_prompts(self) -> list[dict]:
        """Return the latest version of each prompt."""
        result = []
        for name, versions in self._prompts.items():
            active = self.get_active(name)
            latest = versions[-1]
            result.append({
                "prompt_name": name,
                "latest_version": latest.version,
                "active_version": active.version if active else None,
                "total_versions": len(versions),
            })
        return result

    def get_versions(self, prompt_name: str) -> list[PromptVersion]:
        """Return all versions of a prompt, ordered by version number."""
        return list(self._prompts.get(prompt_name, []))

    def get_active(self, prompt_name: str) -> PromptVersion | None:
        """Return the currently active version of a prompt."""
        for pv in self._prompts.get(prompt_name, []):
            if pv.is_active:
                return pv
        return None

    def create_version(
        self, prompt_name: str, content: str, author: str, rationale: str
    ) -> PromptVersion:
        """Create a new version of a prompt, making it the active one."""
        versions = self._prompts.setdefault(prompt_name, [])
        # Deactivate all existing versions
        deactivated = []
        for pv in versions:
            if pv.is_active:
                data = pv.model_dump()
                data["is_active"] = False
                deactivated.append(PromptVersion(**data))
            else:
                deactivated.append(pv)
        next_version = max((pv.version for pv in versions), default=0) + 1
        new_pv = PromptVersion(
            id=str(uuid.uuid4()),
            prompt_name=prompt_name,
            version=next_version,
            content=content,
            author=author,
            rationale=rationale,
            created_at=datetime.now(timezone.utc).isoformat(),
            is_active=True,
        )
        deactivated.append(new_pv)
        self._prompts[prompt_name] = deactivated
        return new_pv

    def rollback(self, prompt_name: str, version: int) -> PromptVersion | None:
        """Activate a specific version, deactivating all others. Returns None if not found."""
        versions = self._prompts.get(prompt_name)
        if not versions:
            return None
        target = None
        updated = []
        for pv in versions:
            data = pv.model_dump()
            if pv.version == version:
                data["is_active"] = True
                target = PromptVersion(**data)
                updated.append(target)
            else:
                data["is_active"] = False
                updated.append(PromptVersion(**data))
        if target is None:
            return None
        self._prompts[prompt_name] = updated
        return target

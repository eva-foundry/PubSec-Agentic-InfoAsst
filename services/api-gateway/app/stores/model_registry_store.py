"""In-memory model registry store. Replaced by Cosmos DB adapter in production."""

from __future__ import annotations

from ..models.admin import ModelConfig


class ModelRegistryStore:
    """In-memory store for AI model configurations seeded with P75 Azure OpenAI models."""

    def __init__(self) -> None:
        self._models: dict[str, ModelConfig] = {}
        self._seed()

    def _seed(self) -> None:
        """Pre-populate with Azure OpenAI models from P75 infrastructure."""
        seed = [
            ModelConfig(
                id="model-gpt5-mini",
                model_name="gpt-5-mini",
                provider="Azure OpenAI",
                deployment_name="gpt-5-mini",
                capabilities=["chat", "function-calling"],
                classification_ceiling="protected_b",
                parameter_overrides={"temperature": 0.1, "max_tokens": 32000},
                is_active=True,
                access_grants=["all"],
            ),
            ModelConfig(
                id="model-gpt5.1",
                model_name="gpt-5.1",
                provider="Azure OpenAI",
                deployment_name="gpt-5-1",
                capabilities=["chat", "function-calling", "vision", "reasoning"],
                classification_ceiling="protected_b",
                parameter_overrides={"temperature": 0.0, "max_tokens": 128000},
                is_active=True,
                access_grants=["all"],
            ),
            ModelConfig(
                id="model-embed-ada-002",
                model_name="text-embedding-ada-002",
                provider="Azure OpenAI",
                deployment_name="text-embedding-ada-002",
                capabilities=["embeddings"],
                classification_ceiling="protected_b",
                parameter_overrides={},
                is_active=True,
                access_grants=["all"],
            ),
            ModelConfig(
                id="model-embed-3-large",
                model_name="text-embedding-3-large",
                provider="Azure OpenAI",
                deployment_name="text-embedding-3-large",
                capabilities=["embeddings"],
                classification_ceiling="protected_b",
                parameter_overrides={"dimensions": 3072},
                is_active=True,
                access_grants=["all"],
            ),
        ]
        for m in seed:
            self._models[m.id] = m

    def list_models(self) -> list[ModelConfig]:
        """Return all registered models."""
        return list(self._models.values())

    def get_model(self, model_id: str) -> ModelConfig | None:
        """Look up a model by ID."""
        return self._models.get(model_id)

    def update_model(self, model_id: str, updates: dict) -> ModelConfig | None:
        """Partially update a model config. Returns None if not found."""
        m = self._models.get(model_id)
        if m is None:
            return None
        data = m.model_dump()
        data.update(updates)
        updated = ModelConfig(**data)
        self._models[model_id] = updated
        return updated

    def toggle_model(self, model_id: str, is_active: bool) -> ModelConfig | None:
        """Enable or disable a model. Returns None if not found."""
        return self.update_model(model_id, {"is_active": is_active})

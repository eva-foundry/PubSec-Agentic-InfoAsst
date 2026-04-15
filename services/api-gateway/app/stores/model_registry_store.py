"""In-memory model registry store. Replaced by Cosmos DB adapter in production."""

from __future__ import annotations

from ..models.admin import ModelConfig


class ModelRegistryStore:
    """In-memory store for AI model configurations seeded with P75 Azure OpenAI models."""

    def __init__(self) -> None:
        self._models: dict[str, ModelConfig] = {}
        self._seed()

    def _seed(self) -> None:
        """Pre-populate with real MarcoSub Azure OpenAI deployments."""
        seed = [
            ModelConfig(
                id="chat-default",
                model_name="gpt-5-mini",
                provider="azure-openai",
                deployment_name="chat-default",
                capabilities=["chat", "function-calling", "streaming"],
                classification_ceiling="protected_b",
                parameter_overrides={"max_completion_tokens": 4096},
                is_active=True,
                access_grants=["all"],
                endpoint="https://msub-eva-dev-openai.openai.azure.com/",
                location="canadaeast",
                sku="GlobalStandard",
                capacity=60,
                model_version="2025-08-07",
            ),
            ModelConfig(
                id="reasoning-premium",
                model_name="gpt-5.1",
                provider="azure-openai",
                deployment_name="reasoning-premium",
                capabilities=["chat", "reasoning", "analysis", "function-calling", "streaming"],
                classification_ceiling="protected_b",
                parameter_overrides={"max_completion_tokens": 8192},
                is_active=True,
                access_grants=["ws-oas-act", "ws-ei-juris"],
                endpoint="https://msub-eva-dev-openai.openai.azure.com/",
                location="canadaeast",
                sku="GlobalStandard",
                capacity=40,
                model_version="2025-11-13",
            ),
            ModelConfig(
                id="embeddings-default",
                model_name="text-embedding-3-small",
                provider="azure-openai",
                deployment_name="embeddings-default",
                capabilities=["embeddings"],
                classification_ceiling="protected_b",
                parameter_overrides={},
                is_active=True,
                access_grants=["all"],
                endpoint="https://msub-eva-dev-openai.openai.azure.com/",
                location="canadaeast",
                sku="Standard",
                capacity=80,
                model_version="1",
            ),
            # --- BYOK sandbox (msub-vscbyok78-openai-ce) ---
            ModelConfig(
                id="chat-main-byok",
                model_name="gpt-4.1-mini",
                provider="azure-openai",
                deployment_name="chat-main",
                capabilities=["chat", "function-calling", "streaming"],
                classification_ceiling="protected_b",
                parameter_overrides={},
                is_active=False,
                access_grants=[],
                endpoint="https://msub-vscbyok78-openai-ce.openai.azure.com/",
                location="canadaeast",
                sku="GlobalStandard",
                capacity=1,
                model_version="2025-04-14",
                status="deployed",
                cost_model="pay-as-you-go",
            ),
            ModelConfig(
                id="chat-nano-byok",
                model_name="gpt-4.1-nano",
                provider="azure-openai",
                deployment_name="chat-nano",
                capabilities=["chat", "streaming"],
                classification_ceiling="protected_a",
                parameter_overrides={},
                is_active=False,
                access_grants=[],
                endpoint="https://msub-vscbyok78-openai-ce.openai.azure.com/",
                location="canadaeast",
                sku="GlobalStandard",
                capacity=1,
                model_version="2025-04-14",
                status="deployed",
                cost_model="pay-as-you-go",
            ),
            # --- Catalog models (available to deploy) ---
            ModelConfig(
                id="catalog-o4-mini",
                model_name="o4-mini",
                provider="azure-openai-catalog",
                deployment_name="",
                capabilities=["chat", "reasoning", "analysis"],
                classification_ceiling="protected_b",
                parameter_overrides={},
                is_active=False,
                access_grants=[],
                endpoint="",
                location="canadaeast",
                sku="GlobalStandard",
                capacity=0,
                model_version="2025-04-16",
                status="available",
                cost_model="pay-as-you-go",
            ),
            ModelConfig(
                id="catalog-embedding-large",
                model_name="text-embedding-3-large",
                provider="azure-openai-catalog",
                deployment_name="",
                capabilities=["embeddings"],
                classification_ceiling="protected_b",
                parameter_overrides={},
                is_active=False,
                access_grants=[],
                endpoint="",
                location="canadaeast",
                sku="Standard",
                capacity=0,
                model_version="1",
                status="available",
                cost_model="pay-as-you-go",
            ),
            # --- Serverless / local models (Foundry marketplace) ---
            ModelConfig(
                id="foundry-phi-4",
                model_name="Phi-4",
                provider="azure-foundry-serverless",
                deployment_name="",
                capabilities=["chat", "function-calling"],
                classification_ceiling="protected_b",
                parameter_overrides={},
                is_active=False,
                access_grants=[],
                endpoint="",
                location="canadaeast",
                sku="Serverless",
                capacity=0,
                model_version="latest",
                status="available",
                cost_model="serverless",
            ),
            ModelConfig(
                id="foundry-mistral-large",
                model_name="Mistral-Large-2",
                provider="azure-foundry-serverless",
                deployment_name="",
                capabilities=["chat", "function-calling", "streaming", "reasoning"],
                classification_ceiling="protected_b",
                parameter_overrides={},
                is_active=False,
                access_grants=[],
                endpoint="",
                location="canadaeast",
                sku="Serverless",
                capacity=0,
                model_version="latest",
                status="available",
                cost_model="serverless",
            ),
            ModelConfig(
                id="foundry-llama-3.1-70b",
                model_name="Meta-Llama-3.1-70B-Instruct",
                provider="azure-foundry-serverless",
                deployment_name="",
                capabilities=["chat", "streaming"],
                classification_ceiling="protected_b",
                parameter_overrides={},
                is_active=False,
                access_grants=[],
                endpoint="",
                location="canadaeast",
                sku="Serverless",
                capacity=0,
                model_version="latest",
                status="available",
                cost_model="serverless",
            ),
            # --- Provisioned / PTU option ---
            ModelConfig(
                id="ptu-gpt5-mini",
                model_name="gpt-5-mini (Provisioned)",
                provider="azure-openai",
                deployment_name="",
                capabilities=["chat", "function-calling", "streaming"],
                classification_ceiling="protected_b",
                parameter_overrides={"max_completion_tokens": 4096},
                is_active=False,
                access_grants=[],
                endpoint="https://msub-eva-dev-openai.openai.azure.com/",
                location="canadaeast",
                sku="ProvisionedManaged",
                capacity=0,
                model_version="2025-08-07",
                status="available",
                cost_model="provisioned",
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

from functools import lru_cache

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    app_name: str = "EVA Agentic API Gateway"
    debug: bool = False

    # --- Feature toggle ---
    # true  = in-memory stores, mock embeddings (no Azure credentials needed)
    # false = Cosmos DB, Azure AI Search, Azure OpenAI (requires credentials)
    api_mock: bool = True

    # --- Azure OpenAI ---
    azure_openai_endpoint: str = ""
    azure_openai_api_key: str = ""
    azure_openai_deployment: str = "chat-default"
    azure_openai_api_version: str = "2024-12-01-preview"
    azure_openai_embedding_deployment: str = "embeddings-default"

    # --- Azure AI Search ---
    azure_search_endpoint: str = ""
    azure_search_api_key: str = ""
    azure_search_index_prefix: str = "eva-workspace"

    # --- Cosmos DB ---
    cosmos_endpoint: str = ""
    cosmos_key: str = ""
    cosmos_database_workspaces: str = "eva-workspaces"
    cosmos_database_platform: str = "eva-platform"
    cosmos_database_status: str = "statusdb"

    # --- Azure Blob Storage ---
    azure_storage_connection_string: str = ""
    azure_storage_container_prefix: str = "eva-workspace"

    # --- APIM ---
    apim_gateway_url: str = ""

    # --- Auth ---
    auth_mode: str = "demo"  # "demo" | "production"
    # Entra ID SSO
    entra_tenant_id: str = ""
    entra_client_id: str = ""
    entra_authority: str = ""
    entra_group_admin: str = ""
    entra_group_contributor: str = ""
    entra_group_reader: str = ""
    entra_group_ops: str = ""

    # --- Azure Content Safety ---
    content_safety_endpoint: str = ""
    content_safety_key: str = ""

    # --- Observability ---
    appinsights_connection_string: str = ""

    model_config = {"env_prefix": "EVA_", "env_file": ".env", "env_file_encoding": "utf-8"}


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()

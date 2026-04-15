from functools import lru_cache

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    app_name: str = "EVA Agentic API Gateway"
    debug: bool = False
    azure_openai_endpoint: str = ""
    azure_openai_api_key: str = ""
    azure_openai_deployment: str = "chat-default"
    azure_openai_api_version: str = "2024-12-01-preview"
    azure_openai_embedding_deployment: str = "embeddings-default"
    azure_search_endpoint: str = ""
    azure_search_api_key: str = ""
    cosmos_endpoint: str = ""
    cosmos_key: str = ""
    apim_gateway_url: str = ""
    auth_mode: str = "demo"  # "demo" | "production"

    model_config = {"env_prefix": "EVA_", "env_file": ".env", "env_file_encoding": "utf-8"}


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()

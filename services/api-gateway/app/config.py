from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    app_name: str = "EVA Agentic API Gateway"
    debug: bool = False
    azure_openai_endpoint: str = ""
    azure_openai_api_key: str = ""
    azure_search_endpoint: str = ""
    azure_search_api_key: str = ""
    cosmos_endpoint: str = ""
    cosmos_key: str = ""
    apim_gateway_url: str = ""
    auth_mode: str = "demo"  # "demo" | "production"

    model_config = {"env_prefix": "EVA_"}


settings = Settings()

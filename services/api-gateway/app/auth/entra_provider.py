from .models import UserContext


async def validate_token(token: str) -> UserContext:
    """Validate Entra ID JWT and extract user context. Not implemented in demo mode."""
    raise NotImplementedError(
        "Entra ID auth not configured. Set AUTH_MODE=production and provide ENTRA_* env vars."
    )

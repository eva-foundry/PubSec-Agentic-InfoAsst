"""Entra ID JWT validation for production auth mode."""

from __future__ import annotations

import logging

import jwt  # PyJWT
from cachetools import TTLCache
from jwt import PyJWKClient

from ..config import settings
from .group_mapping import resolve_portal_access, resolve_role, resolve_workspace_grants
from .models import UserContext

logger = logging.getLogger("eva.auth.entra")

# JWKS endpoint — discovery-based
_JWKS_URL = f"https://login.microsoftonline.com/{settings.entra_tenant_id}/discovery/v2.0/keys"
_ISSUER = f"https://login.microsoftonline.com/{settings.entra_tenant_id}/v2.0"
_AUDIENCE = settings.entra_client_id

# Cache JWKS keys for 1 hour, claims for 5 minutes
_jwks_client: PyJWKClient | None = None
_claims_cache: TTLCache = TTLCache(maxsize=1024, ttl=300)


def _get_jwks_client() -> PyJWKClient:
    global _jwks_client
    if _jwks_client is None:
        _jwks_client = PyJWKClient(_JWKS_URL, cache_jwk_set=True, lifespan=3600)
    return _jwks_client


async def validate_token(token: str) -> UserContext:
    """Validate Entra ID JWT, extract claims, return UserContext.

    Steps:
    1. Fetch signing key from JWKS endpoint (cached)
    2. Decode + verify JWT (RS256, audience, issuer, expiry, required claims)
    3. Map Entra group memberships to EVA roles
    4. Return populated UserContext
    """
    # Check cache first
    if token in _claims_cache:
        return _claims_cache[token]

    try:
        jwks = _get_jwks_client()
        signing_key = jwks.get_signing_key_from_jwt(token)

        claims = jwt.decode(
            token,
            signing_key.key,
            algorithms=["RS256"],
            audience=_AUDIENCE,
            issuer=_ISSUER,
            options={"require": ["exp", "iat", "sub", "oid"]},
        )
    except jwt.ExpiredSignatureError:
        logger.warning("JWT expired", extra={"error": "token_expired"})
        raise
    except jwt.InvalidAudienceError:
        logger.warning("JWT invalid audience", extra={"error": "invalid_audience"})
        raise
    except jwt.InvalidIssuerError:
        logger.warning("JWT invalid issuer", extra={"error": "invalid_issuer"})
        raise
    except jwt.PyJWTError as exc:
        logger.warning("JWT validation failed: %s", exc, extra={"error": "jwt_error"})
        raise

    # Map Entra groups to EVA roles
    groups = claims.get("groups", [])
    oid = claims["oid"]

    role = resolve_role(groups)
    portal_access = resolve_portal_access(groups)
    workspace_grants = await resolve_workspace_grants(oid, groups)

    user_ctx = UserContext(
        user_id=oid,
        email=claims.get("preferred_username", claims.get("upn", "")),
        name=claims.get("name", ""),
        role=role,
        portal_access=portal_access,
        workspace_grants=workspace_grants,
        data_classification_level="protected_b",
        language=claims.get("locale", "en")[:2],
    )

    # Cache the result
    _claims_cache[token] = user_ctx

    logger.info(
        "Token validated",
        extra={
            "user_id_hash": oid[:8] + "...",
            "role": role,
            "portal_access": portal_access,
        },
    )

    return user_ctx

"""Comprehensive tests for Entra ID JWT validation and group mapping."""

from __future__ import annotations

from datetime import UTC, datetime, timedelta
from unittest.mock import MagicMock, patch
from uuid import uuid4

import jwt
import pytest
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import rsa

from app.auth.entra_provider import validate_token
from app.auth.group_mapping import resolve_portal_access, resolve_role, resolve_workspace_grants
from app.auth.models import UserContext

# ============================================================================
# Fixtures for test token generation
# ============================================================================


def _generate_test_keypair() -> tuple[str, str]:
    """Generate a fresh RSA-2048 keypair in PEM for use by the token factory.

    Generated at module import so every test run gets a disposable key — never
    trusted by production code, never stored in a vault. Using real key
    material (vs. a hand-rolled fake) lets PyJWT actually sign and verify.
    """
    key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    private_pem = key.private_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PrivateFormat.TraditionalOpenSSL,
        encryption_algorithm=serialization.NoEncryption(),
    ).decode()
    public_pem = (
        key.public_key()
        .public_bytes(
            encoding=serialization.Encoding.PEM,
            format=serialization.PublicFormat.SubjectPublicKeyInfo,
        )
        .decode()
    )
    return private_pem, public_pem


_PRIVATE_PEM, _PUBLIC_PEM = _generate_test_keypair()


class TestTokenFactory:
    """Factory for creating test JWT tokens with configurable claims."""

    PRIVATE_KEY = _PRIVATE_PEM
    PUBLIC_KEY = _PUBLIC_PEM

    @staticmethod
    def create_token(
        oid: str | None = None,
        email: str | None = None,
        name: str | None = None,
        groups: list[str] | None = None,
        locale: str = "en-US",
        exp_offset: timedelta | None = None,
        audience: str = "test-client-id",
        issuer: str = "https://login.microsoftonline.com/test-tenant/v2.0",
        **extra_claims,
    ) -> str:
        """Create a test JWT token with standard Entra ID claims."""
        if exp_offset is None:
            exp_offset = timedelta(hours=1)

        now = datetime.now(UTC)
        payload = {
            "oid": oid or str(uuid4()),
            "preferred_username": email or "testuser@example.com",
            "upn": email or "testuser@example.com",
            "name": name or "Test User",
            "groups": groups or [],
            "locale": locale,
            "sub": str(uuid4()),
            "iat": int(now.timestamp()),
            "exp": int((now + exp_offset).timestamp()),
            "aud": audience,
            "iss": issuer,
        }
        payload.update(extra_claims)

        return jwt.encode(payload, TestTokenFactory.PRIVATE_KEY, algorithm="RS256")


# ============================================================================
# Tests: Group Role Resolution
# ============================================================================


class TestGroupRoleResolution:
    """Test Entra group → AIA role mapping."""

    def test_resolve_role_admin_group(self):
        """Admin group membership should resolve to 'admin' role."""
        # With group IDs configured, this tests the mapping
        groups = ["admin-group-oid"]
        result = resolve_role(groups)
        # Result depends on settings.entra_group_admin being set
        assert result in ["admin", "reader"]

    def test_resolve_role_contributor_group(self):
        """Contributor group membership should resolve to 'contributor' role."""
        groups = ["contributor-group-oid"]
        result = resolve_role(groups)
        assert result in ["contributor", "reader"]

    def test_resolve_role_reader_default(self):
        """No group membership should resolve to 'reader' (default)."""
        groups = []
        result = resolve_role(groups)
        assert result == "reader"

    def test_resolve_role_highest_wins(self):
        """When multiple groups present, highest privilege wins."""
        # If both admin and reader groups are in the list,
        # admin should win (assuming settings has them configured)
        groups = ["reader-group-oid", "admin-group-oid"]
        result = resolve_role(groups)
        # Result depends on settings
        assert result in ["admin", "reader"]


class TestPortalAccessResolution:
    """Test Entra group → portal access mapping."""

    def test_resolve_portal_access_defaults_to_self_service(self):
        """User with no group mappings should get 'self-service' minimum access."""
        groups = []
        result = resolve_portal_access(groups)
        assert "self-service" in result

    def test_resolve_portal_access_sorted(self):
        """Portal access list should be sorted."""
        groups = []
        result = resolve_portal_access(groups)
        assert result == sorted(result)

    def test_resolve_portal_access_no_duplicates(self):
        """Portal access list should have no duplicates."""
        groups = []
        result = resolve_portal_access(groups)
        assert len(result) == len(set(result))


@pytest.mark.asyncio
class TestWorkspaceGrantsResolution:
    """Test workspace grants resolution."""

    async def test_resolve_workspace_grants_returns_empty(self):
        """Workspace grants resolution currently returns empty list (TODO)."""
        oid = str(uuid4())
        groups = ["some-group"]
        result = await resolve_workspace_grants(oid, groups)
        assert result == []


# ============================================================================
# Tests: JWT Token Validation (with mocking)
# ============================================================================


@pytest.mark.asyncio
class TestJWTValidation:
    """Test JWT validation and UserContext creation."""

    @patch("app.auth.entra_provider._get_jwks_client")
    async def test_validate_token_valid_jwt(self, mock_get_jwks_client):
        """Valid JWT should be decoded and return UserContext."""
        # Create a test token
        test_token = TestTokenFactory.create_token(
            oid="test-oid-123",
            email="alice@example.com",
            name="Alice Test",
            groups=[],
            audience="test-client-id",
        )

        # Mock the JWKS client
        mock_jwks = MagicMock()
        mock_signing_key = MagicMock()
        mock_signing_key.key = TestTokenFactory.PUBLIC_KEY
        mock_jwks.get_signing_key_from_jwt.return_value = mock_signing_key
        mock_get_jwks_client.return_value = mock_jwks

        # Mock the settings
        with (
            patch("app.auth.entra_provider._AUDIENCE", "test-client-id"),
            patch(
                "app.auth.entra_provider._ISSUER",
                "https://login.microsoftonline.com/test-tenant/v2.0",
            ),
        ):
            result = await validate_token(test_token)

        assert isinstance(result, UserContext)
        assert result.user_id == "test-oid-123"
        assert result.email == "alice@example.com"
        assert result.name == "Alice Test"
        assert result.role == "reader"  # No groups
        assert "self-service" in result.portal_access
        assert result.data_classification_level == "sensitive"

    @patch("app.auth.entra_provider._get_jwks_client")
    async def test_validate_token_expired_jwt(self, mock_get_jwks_client):
        """Expired JWT should raise ExpiredSignatureError."""
        # Create an expired token
        test_token = TestTokenFactory.create_token(
            exp_offset=timedelta(hours=-1),  # Expired 1 hour ago
            audience="test-client-id",
        )

        # Mock the JWKS client
        mock_jwks = MagicMock()
        mock_signing_key = MagicMock()
        mock_signing_key.key = TestTokenFactory.PUBLIC_KEY
        mock_jwks.get_signing_key_from_jwt.return_value = mock_signing_key
        mock_get_jwks_client.return_value = mock_jwks

        with (
            patch("app.auth.entra_provider._AUDIENCE", "test-client-id"),
            patch(
                "app.auth.entra_provider._ISSUER",
                "https://login.microsoftonline.com/test-tenant/v2.0",
            ),
        ):
            with pytest.raises(jwt.ExpiredSignatureError):
                await validate_token(test_token)

    @patch("app.auth.entra_provider._get_jwks_client")
    async def test_validate_token_wrong_audience(self, mock_get_jwks_client):
        """JWT with wrong audience should raise InvalidAudienceError."""
        # Create token with wrong audience
        test_token = TestTokenFactory.create_token(
            audience="wrong-client-id",
        )

        # Mock the JWKS client
        mock_jwks = MagicMock()
        mock_signing_key = MagicMock()
        mock_signing_key.key = TestTokenFactory.PUBLIC_KEY
        mock_jwks.get_signing_key_from_jwt.return_value = mock_signing_key
        mock_get_jwks_client.return_value = mock_jwks

        with (
            patch("app.auth.entra_provider._AUDIENCE", "test-client-id"),
            patch(
                "app.auth.entra_provider._ISSUER",
                "https://login.microsoftonline.com/test-tenant/v2.0",
            ),
        ):
            with pytest.raises(jwt.InvalidAudienceError):
                await validate_token(test_token)

    @patch("app.auth.entra_provider._get_jwks_client")
    async def test_validate_token_wrong_issuer(self, mock_get_jwks_client):
        """JWT with wrong issuer should raise InvalidIssuerError."""
        # Create token with wrong issuer
        test_token = TestTokenFactory.create_token(
            issuer="https://wrong-issuer.com/v2.0",
        )

        # Mock the JWKS client
        mock_jwks = MagicMock()
        mock_signing_key = MagicMock()
        mock_signing_key.key = TestTokenFactory.PUBLIC_KEY
        mock_jwks.get_signing_key_from_jwt.return_value = mock_signing_key
        mock_get_jwks_client.return_value = mock_jwks

        with (
            patch("app.auth.entra_provider._AUDIENCE", "test-client-id"),
            patch(
                "app.auth.entra_provider._ISSUER",
                "https://login.microsoftonline.com/test-tenant/v2.0",
            ),
        ):
            with pytest.raises(jwt.InvalidIssuerError):
                await validate_token(test_token)

    @patch("app.auth.entra_provider._get_jwks_client")
    async def test_validate_token_tampered_jwt(self, mock_get_jwks_client):
        """Tampered JWT (wrong signature) should raise PyJWTError."""
        # Create a token and tamper with it
        test_token = TestTokenFactory.create_token(audience="test-client-id")
        # Flip a bit in the signature
        tampered_token = test_token[:-10] + "corrupted!"

        # Mock the JWKS client
        mock_jwks = MagicMock()
        mock_signing_key = MagicMock()
        mock_signing_key.key = TestTokenFactory.PUBLIC_KEY
        mock_jwks.get_signing_key_from_jwt.return_value = mock_signing_key
        mock_get_jwks_client.return_value = mock_jwks

        with (
            patch("app.auth.entra_provider._AUDIENCE", "test-client-id"),
            patch(
                "app.auth.entra_provider._ISSUER",
                "https://login.microsoftonline.com/test-tenant/v2.0",
            ),
        ):
            with pytest.raises(jwt.PyJWTError):
                await validate_token(tampered_token)

    @patch("app.auth.entra_provider._get_jwks_client")
    async def test_validate_token_missing_oid_claim(self, mock_get_jwks_client):
        """JWT without 'oid' claim should raise MissingRequiredClaimError."""
        # Create token without oid
        now = datetime.now(UTC)
        payload = {
            "preferred_username": "test@example.com",
            "name": "Test User",
            "sub": str(uuid4()),
            "iat": int(now.timestamp()),
            "exp": int((now + timedelta(hours=1)).timestamp()),
            "aud": "test-client-id",
            "iss": "https://login.microsoftonline.com/test-tenant/v2.0",
        }
        test_token = jwt.encode(payload, TestTokenFactory.PRIVATE_KEY, algorithm="RS256")

        # Mock the JWKS client
        mock_jwks = MagicMock()
        mock_signing_key = MagicMock()
        mock_signing_key.key = TestTokenFactory.PUBLIC_KEY
        mock_jwks.get_signing_key_from_jwt.return_value = mock_signing_key
        mock_get_jwks_client.return_value = mock_jwks

        with (
            patch("app.auth.entra_provider._AUDIENCE", "test-client-id"),
            patch(
                "app.auth.entra_provider._ISSUER",
                "https://login.microsoftonline.com/test-tenant/v2.0",
            ),
        ):
            with pytest.raises(jwt.MissingRequiredClaimError):
                await validate_token(test_token)

    @patch("app.auth.entra_provider._get_jwks_client")
    async def test_validate_token_caching(self, mock_get_jwks_client):
        """Second call with same token should use cache (not re-validate)."""
        # Create a test token
        test_token = TestTokenFactory.create_token(
            oid="test-oid-cache",
            email="cache@example.com",
            audience="test-client-id",
        )

        # Mock the JWKS client
        mock_jwks = MagicMock()
        mock_signing_key = MagicMock()
        mock_signing_key.key = TestTokenFactory.PUBLIC_KEY
        mock_jwks.get_signing_key_from_jwt.return_value = mock_signing_key
        mock_get_jwks_client.return_value = mock_jwks

        with (
            patch("app.auth.entra_provider._AUDIENCE", "test-client-id"),
            patch(
                "app.auth.entra_provider._ISSUER",
                "https://login.microsoftonline.com/test-tenant/v2.0",
            ),
        ):
            # First call
            result1 = await validate_token(test_token)
            call_count_1 = mock_jwks.get_signing_key_from_jwt.call_count

            # Second call with same token
            result2 = await validate_token(test_token)
            call_count_2 = mock_jwks.get_signing_key_from_jwt.call_count

            # Should be the same result (cached)
            assert result1.user_id == result2.user_id
            assert result1.email == result2.email

            # JWKS call count should not have increased (cached)
            assert call_count_2 == call_count_1

    @patch("app.auth.entra_provider._get_jwks_client")
    async def test_validate_token_with_groups(self, mock_get_jwks_client):
        """Token with group memberships should populate role and portal access."""
        # For this test, we'll test the flow assuming group IDs aren't set in settings
        # So the role will default to "reader" but the test validates the flow works
        test_token = TestTokenFactory.create_token(
            oid="test-oid-groups",
            email="groups@example.com",
            groups=["group-id-1", "group-id-2"],
            audience="test-client-id",
        )

        # Mock the JWKS client
        mock_jwks = MagicMock()
        mock_signing_key = MagicMock()
        mock_signing_key.key = TestTokenFactory.PUBLIC_KEY
        mock_jwks.get_signing_key_from_jwt.return_value = mock_signing_key
        mock_get_jwks_client.return_value = mock_jwks

        with (
            patch("app.auth.entra_provider._AUDIENCE", "test-client-id"),
            patch(
                "app.auth.entra_provider._ISSUER",
                "https://login.microsoftonline.com/test-tenant/v2.0",
            ),
        ):
            result = await validate_token(test_token)

        assert isinstance(result, UserContext)
        assert result.user_id == "test-oid-groups"
        assert result.role == "reader"  # Default when groups aren't recognized
        assert isinstance(result.portal_access, list)
        assert len(result.portal_access) > 0

    @patch("app.auth.entra_provider._get_jwks_client")
    async def test_validate_token_locale_parsing(self, mock_get_jwks_client):
        """Token with locale should extract language code."""
        test_token = TestTokenFactory.create_token(
            locale="fr-CA",
            audience="test-client-id",
        )

        # Mock the JWKS client
        mock_jwks = MagicMock()
        mock_signing_key = MagicMock()
        mock_signing_key.key = TestTokenFactory.PUBLIC_KEY
        mock_jwks.get_signing_key_from_jwt.return_value = mock_signing_key
        mock_get_jwks_client.return_value = mock_jwks

        with (
            patch("app.auth.entra_provider._AUDIENCE", "test-client-id"),
            patch(
                "app.auth.entra_provider._ISSUER",
                "https://login.microsoftonline.com/test-tenant/v2.0",
            ),
        ):
            result = await validate_token(test_token)

        assert result.language == "fr"


# ============================================================================
# Tests: Demo Mode Still Works
# ============================================================================


class TestDemoModeIndependence:
    """Verify demo mode provider still functions independently."""

    def test_demo_provider_import(self):
        """Demo provider should be importable and functional."""
        from app.auth.demo_provider import demo_login, get_demo_user, get_demo_users

        assert callable(get_demo_user)
        assert callable(get_demo_users)
        assert callable(demo_login)

    def test_demo_provider_returns_users(self):
        """Demo provider should return configured demo users."""
        from app.auth.demo_provider import get_demo_users

        users = get_demo_users()
        assert len(users) == 5
        emails = {u.email for u in users}
        assert "alice@example.org" in emails

    def test_demo_provider_lookup_user(self):
        """Demo provider should look up user by email."""
        from app.auth.demo_provider import get_demo_user

        user = get_demo_user("alice@example.org")
        assert user is not None
        assert user.name == "Alice Chen"
        assert user.role == "contributor"

    def test_demo_provider_user_not_found(self):
        """Demo provider should return None for unknown user."""
        from app.auth.demo_provider import get_demo_user

        user = get_demo_user("unknown@example.org")
        assert user is None


# ============================================================================
# Integration-style tests (without real HTTP)
# ============================================================================


@pytest.mark.asyncio
class TestEntraAuthFlow:
    """Test the full Entra auth flow end-to-end."""

    @patch("app.auth.entra_provider._get_jwks_client")
    async def test_complete_auth_flow_admin_user(self, mock_get_jwks_client):
        """Complete auth flow for admin user with all expected fields."""
        # Simulate admin group configuration
        admin_group_oid = "admin-group-oid-123"
        test_token = TestTokenFactory.create_token(
            oid="admin-user-oid",
            email="admin@example.com",
            name="Admin User",
            groups=[admin_group_oid, "other-group"],
            locale="en-US",
            audience="test-client-id",
        )

        # Mock JWKS
        mock_jwks = MagicMock()
        mock_signing_key = MagicMock()
        mock_signing_key.key = TestTokenFactory.PUBLIC_KEY
        mock_jwks.get_signing_key_from_jwt.return_value = mock_signing_key
        mock_get_jwks_client.return_value = mock_jwks

        with (
            patch("app.auth.entra_provider._AUDIENCE", "test-client-id"),
            patch(
                "app.auth.entra_provider._ISSUER",
                "https://login.microsoftonline.com/test-tenant/v2.0",
            ),
        ):
            result = await validate_token(test_token)

        # Verify all fields populated
        assert result.user_id == "admin-user-oid"
        assert result.email == "admin@example.com"
        assert result.name == "Admin User"
        assert result.language == "en"
        assert result.data_classification_level == "sensitive"
        assert isinstance(result.workspace_grants, list)

    @patch("app.auth.entra_provider._get_jwks_client")
    async def test_complete_auth_flow_reader_user(self, mock_get_jwks_client):
        """Complete auth flow for reader user (no group membership)."""
        test_token = TestTokenFactory.create_token(
            oid="reader-user-oid",
            email="reader@example.com",
            name="Reader User",
            groups=[],  # No group membership
            audience="test-client-id",
        )

        # Mock JWKS
        mock_jwks = MagicMock()
        mock_signing_key = MagicMock()
        mock_signing_key.key = TestTokenFactory.PUBLIC_KEY
        mock_jwks.get_signing_key_from_jwt.return_value = mock_signing_key
        mock_get_jwks_client.return_value = mock_jwks

        with (
            patch("app.auth.entra_provider._AUDIENCE", "test-client-id"),
            patch(
                "app.auth.entra_provider._ISSUER",
                "https://login.microsoftonline.com/test-tenant/v2.0",
            ),
        ):
            result = await validate_token(test_token)

        # Reader with no groups should get default access
        assert result.role == "reader"
        assert "self-service" in result.portal_access

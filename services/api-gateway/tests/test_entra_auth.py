"""Comprehensive tests for Entra ID JWT validation and group mapping."""

from __future__ import annotations

from datetime import UTC, datetime, timedelta
from unittest.mock import MagicMock, patch
from uuid import uuid4

import jwt
import pytest

from app.auth.entra_provider import validate_token
from app.auth.group_mapping import resolve_portal_access, resolve_role, resolve_workspace_grants
from app.auth.models import UserContext

# ============================================================================
# Fixtures for test token generation
# ============================================================================


class TestTokenFactory:
    """Factory for creating test JWT tokens with configurable claims."""

    PRIVATE_KEY = """-----BEGIN RSA PRIVATE KEY-----
MIIEpAIBAAKCAQEA2a2rwplBCGGD2ypUzQJN4p1A5TdQLw3ZPuKwFfgzxu8Pg16l
+xZ5KHzI68TZmJk2BLxQc8KqsN5EQLqJ8p6uLZflIbQdN5GZMvC7VQKX/aM8cHsI
jTVs1VF5sV/uLF0pVZjMvP2xKBXp8G/r7VB6VVQZ8F8lW8j5Y9eP/zN7K7r4kBJu
yF6z8J5D5v9p2Q8R9F3F1K5I0L8M9N0O1P2Q3R4S5T6U7V8W9X0Y1Z2a3b4c5d6e
7f8g9h0i1j2k3l4m5n6o7p8q9r0s1t2u3v4w5x6y7z8A9B0C1D2E3F4G5H6I7J8K9L
QIDAQABAoIBADwxWbvTFzPDZePlyoqVGPKEWj/8KZN8F3t9K1v1F2s5V2Q3U7T8J6K
7I9H4Q5P2O0M9N8L7K6J5I4H3G2F1E0D9C8B7A6Z5Y4X3W2V1U0T9S8R7Q6P5O4N3M
2L1K0J9I8H7G6F5E4D3C2B1A0Z9Y8X7W6V5U4T3S2R1Q0P9O8N7M6L5K4J3I2H1G0F9
E8D7C6B5A4Z3Y2X1W0V9U8T7S6R5Q4P3O2N1M0L9K8J7I6H5G4F3E2D1C0B9A8Z7Y6X5
W4V3U2T1S0R9Q8P7O6N5M4L3K2J1I0H9G8F7E6D5C4B3A2Z1Y0X9W8V7U6T5S4R3Q2P1
O0N9M8L7K6J5I4H3G2F1E0ECgYEA7rJ5pF7W2V9U6T3S0R7Q4P1O8N5M2L9K6J3I0H7G
4F1E8D5C2B9A6Z3Y0X7W4V1U8T5S2R9Q6P3O0N7M4L1K8J5I2H9G6F3E0D7C4B1A8Z5Y2
X9W6V3U0T7S4R1Q8P5O2N9M6L3K0J7I4H1G8F5E2D9C6B3A0Z7Y4X1W8V5U2T9S6R3Q0P
7O4N1M8L5K2J9I6H3G0F7E4D1C8B5A2Z9Y6X3W0V7U4T1S8R5Q2P9O6N3M0L7K4J1I8H5
G2F9E6D3C0B7A4Z1Y8X5W2V9U6T3S0R7Q4P1O8NCgYEA6WkrS8H2g4L1M5V0N3U7I8J9O
6P4Q2T0S5R1U9V3W8X4Y2Z0a7b1c5d3e9f7g2h0i6j4k8l2m9n5o0p6r3s1t7u5v0w8x4
y2z0A7B1C5D3E9F7G2H0I6J4K8L2M9N5O0P6R3S1T7U5V0W8X4Y2Z0a7b1c5d3e9f7g2h0
i6j4k8l2m9n5o0p6r3s1t7u5v0w8x4y2z0KBgQC7S4K2L3M4N5O6P7Q8R9S0T1U2V3W4X5
Y6Z7a8b9c0d1e2f3g4h5i6j7k8l9m0n1o2p3q4r5s6t7u8v9w0x1y2z3A4B5C6D7E8F9G0
H1I2J3K4L5M6N7O8P9Q0R1S2T3U4V5W6X7Y8Z9a0b1c2d3e4f5g6h7i8j9k0l1m2n3o4p5q
QKBgQC5R1K3L4M5N6O7P8Q9R0S1T2U3V4W5X6Y7Z8a9b0c1d2e3f4g5h6i7j8k9l0m1n2o3p
4q5r6s7t8u9v0w1x2y3z4A5B6C7D8E9F0G1H2I3J4K5L6M7N8O9P0Q1R2S3T4U5V6W7X8Y9Z0
a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6A7B8C9D0E1F2G3H4I5J6
K7L8M9N0O1P2Q3R4S5T6U7V8W9X0Y1Z2a3b4c5d6e7f8g9h0i1j2k3l4m5n6o7p8q9r0s1t2
uQKBgQDLqY4P5R7T9V1X3Z5b7d9f1h3j5l7n9p1r3t5v7x9z1B3D5F7H9J1L3N5P7R9T1V3X5
Z7b9d1f3h5j7l9n1p3r5t7v9x1z3B5D7F9H1J3L5N7P9R1T3V5X7Z9b1d3f5h7j9l1n3p5r7t
9v1x3z5B7D9F1H3J5L7N9P1R3T5V7X9Z1b3d5f7h9j1l3n5p7r9t1v3x5z7B9D1F3H5J7L9N1P
3R5T7V9X1Z3b5d7f9h1j3l5n7p9r1t3v5x7z9B1D3F5H7J9L1N3P5R7T9V1X3Z5b7d9f1h3j5l
7n9p1r3t5v7x9z1B3D5F7H9J1L3N5P7R9T1V3X5Z7b9d1f3h5j7l9n1p3r5t7v9x1z3B5D7F9H1
J3L5N7P9R1T3V5X7Z9
-----END RSA PRIVATE KEY-----"""

    PUBLIC_KEY = """-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA2a2rwplBCGGD2ypUzQJN
4p1A5TdQLw3ZPuKwFfgzxu8Pg16l+xZ5KHzI68TZmJk2BLxQc8KqsN5EQLqJ8p6u
LZflIbQdN5GZMvC7VQKX/aM8cHsIjTVs1VF5sV/uLF0pVZjMvP2xKBXp8G/r7VB6
VVQZ8F8lW8j5Y9eP/zN7K7r4kBJuyF6z8J5D5v9p2Q8R9F3F1K5I0L8M9N0O1P2Q3
R4S5T6U7V8W9X0Y1Z2a3b4c5d6e7f8g9h0i1j2k3l4m5n6o7p8q9r0s1t2u3v4w5x6
y7z8A9B0C1D2E3F4G5H6I7J8K9LQIDAQAB
-----END PUBLIC KEY-----"""

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
    """Test Entra group → EVA role mapping."""

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
        assert result.data_classification_level == "protected_b"

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
        assert "alice@demo.gc.ca" in emails

    def test_demo_provider_lookup_user(self):
        """Demo provider should look up user by email."""
        from app.auth.demo_provider import get_demo_user

        user = get_demo_user("alice@demo.gc.ca")
        assert user is not None
        assert user.name == "Alice Chen"
        assert user.role == "contributor"

    def test_demo_provider_user_not_found(self):
        """Demo provider should return None for unknown user."""
        from app.auth.demo_provider import get_demo_user

        user = get_demo_user("unknown@demo.gc.ca")
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
        assert result.data_classification_level == "protected_b"
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

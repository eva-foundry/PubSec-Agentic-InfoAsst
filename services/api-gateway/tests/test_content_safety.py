"""Tests for Azure Content Safety API integration.

Tests the full ContentSafetyChecker with mocked Azure client,
including pass-through mode, threshold configuration, audit trails,
API failures, and text truncation.
"""

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.guardrails.content_safety import ContentSafetyChecker, ContentSafetyResult


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture
def mock_azure_client():
    """Mock the Azure Content Safety client."""
    return MagicMock()


@pytest.fixture
def mock_audit_logger():
    """Mock the AuditLogger."""
    return MagicMock()


# ---------------------------------------------------------------------------
# Safe Input Tests
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_safe_input_passes(mock_azure_client):
    """Safe input with all severity=0 should pass."""
    # Mock response with all safe categories
    mock_response = MagicMock()
    mock_category_item = MagicMock()
    mock_category_item.category = "Hate"
    mock_category_item.severity = 0
    mock_response.categories_analysis = [mock_category_item]
    mock_azure_client.analyze_text.return_value = mock_response

    with patch("app.guardrails.content_safety.ContentSafetyClient") as mock_class:
        mock_class.return_value = mock_azure_client

        checker = ContentSafetyChecker(threshold=4)
        result = await checker.check_input("What is the capital of France?")

        assert result.passed is True
        assert result.blocked_reason is None
        assert "Hate" in result.categories
        assert result.categories["Hate"] == "0"


@pytest.mark.asyncio
async def test_safe_output_passes(mock_azure_client):
    """Safe output should pass content safety check."""
    mock_response = MagicMock()
    mock_category = MagicMock()
    mock_category.category = "Violence"
    mock_category.severity = 0
    mock_response.categories_analysis = [mock_category]
    mock_azure_client.analyze_text.return_value = mock_response

    with patch("app.guardrails.content_safety.ContentSafetyClient") as mock_class:
        mock_class.return_value = mock_azure_client

        checker = ContentSafetyChecker()
        result = await checker.check_output("The capital of France is Paris.")

        assert result.passed is True
        assert result.blocked_reason is None


# ---------------------------------------------------------------------------
# Harmful Input Tests
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_harmful_input_blocked(mock_azure_client):
    """Harmful input with severity >= threshold should be blocked."""
    mock_response = MagicMock()
    mock_category = MagicMock()
    mock_category.category = "Hate"
    mock_category.severity = 6  # High severity
    mock_response.categories_analysis = [mock_category]
    mock_azure_client.analyze_text.return_value = mock_response

    with patch("app.guardrails.content_safety.ContentSafetyClient") as mock_class:
        mock_class.return_value = mock_azure_client

        checker = ContentSafetyChecker(threshold=4)
        result = await checker.check_input("harmful content here")

        assert result.passed is False
        assert result.blocked_reason is not None
        assert "Hate" in result.blocked_reason
        assert "severity 6" in result.blocked_reason


@pytest.mark.asyncio
async def test_harmful_output_blocked(mock_azure_client):
    """Harmful output should be blocked."""
    mock_response = MagicMock()
    mock_category = MagicMock()
    mock_category.category = "SelfHarm"
    mock_category.severity = 6
    mock_response.categories_analysis = [mock_category]
    mock_azure_client.analyze_text.return_value = mock_response

    with patch("app.guardrails.content_safety.ContentSafetyClient") as mock_class:
        mock_class.return_value = mock_azure_client

        checker = ContentSafetyChecker(threshold=4)
        result = await checker.check_output("harmful response")

        assert result.passed is False


# ---------------------------------------------------------------------------
# Threshold Configuration Tests
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_threshold_blocks_medium_and_above(mock_azure_client):
    """Medium severity (4) at threshold=4 should block."""
    mock_response = MagicMock()
    mock_category = MagicMock()
    mock_category.category = "Violence"
    mock_category.severity = 4  # Medium
    mock_response.categories_analysis = [mock_category]
    mock_azure_client.analyze_text.return_value = mock_response

    with patch("app.guardrails.content_safety.ContentSafetyClient") as mock_class:
        mock_class.return_value = mock_azure_client

        checker = ContentSafetyChecker(threshold=4)
        result = await checker.check_input("text")

        assert result.passed is False
        assert "severity 4" in result.blocked_reason


@pytest.mark.asyncio
async def test_threshold_blocks_high_only(mock_azure_client):
    """With threshold=6, medium (4) should pass, high (6) should block."""
    mock_response = MagicMock()
    mock_category = MagicMock()
    mock_category.category = "Violence"
    mock_category.severity = 4  # Medium
    mock_response.categories_analysis = [mock_category]
    mock_azure_client.analyze_text.return_value = mock_response

    with patch("app.guardrails.content_safety.ContentSafetyClient") as mock_class:
        mock_class.return_value = mock_azure_client

        checker = ContentSafetyChecker(threshold=6)
        result = await checker.check_input("text")

        assert result.passed is True


@pytest.mark.asyncio
async def test_threshold_blocks_below_threshold(mock_azure_client):
    """Severity below threshold should pass."""
    mock_response = MagicMock()
    mock_category = MagicMock()
    mock_category.category = "Hate"
    mock_category.severity = 2  # Low
    mock_response.categories_analysis = [mock_category]
    mock_azure_client.analyze_text.return_value = mock_response

    with patch("app.guardrails.content_safety.ContentSafetyClient") as mock_class:
        mock_class.return_value = mock_azure_client

        checker = ContentSafetyChecker(threshold=4)
        result = await checker.check_input("text")

        assert result.passed is True


# ---------------------------------------------------------------------------
# Multiple Categories Tests
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_multiple_categories_all_safe(mock_azure_client):
    """Multiple safe categories should all pass."""
    mock_response = MagicMock()
    mock_cat1 = MagicMock()
    mock_cat1.category = "Hate"
    mock_cat1.severity = 0
    mock_cat2 = MagicMock()
    mock_cat2.category = "Violence"
    mock_cat2.severity = 0
    mock_cat3 = MagicMock()
    mock_cat3.category = "SelfHarm"
    mock_cat3.severity = 0
    mock_response.categories_analysis = [mock_cat1, mock_cat2, mock_cat3]
    mock_azure_client.analyze_text.return_value = mock_response

    with patch("app.guardrails.content_safety.ContentSafetyClient") as mock_class:
        mock_class.return_value = mock_azure_client

        checker = ContentSafetyChecker()
        result = await checker.check_input("safe text")

        assert result.passed is True
        assert len(result.categories) == 3
        assert result.categories["Hate"] == "0"
        assert result.categories["Violence"] == "0"
        assert result.categories["SelfHarm"] == "0"


@pytest.mark.asyncio
async def test_multiple_categories_one_blocked(mock_azure_client):
    """If any category exceeds threshold, block."""
    mock_response = MagicMock()
    mock_cat1 = MagicMock()
    mock_cat1.category = "Hate"
    mock_cat1.severity = 0
    mock_cat2 = MagicMock()
    mock_cat2.category = "Violence"
    mock_cat2.severity = 6  # High
    mock_response.categories_analysis = [mock_cat1, mock_cat2]
    mock_azure_client.analyze_text.return_value = mock_response

    with patch("app.guardrails.content_safety.ContentSafetyClient") as mock_class:
        mock_class.return_value = mock_azure_client

        checker = ContentSafetyChecker(threshold=4)
        result = await checker.check_input("text")

        assert result.passed is False
        assert "Violence" in result.blocked_reason


# ---------------------------------------------------------------------------
# Audit Trail Tests
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_audit_logged_on_pass(mock_azure_client, mock_audit_logger):
    """Audit trail should log when input passes."""
    mock_response = MagicMock()
    mock_category = MagicMock()
    mock_category.category = "Hate"
    mock_category.severity = 0
    mock_response.categories_analysis = [mock_category]
    mock_azure_client.analyze_text.return_value = mock_response

    with patch("app.guardrails.content_safety.ContentSafetyClient") as mock_class:
        mock_class.return_value = mock_azure_client
        with patch("app.guardrails.content_safety._audit") as mock_audit:
            checker = ContentSafetyChecker()
            await checker.check_input("safe text", correlation_id="corr-123")

            mock_audit.log_action.assert_called()
            call_kwargs = mock_audit.log_action.call_args[1]
            assert call_kwargs["subject"] == "content-safety-input"
            assert call_kwargs["actor"] == "content-safety-checker"
            assert call_kwargs["action"] == "analyze"
            assert call_kwargs["correlation_id"] == "corr-123"
            assert call_kwargs["policy_decision"] == "pass"


@pytest.mark.asyncio
async def test_audit_logged_on_block(mock_azure_client, mock_audit_logger):
    """Audit trail should log when input is blocked."""
    mock_response = MagicMock()
    mock_category = MagicMock()
    mock_category.category = "Hate"
    mock_category.severity = 6
    mock_response.categories_analysis = [mock_category]
    mock_azure_client.analyze_text.return_value = mock_response

    with patch("app.guardrails.content_safety.ContentSafetyClient") as mock_class:
        mock_class.return_value = mock_azure_client
        with patch("app.guardrails.content_safety._audit") as mock_audit:
            checker = ContentSafetyChecker(threshold=4)
            await checker.check_input("harmful", correlation_id="corr-456")

            mock_audit.log_action.assert_called()
            call_kwargs = mock_audit.log_action.call_args[1]
            assert call_kwargs["subject"] == "content-safety-input"
            assert "block:" in call_kwargs["policy_decision"]
            assert call_kwargs["correlation_id"] == "corr-456"


@pytest.mark.asyncio
async def test_audit_logged_for_output(mock_azure_client):
    """Audit should track output direction."""
    mock_response = MagicMock()
    mock_category = MagicMock()
    mock_category.category = "Violence"
    mock_category.severity = 0
    mock_response.categories_analysis = [mock_category]
    mock_azure_client.analyze_text.return_value = mock_response

    with patch("app.guardrails.content_safety.ContentSafetyClient") as mock_class:
        mock_class.return_value = mock_azure_client
        with patch("app.guardrails.content_safety._audit") as mock_audit:
            checker = ContentSafetyChecker()
            await checker.check_output("agent response")

            call_kwargs = mock_audit.log_action.call_args[1]
            assert call_kwargs["subject"] == "content-safety-output"


# ---------------------------------------------------------------------------
# API Error Handling & Graceful Degradation
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_api_error_graceful_degradation(mock_azure_client):
    """API error should degrade gracefully, pass through, log error."""
    mock_azure_client.analyze_text.side_effect = Exception("Connection timeout")

    with patch("app.guardrails.content_safety.ContentSafetyClient") as mock_class:
        mock_class.return_value = mock_azure_client
        with patch("app.guardrails.content_safety._audit") as mock_audit:
            checker = ContentSafetyChecker()
            result = await checker.check_input("text", correlation_id="corr-error")

            # Should pass through on error
            assert result.passed is True
            # But should note the error
            assert "API error" in result.blocked_reason or result.blocked_reason is None
            # Audit should log the error
            mock_audit.log_action.assert_called()
            call_kwargs = mock_audit.log_action.call_args[1]
            assert "error" in call_kwargs["action"].lower()


@pytest.mark.asyncio
async def test_api_network_error_degradation(mock_azure_client):
    """Network errors should not crash the checker."""
    mock_azure_client.analyze_text.side_effect = ConnectionError("Network unreachable")

    with patch("app.guardrails.content_safety.ContentSafetyClient") as mock_class:
        mock_class.return_value = mock_azure_client

        checker = ContentSafetyChecker()
        result = await checker.check_input("text")

        assert result.passed is True  # Degrade gracefully


@pytest.mark.asyncio
async def test_api_timeout_degradation(mock_azure_client):
    """Timeout errors should degrade gracefully."""
    mock_azure_client.analyze_text.side_effect = TimeoutError("Request timed out")

    with patch("app.guardrails.content_safety.ContentSafetyClient") as mock_class:
        mock_class.return_value = mock_azure_client

        checker = ContentSafetyChecker()
        result = await checker.check_input("text")

        assert result.passed is True


# ---------------------------------------------------------------------------
# Text Truncation Tests
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_text_truncated_to_10k_chars(mock_azure_client):
    """Input longer than 10K chars should be truncated."""
    mock_response = MagicMock()
    mock_category = MagicMock()
    mock_category.category = "Hate"
    mock_category.severity = 0
    mock_response.categories_analysis = [mock_category]
    mock_azure_client.analyze_text.return_value = mock_response

    with patch("app.guardrails.content_safety.ContentSafetyClient") as mock_class:
        mock_class.return_value = mock_azure_client

        checker = ContentSafetyChecker()
        long_text = "a" * 15000
        result = await checker.check_input(long_text)

        # Verify analyze_text was called with truncated text
        call_args = mock_azure_client.analyze_text.call_args
        request = call_args[0][0]
        assert len(request.text) == 10000


@pytest.mark.asyncio
async def test_text_not_truncated_if_under_10k(mock_azure_client):
    """Input under 10K chars should not be truncated."""
    mock_response = MagicMock()
    mock_category = MagicMock()
    mock_category.category = "Hate"
    mock_category.severity = 0
    mock_response.categories_analysis = [mock_category]
    mock_azure_client.analyze_text.return_value = mock_response

    with patch("app.guardrails.content_safety.ContentSafetyClient") as mock_class:
        mock_class.return_value = mock_azure_client

        checker = ContentSafetyChecker()
        text = "short text"
        result = await checker.check_input(text)

        call_args = mock_azure_client.analyze_text.call_args
        request = call_args[0][0]
        assert request.text == text


# ---------------------------------------------------------------------------
# Pass-Through Mode Tests (No Endpoint Configured)
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_pass_through_mode_no_endpoint():
    """Without endpoint configured, should pass through without calling API."""
    with patch("app.guardrails.content_safety.settings") as mock_settings:
        mock_settings.content_safety_endpoint = ""
        mock_settings.content_safety_key = ""

        checker = ContentSafetyChecker()
        # Client should not be initialized
        assert checker._client is None

        result = await checker.check_input("any text")
        # Should always pass in pass-through mode
        assert result.passed is True
        assert result.categories == {}
        assert result.blocked_reason is None


@pytest.mark.asyncio
async def test_pass_through_mode_no_key():
    """Without key configured, should pass through."""
    with patch("app.guardrails.content_safety.settings") as mock_settings:
        mock_settings.content_safety_endpoint = "https://example.contentsafety.azure.com"
        mock_settings.content_safety_key = ""

        checker = ContentSafetyChecker()
        assert checker._client is None

        result = await checker.check_output("text")
        assert result.passed is True


@pytest.mark.asyncio
async def test_pass_through_mode_no_endpoint_no_api_call():
    """In pass-through mode, no API should be called."""
    with patch("app.guardrails.content_safety.settings") as mock_settings:
        mock_settings.content_safety_endpoint = ""
        mock_settings.content_safety_key = ""

        with patch("app.guardrails.content_safety.ContentSafetyClient") as mock_class:
            checker = ContentSafetyChecker()
            await checker.check_input("text")

            # API client should not be instantiated
            mock_class.assert_not_called()


# ---------------------------------------------------------------------------
# Initialization Tests
# ---------------------------------------------------------------------------


def test_client_initialization_success(mock_azure_client):
    """Client should initialize when endpoint and key are configured."""
    with patch("app.guardrails.content_safety.settings") as mock_settings:
        mock_settings.content_safety_endpoint = "https://example.contentsafety.azure.com"
        mock_settings.content_safety_key = "test-key"

        with patch("app.guardrails.content_safety.ContentSafetyClient") as mock_class:
            mock_class.return_value = mock_azure_client

            checker = ContentSafetyChecker()

            assert checker._client is not None
            mock_class.assert_called_once()


def test_client_initialization_import_error():
    """If SDK not installed, should log warning and continue."""
    with patch("app.guardrails.content_safety.settings") as mock_settings:
        mock_settings.content_safety_endpoint = "https://example.contentsafety.azure.com"
        mock_settings.content_safety_key = "test-key"

        with patch("app.guardrails.content_safety.ContentSafetyClient", side_effect=ImportError("SDK not found")):
            # Should not raise, just log warning
            checker = ContentSafetyChecker()
            assert checker._client is None


def test_client_initialization_api_error():
    """If API initialization fails, should log error and continue."""
    with patch("app.guardrails.content_safety.settings") as mock_settings:
        mock_settings.content_safety_endpoint = "https://example.contentsafety.azure.com"
        mock_settings.content_safety_key = "test-key"

        with patch("app.guardrails.content_safety.ContentSafetyClient", side_effect=Exception("Init failed")):
            checker = ContentSafetyChecker()
            assert checker._client is None


# ---------------------------------------------------------------------------
# Correlation ID Tests
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_correlation_id_passed_through(mock_azure_client):
    """Correlation ID should be passed to audit logs."""
    mock_response = MagicMock()
    mock_category = MagicMock()
    mock_category.category = "Hate"
    mock_category.severity = 0
    mock_response.categories_analysis = [mock_category]
    mock_azure_client.analyze_text.return_value = mock_response

    with patch("app.guardrails.content_safety.ContentSafetyClient") as mock_class:
        mock_class.return_value = mock_azure_client
        with patch("app.guardrails.content_safety._audit") as mock_audit:
            checker = ContentSafetyChecker()
            corr_id = "trace-xyz-789"
            await checker.check_input("text", correlation_id=corr_id)

            call_kwargs = mock_audit.log_action.call_args[1]
            assert call_kwargs["correlation_id"] == corr_id


@pytest.mark.asyncio
async def test_correlation_id_in_error_logging(mock_azure_client):
    """Correlation ID should be in audit log even on error."""
    mock_azure_client.analyze_text.side_effect = RuntimeError("API down")

    with patch("app.guardrails.content_safety.ContentSafetyClient") as mock_class:
        mock_class.return_value = mock_azure_client
        with patch("app.guardrails.content_safety._audit") as mock_audit:
            checker = ContentSafetyChecker()
            corr_id = "error-trace-123"
            await checker.check_input("text", correlation_id=corr_id)

            call_kwargs = mock_audit.log_action.call_args[1]
            assert call_kwargs["correlation_id"] == corr_id


# ---------------------------------------------------------------------------
# Severity Mapping Tests
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_severity_mapped_as_string(mock_azure_client):
    """Categories should map severity as string."""
    mock_response = MagicMock()
    mock_cat1 = MagicMock()
    mock_cat1.category = "Hate"
    mock_cat1.severity = 2
    mock_cat2 = MagicMock()
    mock_cat2.category = "Violence"
    mock_cat2.severity = 6
    mock_response.categories_analysis = [mock_cat1, mock_cat2]
    mock_azure_client.analyze_text.return_value = mock_response

    with patch("app.guardrails.content_safety.ContentSafetyClient") as mock_class:
        mock_class.return_value = mock_azure_client

        checker = ContentSafetyChecker()
        result = await checker.check_input("text")

        assert result.categories["Hate"] == "2"
        assert result.categories["Violence"] == "6"


@pytest.mark.asyncio
async def test_none_severity_defaults_to_zero(mock_azure_client):
    """If severity is None, should default to 0."""
    mock_response = MagicMock()
    mock_category = MagicMock()
    mock_category.category = "Hate"
    mock_category.severity = None
    mock_response.categories_analysis = [mock_category]
    mock_azure_client.analyze_text.return_value = mock_response

    with patch("app.guardrails.content_safety.ContentSafetyClient") as mock_class:
        mock_class.return_value = mock_azure_client

        checker = ContentSafetyChecker()
        result = await checker.check_input("text")

        assert result.passed is True
        assert result.categories["Hate"] == "0"


# ---------------------------------------------------------------------------
# Result Dataclass Tests
# ---------------------------------------------------------------------------


def test_content_safety_result_defaults():
    """ContentSafetyResult should have proper defaults."""
    result = ContentSafetyResult(passed=True)
    assert result.passed is True
    assert result.categories == {}
    assert result.blocked_reason is None


def test_content_safety_result_with_data():
    """ContentSafetyResult should store categories and reason."""
    result = ContentSafetyResult(
        passed=False,
        categories={"Hate": "6", "Violence": "4"},
        blocked_reason="Hate: severity 6 >= threshold 4"
    )
    assert result.passed is False
    assert result.categories["Hate"] == "6"
    assert result.blocked_reason is not None

"""Tests for PII sanitization module (Phase 1.6).

Validates Canadian PII pattern detection and redaction for audit logging.
Ensures ITSG-33 AU-2/AU-3 compliance (no PII in logs) and CLAUDE.md AUD02/AUD05.
"""

from __future__ import annotations

import pytest

from app.core.sanitizer import sanitize_for_audit, hash_for_audit


class TestSINRedaction:
    """Social Insurance Number pattern redaction."""

    def test_sin_with_dashes(self) -> None:
        """Test SIN with dashes: 123-456-789."""
        text = "My SIN is 123-456-789"
        result = sanitize_for_audit(text)
        assert result == "My SIN is [SIN-REDACTED]"

    def test_sin_without_dashes(self) -> None:
        """Test SIN without dashes: 123456789."""
        text = "SIN: 123456789"
        result = sanitize_for_audit(text)
        assert result == "SIN: [SIN-REDACTED]"

    def test_sin_with_spaces(self) -> None:
        """Test SIN with spaces: 123 456 789."""
        text = "Social Insurance Number 123 456 789 is required"
        result = sanitize_for_audit(text)
        assert result == "Social Insurance Number [SIN-REDACTED] is required"

    def test_multiple_sins(self) -> None:
        """Test multiple SINs in single text."""
        text = "Employee 123-456-789 and 987-654-321 records"
        result = sanitize_for_audit(text)
        assert result == "Employee [SIN-REDACTED] and [SIN-REDACTED] records"


class TestEmailRedaction:
    """Email address pattern redaction."""

    def test_email_basic(self) -> None:
        """Test basic email redaction."""
        text = "Contact marco@esdc.gc.ca for details"
        result = sanitize_for_audit(text)
        assert result == "Contact [EMAIL-REDACTED] for details"

    def test_email_with_numbers(self) -> None:
        """Test email with numbers."""
        text = "user123@domain.example.com submitted"
        result = sanitize_for_audit(text)
        assert result == "[EMAIL-REDACTED] submitted"

    def test_email_with_underscore(self) -> None:
        """Test email with underscore."""
        text = "john_doe@gov.ca is the contact"
        result = sanitize_for_audit(text)
        assert result == "[EMAIL-REDACTED] is the contact"

    def test_multiple_emails(self) -> None:
        """Test multiple emails."""
        text = "Send to user1@example.com or user2@example.org"
        result = sanitize_for_audit(text)
        assert result == "Send to [EMAIL-REDACTED] or [EMAIL-REDACTED]"


class TestPhoneRedaction:
    """Phone number pattern redaction."""

    def test_phone_basic_dashes(self) -> None:
        """Test phone with dashes: 613-555-1234."""
        text = "Call 613-555-1234 for support"
        result = sanitize_for_audit(text)
        assert result == "Call [PHONE-REDACTED] for support"

    def test_phone_with_parens(self) -> None:
        """Test phone with parentheses: (613) 555-1234."""
        text = "Phone: (613) 555-1234"
        result = sanitize_for_audit(text)
        assert result == "Phone: [PHONE-REDACTED]"

    def test_phone_with_dots(self) -> None:
        """Test phone with dots: 613.555.1234."""
        text = "Dial 613.555.1234 to connect"
        result = sanitize_for_audit(text)
        assert result == "Dial [PHONE-REDACTED] to connect"

    def test_phone_with_plus(self) -> None:
        """Test phone with plus and country code: +1-613-555-1234."""
        text = "International: +1-613-555-1234"
        result = sanitize_for_audit(text)
        assert result == "International: [PHONE-REDACTED]"

    def test_multiple_phones(self) -> None:
        """Test multiple phone numbers."""
        text = "Primary: 613-555-1234 or backup (613) 555-5678"
        result = sanitize_for_audit(text)
        assert result == "Primary: [PHONE-REDACTED] or backup [PHONE-REDACTED]"


class TestPostalCodeRedaction:
    """Canadian postal code pattern redaction."""

    def test_postal_with_space(self) -> None:
        """Test postal code with space: K1A 0B1."""
        text = "Address: Ottawa K1A 0B1"
        result = sanitize_for_audit(text)
        assert result == "Address: Ottawa [POSTAL-REDACTED]"

    def test_postal_without_space(self) -> None:
        """Test postal code without space: K1A0B1."""
        text = "Postal K1A0B1 is valid"
        result = sanitize_for_audit(text)
        assert result == "Postal [POSTAL-REDACTED] is valid"

    def test_postal_with_dash(self) -> None:
        """Test postal code with dash: K1A-0B1."""
        text = "Code K1A-0B1 accepted"
        result = sanitize_for_audit(text)
        assert result == "Code [POSTAL-REDACTED] accepted"

    def test_postal_lowercase(self) -> None:
        """Test lowercase postal code: k1a 0b1."""
        text = "Area k1a 0b1 included"
        result = sanitize_for_audit(text)
        assert result == "Area [POSTAL-REDACTED] included"

    def test_multiple_postal_codes(self) -> None:
        """Test multiple postal codes."""
        text = "Coverage: M5V 3A8 and H2X 1Y7"
        result = sanitize_for_audit(text)
        assert result == "Coverage: [POSTAL-REDACTED] and [POSTAL-REDACTED]"


class TestDOBRedaction:
    """Date of birth pattern redaction."""

    def test_dob_iso_format(self) -> None:
        """Test ISO format: 1990-01-15."""
        text = "Born 1990-01-15 in Canada"
        result = sanitize_for_audit(text)
        assert result == "Born [DOB-REDACTED] in Canada"

    def test_dob_slash_format_ddmmyyyy(self) -> None:
        """Test slash format: 15/01/1990."""
        text = "DOB: 15/01/1990"
        result = sanitize_for_audit(text)
        assert result == "DOB: [DOB-REDACTED]"

    def test_dob_slash_format_mmddyyyy(self) -> None:
        """Test US slash format: 01/15/1990."""
        text = "Date 01/15/1990 recorded"
        result = sanitize_for_audit(text)
        assert result == "Date [DOB-REDACTED] recorded"

    def test_multiple_dates(self) -> None:
        """Test multiple dates."""
        text = "From 2000-06-20 to 2025-12-31"
        result = sanitize_for_audit(text)
        assert result == "From [DOB-REDACTED] to [DOB-REDACTED]"


class TestMultiplePIITypes:
    """Tests for content with multiple PII types."""

    def test_sin_and_email(self) -> None:
        """Test SIN and email together."""
        text = "Employee SIN 123-456-789 email john.doe@esdc.gc.ca"
        result = sanitize_for_audit(text)
        assert result == "Employee SIN [SIN-REDACTED] email [EMAIL-REDACTED]"

    def test_phone_and_postal(self) -> None:
        """Test phone and postal code together."""
        text = "Call 613-555-1234 for K1A 0B1 area"
        result = sanitize_for_audit(text)
        assert result == "Call [PHONE-REDACTED] for [POSTAL-REDACTED] area"

    def test_all_pii_types(self) -> None:
        """Test all PII types in one string."""
        text = "SIN 123-456-789, email jane@gov.ca, phone 416-555-0987, postal M5V 3A8, born 1985-03-22"
        result = sanitize_for_audit(text)
        assert "[SIN-REDACTED]" in result
        assert "[EMAIL-REDACTED]" in result
        assert "[PHONE-REDACTED]" in result
        assert "[POSTAL-REDACTED]" in result
        assert "[DOB-REDACTED]" in result


class TestNormalContent:
    """Tests for non-PII content that should pass through unchanged."""

    def test_normal_text_unchanged(self) -> None:
        """Test that normal text is not modified."""
        text = "What is EI eligibility?"
        result = sanitize_for_audit(text)
        assert result == text

    def test_numbers_not_sin(self) -> None:
        """Test that non-SIN numbers are not redacted."""
        text = "Document 12345 revision 001"
        result = sanitize_for_audit(text)
        assert result == text

    def test_legislative_reference_unchanged(self) -> None:
        """Test that legislative references are unchanged."""
        text = "See Act section 42.1 for details"
        result = sanitize_for_audit(text)
        assert result == text

    def test_empty_string(self) -> None:
        """Test empty string."""
        text = ""
        result = sanitize_for_audit(text)
        assert result == ""

    def test_whitespace_only(self) -> None:
        """Test whitespace-only string."""
        text = "   "
        result = sanitize_for_audit(text)
        assert result == text


class TestFrenchContent:
    """Tests for French content with PII."""

    def test_french_email_redacted(self) -> None:
        """Test email redaction in French text."""
        text = "Veuillez contacter marie.martin@esdc.gc.ca pour plus de détails"
        result = sanitize_for_audit(text)
        assert result == "Veuillez contacter [EMAIL-REDACTED] pour plus de détails"

    def test_french_phone_redacted(self) -> None:
        """Test phone redaction in French text."""
        text = "Appelez 514-555-1234 pour l'assistance"
        result = sanitize_for_audit(text)
        assert result == "Appelez [PHONE-REDACTED] pour l'assistance"

    def test_french_postal_redacted(self) -> None:
        """Test postal code redaction in French text."""
        text = "L'adresse H2X 1Y7 est valide"
        result = sanitize_for_audit(text)
        assert result == "L'adresse [POSTAL-REDACTED] est valide"


class TestHashForAudit:
    """Tests for deterministic PII hashing."""

    def test_hash_deterministic(self) -> None:
        """Test that same input produces same hash."""
        text = "123-456-789"
        hash1 = hash_for_audit(text)
        hash2 = hash_for_audit(text)
        assert hash1 == hash2

    def test_hash_different_inputs(self) -> None:
        """Test that different inputs produce different hashes."""
        hash1 = hash_for_audit("user1@example.com")
        hash2 = hash_for_audit("user2@example.com")
        assert hash1 != hash2

    def test_hash_length(self) -> None:
        """Test that hash is 16 characters."""
        hash_value = hash_for_audit("some-text")
        assert len(hash_value) == 16
        assert all(c in "0123456789abcdef" for c in hash_value)

    def test_hash_no_pii_exposed(self) -> None:
        """Test that hash doesn't expose original PII."""
        sin = "123-456-789"
        hash_value = hash_for_audit(sin)
        # Hash should not contain any part of the SIN
        assert "123" not in hash_value
        assert "456" not in hash_value
        assert "789" not in hash_value

    def test_hash_correlation(self) -> None:
        """Test that hashes enable correlation without PII."""
        email = "user@esdc.gc.ca"
        hash1 = hash_for_audit(email)
        hash2 = hash_for_audit(email)
        # Same email should produce same hash for correlation
        assert hash1 == hash2
        # But original email is not exposed
        assert email not in hash1

    def test_hash_empty_string(self) -> None:
        """Test hash of empty string."""
        hash_value = hash_for_audit("")
        assert len(hash_value) == 16
        # Empty string produces consistent hash
        assert hash_value == hash_for_audit("")


class TestEdgeCases:
    """Edge case tests."""

    def test_partial_sin_not_redacted(self) -> None:
        """Test that incomplete SINs are not redacted."""
        text = "123-456 is incomplete"
        result = sanitize_for_audit(text)
        assert result == text

    def test_email_like_not_matched(self) -> None:
        """Test that incomplete email patterns are not redacted."""
        text = "Use format user@domain without spaces"
        result = sanitize_for_audit(text)
        assert result == text

    def test_very_long_text(self) -> None:
        """Test redaction in very long text."""
        text = "A" * 10000 + " email user@example.com " + "B" * 10000
        result = sanitize_for_audit(text)
        assert "[EMAIL-REDACTED]" in result
        assert "user@example.com" not in result

    def test_pii_at_boundaries(self) -> None:
        """Test PII detection at text boundaries."""
        text = "123-456-789"
        result = sanitize_for_audit(text)
        assert result == "[SIN-REDACTED]"

    def test_nested_redaction(self) -> None:
        """Test that redaction doesn't double-process."""
        text = "Contact [EMAIL-REDACTED] and user@example.com"
        result = sanitize_for_audit(text)
        # Should only redact the actual email, not the redaction marker
        assert result == "Contact [EMAIL-REDACTED] and [EMAIL-REDACTED]"

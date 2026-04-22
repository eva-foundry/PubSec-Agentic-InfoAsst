"""PII sanitization for audit logs.

Detects and redacts public-sector PII patterns (SIN, email, phone, postal code)
before any text is written to audit logs or telemetry. Satisfies NIST 800-53
AU-2/AU-3 (no PII in Log Analytics) and CLAUDE.md AUD02/AUD05.
"""

from __future__ import annotations

import hashlib
import re

# ---------------------------------------------------------------------------
# public-sector PII patterns
# ---------------------------------------------------------------------------

# Social Insurance Number: 123-456-789 or 123 456 789 or 123456789
_SIN_PATTERN = re.compile(r"\b\d{3}[-\s]?\d{3}[-\s]?\d{3}\b")

# Email addresses
_EMAIL_PATTERN = re.compile(r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b")

# Phone numbers: +1-613-555-1234, (613) 555-1234, 613-555-1234, etc.
_PHONE_PATTERN = re.compile(r"(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}")

# public-sector postal codes: K1A 0B1, k1a0b1, K1A-0B1
_POSTAL_PATTERN = re.compile(r"\b[A-Za-z]\d[A-Za-z][-\s]?\d[A-Za-z]\d\b")

# Date of birth patterns: 1990-01-15, 15/01/1990, Jan 15, 1990
_DOB_PATTERN = re.compile(
    r"\b(?:19|20)\d{2}[-/]\d{2}[-/]\d{2}\b"
    r"|\b\d{2}[-/]\d{2}[-/](?:19|20)\d{2}\b"
)

_PATTERNS: list[tuple[re.Pattern, str]] = [
    (_SIN_PATTERN, "[SIN-REDACTED]"),
    (_EMAIL_PATTERN, "[EMAIL-REDACTED]"),
    (_PHONE_PATTERN, "[PHONE-REDACTED]"),
    (_POSTAL_PATTERN, "[POSTAL-REDACTED]"),
    (_DOB_PATTERN, "[DOB-REDACTED]"),
]


def sanitize_for_audit(text: str) -> str:
    """Remove PII patterns from text before logging.

    Applies all public-sector PII pattern detections and replaces with
    redaction markers. Safe to call on any text — non-PII content
    passes through unchanged.
    """
    for pattern, replacement in _PATTERNS:
        text = pattern.sub(replacement, text)
    return text


def hash_for_audit(text: str) -> str:
    """One-way hash for audit correlation without PII exposure.

    Returns a 16-character hex prefix of the SHA-256 hash. Deterministic
    (same input always produces same hash) so logs can be correlated
    without storing raw text.
    """
    return hashlib.sha256(text.encode("utf-8")).hexdigest()[:16]

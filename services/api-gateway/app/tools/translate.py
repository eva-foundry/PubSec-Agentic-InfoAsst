"""Translation tool — EN/FR translation via Azure Translator.

Currently returns a mock translation. When Azure Translator is wired in,
only the internals of ``execute`` change.
"""

from __future__ import annotations

import time

from .registry import Tool, ToolMetadata


class TranslationTool(Tool):
    """EN/FR translation via Azure Translator."""

    metadata = ToolMetadata(
        name="translate",
        description="EN\u2194FR translation via Azure Translator",
        classification_ceiling="sensitive",
        data_residency="canada_central",
        bilingual=True,
        hitl_required=False,
    )

    async def execute(self, **kwargs) -> dict:
        """Translate text between English and French.

        Parameters
        ----------
        text : str
            The text to translate.
        source_lang : str
            Source language code (``en`` or ``fr``).
        target_lang : str
            Target language code (``en`` or ``fr``).

        Returns
        -------
        dict
            ``translated_text`` and ``duration_ms``.
        """
        text: str = kwargs["text"]
        source_lang: str = kwargs.get("source_lang", "en")
        target_lang: str = kwargs.get("target_lang", "fr")

        start = time.monotonic()

        # Mock translation — replaced by Azure Translator SDK later
        if source_lang == target_lang:
            translated = text
        else:
            translated = f"[{target_lang.upper()} translation of: {text}]"

        duration_ms = int((time.monotonic() - start) * 1000)

        return {
            "translated_text": translated,
            "source_lang": source_lang,
            "target_lang": target_lang,
            "duration_ms": duration_ms,
        }

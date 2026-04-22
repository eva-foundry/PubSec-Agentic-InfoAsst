"""Pre-load sample documents into the vector store at startup.

Maps sample .txt files to their target workspaces so the demo is
immediately usable without manual uploads.
"""

from __future__ import annotations

import logging
import os

from ..stores.compat import aio
from .local_processor import LocalDocumentProcessor

logger = logging.getLogger(__name__)

SAMPLE_DOCS_DIR = os.path.join(
    os.path.dirname(__file__), "..", "..", "..", "..", "data", "sample-documents"
)

# workspace_id -> list of sample filenames to pre-load
WORKSPACE_DOCS: dict[str, list[str]] = {
    "ws-oas-act": ["nhl-cba-excerpt.txt", "nhl-bylaws-excerpt.txt"],
    "ws-ei-juris": ["dops-ruling-sample.txt", "nhl-rulebook-excerpt.txt"],
    "ws-faq": ["faq-general.txt"],
}


async def preload_sample_documents(
    processor: LocalDocumentProcessor,
    workspace_store,
) -> None:
    """Load sample documents into the vector store for immediate demo use."""
    total = 0
    for workspace_id, files in WORKSPACE_DOCS.items():
        workspace = await aio(workspace_store.get(workspace_id))
        archetype = workspace.type if workspace else "default"

        for filename in files:
            filepath = os.path.join(SAMPLE_DOCS_DIR, filename)
            if not os.path.exists(filepath):
                logger.warning("Sample document not found: %s", filepath)
                continue

            with open(filepath, "rb") as f:
                content = f.read()

            record = await processor.process(
                workspace_id,
                filename,
                content,
                archetype=archetype,
                uploaded_by="system-preload",
            )
            logger.info(
                "Pre-loaded %s -> %s (status=%s, chunks=%d)",
                filename,
                workspace_id,
                record.status,
                record.chunk_count,
            )
            total += 1

    logger.info("Pre-loaded %d sample documents across %d workspaces", total, len(WORKSPACE_DOCS))

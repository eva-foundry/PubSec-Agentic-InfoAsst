"""Blob storage utilities for the document processing pipeline.

Provides async helpers for uploading, downloading, listing, and deleting
chunk blobs, plus SAS URL generation for read-only access.
"""
from __future__ import annotations

import json
import logging
from datetime import datetime, timedelta, timezone
from typing import Protocol

from opentelemetry import trace

logger = logging.getLogger(__name__)
tracer = trace.get_tracer(__name__)


class BlobContainerClient(Protocol):
    """Protocol for Azure Blob container operations (async)."""

    async def upload_blob(self, name: str, data: bytes, overwrite: bool = False) -> None: ...
    async def download_blob(self, blob: str) -> "BlobDownloader": ...
    async def delete_blob(self, blob: str) -> None: ...


class BlobDownloader(Protocol):
    """Protocol for blob download stream."""

    async def readall(self) -> bytes: ...


class BlobServiceProtocol(Protocol):
    """Protocol for BlobServiceClient (async) -- used for SAS generation."""

    @property
    def account_name(self) -> str: ...

    def get_user_delegation_key(
        self, key_start_time: datetime, key_expiry_time: datetime
    ) -> object: ...


class BlobLister(Protocol):
    """Protocol for listing blobs by prefix."""

    def list_blobs(self, name_starts_with: str | None = None) -> "AsyncBlobIterator": ...


class AsyncBlobIterator(Protocol):
    """Protocol for async iteration over blob items."""

    def __aiter__(self) -> "AsyncBlobIterator": ...
    async def __anext__(self) -> object: ...


@tracer.start_as_current_span("blob.upload_chunk")
async def upload_chunk(
    container_client: BlobContainerClient,
    blob_path: str,
    chunk_data: dict,
) -> None:
    """Upload a JSON chunk to blob storage."""
    data = json.dumps(chunk_data, ensure_ascii=False).encode("utf-8")
    await container_client.upload_blob(blob_path, data, overwrite=True)
    logger.info("Chunk uploaded", extra={"blob_path": blob_path, "size_bytes": len(data)})


@tracer.start_as_current_span("blob.download_blob")
async def download_blob(
    container_client: BlobContainerClient,
    blob_path: str,
) -> bytes:
    """Download blob content as bytes."""
    downloader = await container_client.download_blob(blob_path)
    content = await downloader.readall()
    logger.info("Blob downloaded", extra={"blob_path": blob_path, "size_bytes": len(content)})
    return content


@tracer.start_as_current_span("blob.list_blobs")
async def list_blobs(
    container_client: BlobLister,
    prefix: str,
) -> list[str]:
    """List blob names matching a prefix."""
    names: list[str] = []
    async for blob in container_client.list_blobs(name_starts_with=prefix):
        names.append(blob.name)  # type: ignore[attr-defined]
    logger.info("Blobs listed", extra={"prefix": prefix, "count": len(names)})
    return names


@tracer.start_as_current_span("blob.delete_blobs")
async def delete_blobs(
    container_client: BlobContainerClient & BlobLister,  # type: ignore[type-arg]
    prefix: str,
) -> int:
    """Delete all blobs matching a prefix. Returns count of deleted blobs."""
    blob_names = await list_blobs(container_client, prefix)
    for name in blob_names:
        await container_client.delete_blob(name)
    logger.info("Blobs deleted", extra={"prefix": prefix, "count": len(blob_names)})
    return len(blob_names)


def generate_sas_url(
    account_name: str,
    container: str,
    blob_path: str,
    account_key: str,
    expiry_hours: int = 2,
) -> str:
    """Generate a read-only SAS URL for a blob.

    Uses account-key-based SAS. In production, prefer user-delegation SAS
    via Managed Identity, but that requires async calls to get the delegation key.
    """
    from azure.storage.blob import BlobSasPermissions, generate_blob_sas

    expiry = datetime.now(timezone.utc) + timedelta(hours=expiry_hours)

    sas_token = generate_blob_sas(
        account_name=account_name,
        container_name=container,
        blob_name=blob_path,
        account_key=account_key,
        permission=BlobSasPermissions(read=True),
        expiry=expiry,
    )

    return f"https://{account_name}.blob.core.windows.net/{container}/{blob_path}?{sas_token}"

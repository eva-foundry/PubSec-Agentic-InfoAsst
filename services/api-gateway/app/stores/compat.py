"""Async compatibility layer for dual-mode stores.

In-memory stores return values directly (sync).
Azure-backed stores return coroutines (async).
This module provides a single helper so routers work with both.

Usage in routers::

    from ..stores.compat import aio

    ws = await aio(workspace_store.get(workspace_id))
    items = await aio(booking_store.list_all())
"""

from __future__ import annotations

import inspect


async def aio(result):
    """Resolve a store call that may be sync (returns value) or async (returns coroutine).

    For in-memory stores: method() returns a value → returned as-is.
    For Azure stores:     method() returns a coroutine → awaited and result returned.
    """
    if inspect.isawaitable(result):
        return await result
    return result

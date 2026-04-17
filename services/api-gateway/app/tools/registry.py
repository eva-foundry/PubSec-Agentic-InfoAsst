"""Tool registry — declares metadata and manages tool lifecycle."""

from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass


@dataclass
class ToolMetadata:
    """Metadata every tool must declare at registration time.

    Classification ceiling, data residency, bilingual support, and HITL
    requirements are architectural invariants enforced at the registry level.
    """

    name: str
    description: str
    classification_ceiling: str  # "unclassified" | "protected_a" | "protected_b"
    data_residency: str  # "canada_central" | "canada_east"
    bilingual: bool
    hitl_required: bool


class Tool(ABC):
    """Base class for all tools in the EVA agent pipeline."""

    metadata: ToolMetadata

    @abstractmethod
    async def execute(self, **kwargs) -> dict:
        """Execute the tool with the given keyword arguments and return results."""
        ...


class ToolRegistry:
    """Registry of available tools.

    All tools must be registered before the orchestrator starts.
    The registry enforces that tool names are unique and provides
    lookup by name plus enumeration of all tool metadata.
    """

    def __init__(self) -> None:
        self._tools: dict[str, Tool] = {}

    def register(self, tool: Tool) -> None:
        """Register a tool. Raises ValueError if a tool with the same name exists."""
        name = tool.metadata.name
        if name in self._tools:
            raise ValueError(f"Tool '{name}' is already registered")
        self._tools[name] = tool

    def get_tool(self, name: str) -> Tool:
        """Retrieve a tool by name. Raises KeyError if not found."""
        if name not in self._tools:
            raise KeyError(f"Tool '{name}' is not registered")
        return self._tools[name]

    def list_tools(self) -> list[ToolMetadata]:
        """Return metadata for all registered tools."""
        return [t.metadata for t in self._tools.values()]

    def has_tool(self, name: str) -> bool:
        """Check whether a tool with the given name is registered."""
        return name in self._tools

    def __len__(self) -> int:
        return len(self._tools)

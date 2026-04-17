"""OpenTelemetry SDK initialization for Azure Monitor export.

Configures tracing and metrics export to Application Insights via the
Azure Monitor OpenTelemetry exporter. In local dev (no connection string),
falls back to console export for visibility.
"""

from __future__ import annotations

import logging
from functools import lru_cache

from opentelemetry import trace
from opentelemetry.sdk.resources import Resource
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor, ConsoleSpanExporter

from ..config import settings

logger = logging.getLogger("eva.core.telemetry")


def init_telemetry() -> None:
    """Initialize OpenTelemetry with Azure Monitor exporter.

    Call once at application startup (main.py).
    """
    resource = Resource.create(
        {
            "service.name": "eva-agentic-api-gateway",
            "service.version": "0.1.0",
            "deployment.environment": "production"
            if settings.auth_mode == "production"
            else "development",
            "cloud.provider": "azure",
            "cloud.region": "canadacentral",
        }
    )

    provider = TracerProvider(resource=resource)

    if settings.appinsights_connection_string:
        try:
            from azure.monitor.opentelemetry.exporter import AzureMonitorTraceExporter

            exporter = AzureMonitorTraceExporter(
                connection_string=settings.appinsights_connection_string
            )
            provider.add_span_processor(BatchSpanProcessor(exporter))
            logger.info("OTEL: Azure Monitor exporter configured")
        except ImportError:
            logger.warning(
                "azure-monitor-opentelemetry-exporter not installed — using console exporter"
            )
            provider.add_span_processor(BatchSpanProcessor(ConsoleSpanExporter()))
        except Exception as exc:
            logger.error(
                "OTEL: Failed to init Azure Monitor exporter: %s — falling back to console", exc
            )
            provider.add_span_processor(BatchSpanProcessor(ConsoleSpanExporter()))
    else:
        provider.add_span_processor(BatchSpanProcessor(ConsoleSpanExporter()))
        logger.info("OTEL: No App Insights connection string — using console exporter")

    trace.set_tracer_provider(provider)


@lru_cache
def get_tracer(name: str = "eva.orchestrator") -> trace.Tracer:
    """Get a named tracer instance."""
    return trace.get_tracer(name)

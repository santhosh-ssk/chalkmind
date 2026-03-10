"""Langfuse observability for AI agent tracing."""

import logging
import os
from typing import Any

logger = logging.getLogger(__name__)

_langfuse = None

def _get_langfuse():
    global _langfuse
    if _langfuse is not None:
        return _langfuse
    secret = os.getenv("LANGFUSE_SECRET_KEY")
    public = os.getenv("LANGFUSE_PUBLIC_KEY")
    host = os.getenv("LANGFUSE_BASE_URL") or os.getenv("LANGFUSE_HOST", "https://cloud.langfuse.com")
    if not secret or not public:
        logger.info("Langfuse env vars not set — tracing disabled")
        _langfuse = False
        return False
    try:
        from langfuse import Langfuse
        _langfuse = Langfuse(secret_key=secret, public_key=public, host=host)
        logger.info("Langfuse initialized (host=%s)", host)
        return _langfuse
    except Exception as e:
        logger.warning("Failed to initialize Langfuse: %s", e)
        _langfuse = False
        return False


def create_trace(name: str, metadata: dict[str, Any] | None = None):
    """Create a Langfuse trace. Returns the trace object or None."""
    client = _get_langfuse()
    if not client:
        return None
    try:
        return client.trace(name=name, metadata=metadata or {})
    except Exception as e:
        logger.warning("Failed to create Langfuse trace: %s", e)
        return None


def trace_agent_call(
    trace,
    agent_name: str,
    input_text: str,
    output_text: str,
    latency_ms: float,
    metadata: dict[str, Any] | None = None,
    error: str | None = None,
):
    """Create a span on the trace for an agent invocation."""
    if trace is None:
        return None
    try:
        span = trace.span(
            name=agent_name,
            input=input_text,
            output=output_text,
            metadata=metadata or {},
        )
        span.update(
            level="ERROR" if error else "DEFAULT",
            status_message=error if error else f"Completed in {latency_ms:.0f}ms",
        )
        return span
    except Exception as e:
        logger.warning("Failed to create Langfuse span: %s", e)
        return None


def flush():
    """Flush any pending Langfuse events."""
    client = _get_langfuse()
    if client:
        try:
            client.flush()
        except Exception:
            pass

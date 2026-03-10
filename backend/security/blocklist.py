"""Prompt injection detection patterns.

Open for extension: add new patterns to INJECTION_PATTERNS without modifying check logic.
"""

import re

INJECTION_PATTERNS: list[re.Pattern[str]] = [
    re.compile(p, re.IGNORECASE)
    for p in [
        r"ignore\s+(all\s+)?(previous|prior|above)\s+(instructions|prompts|rules)",
        r"disregard\s+(all\s+)?(previous|prior|above|your)",
        r"you\s+are\s+now\s+",
        r"system\s*prompt",
        r"act\s+as\s+(if\s+you\s+are|a)\s+",
        r"jailbreak",
        r"\bDAN\b",
        r"do\s+anything\s+now",
        r"pretend\s+(you\s+are|to\s+be)",
        r"forget\s+(all\s+)?(previous|prior|your)\s+(instructions|rules|prompts)",
        r"override\s+(your|all|the)\s+(instructions|rules|safety|filters)",
        r"bypass\s+(your|all|the)\s+(restrictions|filters|safety)",
        r"new\s+instructions?\s*:",
        r"reveal\s+(your|the)\s+(system|initial|original)\s+(prompt|instructions)",
    ]
]


def check_injection(text: str) -> bool:
    """Return True if text matches any prompt injection pattern."""
    return any(pattern.search(text) for pattern in INJECTION_PATTERNS)

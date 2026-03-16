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


SENSITIVE_TOPIC_PATTERNS: list[re.Pattern[str]] = [
    re.compile(p, re.IGNORECASE)
    for p in [
        # Weapons / Violence
        r"\b(how\s+to\s+)?(build|make|create|assemble)\s+(a\s+)?(bomb|explosive|grenade|detonator)",
        r"\b(how\s+to\s+)?(kill|murder|assassinate|hurt|attack|stab|shoot)\s+(a\s+)?(\w+)",
        r"\b(weapon|firearm|gun|ammunition|ammo)\s+(making|manufacturing|assembly|building)",
        r"\b(poison|poisoning)\s+(someone|a\s+person|people)",
        # Drugs / Illegal substances
        r"\b(how\s+to\s+)?(make|cook|synthesize|manufacture|produce)\s+(meth|crack|cocaine|heroin|fentanyl|drugs|lsd|mdma|ecstasy)",
        r"\b(drug\s+manufacturing|illegal\s+substance|narcotics?\s+production)",
        # Self-harm
        r"\b(how\s+to\s+)?(commit\s+)?suicide\b",
        r"\bself[- ]harm",
        r"\b(how\s+to\s+)(cut|hang|drown|suffocate)\s+(my|your)self",
        r"\b(ways\s+to\s+die|end\s+my\s+life|kill\s+myself)",
        # Harassment / Hate
        r"\b(how\s+to\s+)(bully|harass|stalk|intimidate|threaten)\b",
        r"\bhate\s+speech\b",
        r"\b(how\s+to\s+)discriminate\s+against\b",
        # Sexual / CSAM
        r"\bchild\s+(porn|exploitation|abuse|sexual)",
        r"\bsexually\s+explicit\s+(content|material|images)",
        # Hacking / Cyber crime
        r"\bhow\s+to\s+hack\b",
        r"\bhack\s+into\b",
        r"\b(exploit\s+vulnerabilit|DDoS|ransomware|steal\s+passwords|phishing\s+attack)",
        r"\b(how\s+to\s+)(bypass|crack)\s+(security|passwords|encryption)",
    ]
]


def check_sensitive_topic(text: str) -> bool:
    """Return True if text matches any sensitive/dangerous topic pattern."""
    return any(pattern.search(text) for pattern in SENSITIVE_TOPIC_PATTERNS)

import hmac


def wipe_confirmation_matches(device_id: int, confirmation: str) -> bool:
    """Require an operator to type the exact device-specific wipe phrase."""
    return hmac.compare_digest(confirmation.strip(), f"WIPE {device_id}")

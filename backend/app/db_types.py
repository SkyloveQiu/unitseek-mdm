"""Database types that remain portable across supported SQL dialects."""

from sqlalchemy import JSON
from sqlalchemy.dialects.postgresql import JSONB


JSON_DOCUMENT = JSON().with_variant(JSONB, "postgresql")

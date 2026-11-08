"""Compatibility names. This implementation is semantic gap ranking, NOT TDA."""
from .content_gaps import ContentGapEngine, ContentWhitespace

TDAWhitespaceEngine = ContentGapEngine
__all__ = ["ContentGapEngine", "ContentWhitespace", "TDAWhitespaceEngine"]

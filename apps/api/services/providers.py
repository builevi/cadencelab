"""Single selection point for all current structured text inference."""
import os
from .codex_local import CodexLocal
from .semantic import GitHubModels, ProviderError, validate_batch
from .compatible import runtime_config, CompatibleProvider


class FallbackProvider:
    name='github_then_codex'
    model='configured_codex_model'
    full_batch=True

    def __init__(self,primary=None,fallback=None):
        self.primary=primary or GitHubModels.from_environment()
        self.fallback=fallback or CodexLocal()
        self.used_provider=None
        self.fallback_reason=None

    def generate(self,payload):
        try:
            result=self.primary.generate(payload)
            validate_batch(result,payload['module_ids'],payload['posts'])
            self.used_provider='github_models';self.model=self.primary.model
            return result
        except ProviderError as exc:
            self.fallback_reason=str(exc)
            result=self.fallback.generate(payload)
            self.used_provider='codex_local';self.model=self.fallback.model
            return result


def configured_provider():
    # Explicit env switch. Local is the temporary default requested for development.
    config=runtime_config()
    if config is not None:
        return CodexLocal() if config.provider=='codex_local' else CompatibleProvider(config)
    name=os.getenv('SOCIALLENS_AI_PROVIDER','codex_local')
    if name=='codex_local': return CodexLocal()
    if name=='github_models': return GitHubModels.from_environment()
    if name=='github_then_codex': return FallbackProvider()
    raise ProviderError('unknown_ai_provider')


def configured_structured_provider():
    provider=configured_provider()
    if not hasattr(provider,'generate_structured'):
        raise ProviderError('provider_structured_output_unavailable')
    return provider

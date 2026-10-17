/**
 * Prime's provider ids are lowercase slugs. A group headed "anthropic"
 * beside one headed "Prime Agent" looks like two different kinds of thing;
 * these are the names people actually use.
 */
const PROVIDER_LABELS: Record<string, string> = {
  anthropic: 'Anthropic',
  openai: 'OpenAI',
  'openai-codex': 'ChatGPT (Codex)',
  openrouter: 'OpenRouter',
  opencode: 'OpenCode',
  'opencode-go': 'OpenCode Go',
  'prime-inference': 'Prime Inference',
  xai: 'xAI (Grok)',
  google: 'Google',
  deepseek: 'DeepSeek',
  'nous-portal': 'Nous Portal',
  /** Mock-app catalog id from `get_available_prime_models`. */
  mock: 'Mock',
}

/** Map a Prime provider id (`nous-portal`) to a display name (`Nous Portal`). */
export function primeProviderLabel(name: string): string {
  const key = name.trim()
  if (!key) return key
  return PROVIDER_LABELS[key] ?? PROVIDER_LABELS[key.toLowerCase()] ?? key
}

---
session: 2026-10-17T01:15Z
model: Grok 4.6 (Cursor)
description: >-
  Settings API provider presets prefill official base URLs and open
  each provider's key page in the system browser. Storage unchanged.
commits: this slice
---

# Provider presets in Settings

**Origin:** Grok 4.6 (Cursor) · 2026-10-17

Popular hosted providers (Anthropic, OpenAI, xAI, Google Gemini,
OpenRouter, Groq, Mistral, DeepSeek) now live in one typed table at
`src/lib/providerPresets.ts`. Selecting a row prefills name, kind, and
base URL. The URL stays editable. Get API key uses `openExternalUrl`.
Sign-in, OAuth, and `prime_login` were not touched.

## C-numbers

None.

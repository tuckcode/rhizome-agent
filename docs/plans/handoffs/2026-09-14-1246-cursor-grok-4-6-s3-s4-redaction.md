---
session: 2026-09-14T12:46-05:00
model: Grok 4.6 (Cursor)
description: >-
  Astra S3+S4. Prefix scan continues after a short match.
  Diagnostic keys cover api_key/apiKey/ENV. Serializer and
  Sentry scrub drop non-string sensitive values. No commit.
commits: none
---

# Astra S3+S4 — credential scan and diagnostics — 2026-09-14 12:46

**Origin:** Cursor Grok 4.6 · Astra S3/S4 implementation · no commit

**Result: source PASS.** Focused vitest 45/45. Did not commit.
Did not rebuild `/Applications`. Did not inspect real secrets,
ENV, `~/.prime`, or vaults. Did not edit mcp-server.

HEAD at pickup: `4416411`. Owned files only.

## What changed

**S3.** `findCredentialSpan` now keeps searching the same prefix
after a short/invalid body. `sk-short,` plus a valid-length `sk-`
token in one segment is redacted. CSS classes (`sk-circle` and
friends) stay. Isolated valid tokens still work. Earliest valid
span across prefixes is kept. Forward progress is `index + 1`.

`sanitizeDiagnosticText` now replaces credential *spans*, not the
whole whitespace segment. That keeps the short prefix visible
(`sk-short,[redacted-token]`) instead of wiping the segment.

**S4.** `isSensitiveDiagnosticKey({ text })` export shape is
unchanged. Matching lowercases and strips `_` / `-`, and treats
`apikey` as sensitive. So `api_key`, `apiKey`, and
`OPENAI_API_KEY` match.

`safeSerialize` redacts the whole value when the key is
sensitive, any type. `scrubRecord` does the same for Sentry
`extra` / `tags` / `contexts` / `request` / breadcrumb data.

`sanitizeDiagnosticText` also covers assignment text, Authorization
and Cookie headers, and `http(s)` query / userinfo. Promotion
helper `redactCredentialTokens` stays prefix-only for plain
passwords (COVERAGE_LIMITATION).

## Files changed

- `src/lib/sensitiveTextRedaction.ts`
- `src/lib/sensitiveTextRedaction.test.ts`
- `src/lib/feedbackDiagnostics.ts`
- `src/lib/feedbackDiagnostics.test.ts`
- `src/lib/telemetry.ts`
- `src/lib/telemetry.test.ts`

Not edited: mcp-server, `.gitignore`, living docs, App.tsx.

## Tests

Added S3 cases: short-before-long in one segment (both helpers,
plus `count > 0`), several invalid then one valid, multiple valid
tokens, adjacent JSON punctuation, ordinary prose / CSS unchanged,
prefix-only password assignment left intact.

Added S4 cases: key-name normalization, assignment / header / URL
query / userinfo in `sanitizeDiagnosticText`, nested and non-string
fields in the optional feedback bundle, Sentry `beforeSend` scrub
without network.

```
npx vitest run src/lib/sensitiveTextRedaction.test.ts \
  src/lib/feedbackDiagnostics.test.ts src/lib/telemetry.test.ts
```

45 passed (19 + 3 + 23). ESLint clean on owned files.

## Remaining gaps

- `redactCredentialTokens` does not count `password=` / `API_KEY=`
  prose. Promotion still keys off prefix tokens only.
- Bare opaque text with no prefix, key, header, or URL is not
  redacted. Do not claim arbitrary prose is safe.
- URL userinfo replace uses decoded `URL` parts. Encoded userinfo
  that does not match those parts can survive.
- Only `http://` and `https://` URLs are parsed.
- `includes` matching is still broad (`session` hits `sessionId`).
  A Sentry `contexts.session` object would be replaced wholesale.
- No new output allowlist. Bundle header fields were already fixed.
- Vault helper contract unchanged (other owner).

## Not done

Commit. Push. `/Applications` rebuild. Living-doc index update.
Codacy / full suite. Native QA.

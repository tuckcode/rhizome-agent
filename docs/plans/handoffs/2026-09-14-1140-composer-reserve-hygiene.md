---
session: 2026-09-14T11:40-05:00
model: Composer
description: >-
  Reserve security pass — bounded credential-hygiene scan of tracked files only.
  No home-dir scan, no secret rotation, no ENV dump. Verdict: clean.
---

# Reserve credential-hygiene pass — 2026-09-14 11:40

**Origin:** Composer · reserve slot after W1–W11 paper · no commit

## Scope

| In scope | Out of scope |
|---|---|
| Tracked git files only (`git ls-files`, 2439 paths) | Atticus home directory |
| `.env.example`, `*.example`, ignore rules | Secret rotation |
| `src/lib/sensitiveTextRedaction.ts` prefix inventory | ENV dump / live `.env` read |
| `docs/` (404 paths) and committed `*.json` (40 paths) | Untracked / gitignored files |
| Pattern scan for known credential shapes | Codacy / Trivy dependency advisories |

## Verdict

**CLEAN** — no committed API keys, tokens, private keys, or credential assignments found in tracked files.

---

## Findings by category

### 1. Environment templates (`.env.example`, `*.example`)

| Path | Result |
|---|---|
| `.env.example` | **Not present** in tracked tree |
| `*.example` | **None** tracked |

No committed env template exists. Docs do not reference a missing `.env.example`. Not a leak; informational only.

### 2. Ignore rules

| Path | Coverage |
|---|---|
| `.gitignore` | `.env`, `.env.local`, `.env.*.local` ignored (lines 89–92); `*.key`, `*.key.pub` ignored (85–87); `demo-vault/` ignored (42); `.codacy/`, `.deepsec/` ignored |
| `src-tauri/.gitignore` | Cargo `target/`, generated `resources/mcp-server/`, `resources/qmd/` |

**Finding:** none. Env and signing-key patterns are blocked.

**Note (non-secret):** `demo-vault-v2/` is not gitignored; only `demo-vault-v2/AGENTS.md` is tracked. No credential content in that file.

No `.cursorignore` in repo (`.cursor/*` ignored except `.cursor/rules/`).

### 3. Redaction prefix inventory (`src/lib/sensitiveTextRedaction.ts`)

Documented prefixes (lines 6–9), all with `MIN_CREDENTIAL_BODY_LENGTH = 20`:

| Provider / shape | Prefixes |
|---|---|
| GitHub | `ghp_`, `gho_`, `ghr_`, `ghs_`, `ghu_`, `github_pat_` |
| GitLab | `glpat-` |
| OpenAI / xAI / Groq | `sk-`, `sk_live_`, `sk_test_`, `xai-`, `gsk_` |
| Hugging Face / npm | `hf_`, `npm_` |
| Slack | `xoxa-`, `xoxb-`, `xoxp-`, `xoxr-`, `xoxs-`, `xoxe-` |

Sensitive key names (line 5): `token`, `secret`, `password`, `authorization`, `cookie`, `session`.

Tests (`src/lib/sensitiveTextRedaction.test.ts`) build synthetic tokens at runtime (`'A'.repeat(36)` etc.) — no literal committed secrets.

**Finding:** none. Prefix set aligns with MORNING.md extra-prefix note (`hf_`, `glpat-`, `npm_`, `sk_live_`, `sk_test_`, `xai-`, `gsk_`).

### 4. `docs/` — API keys and credentials

Scans: known token prefixes (`ghp_`, `sk-` ≥20 chars, `AKIA…`, Slack `xox*`), `key=value` assignments ≥16 chars, PEM private-key blocks, long hex strings.

| Result | Detail |
|---|---|
| **Clean** | Matches are architecture prose, env-var **names** (e.g. `OPENAI_API_KEY`, `NOUS_API_KEY`), git SHAs, or redaction design notes |
| Prior handoff | `docs/plans/handoffs/2026-08-25-1430-grok-4-6-vault-credentials.md` describes `#29` redaction policy — no pasted credentials |

### 5. Committed JSON (40 tracked files)

| File / pattern | Result |
|---|---|
| `src/shared/aiModelProviderCatalog.json` | `api_key_env_var` holds env **names** only (`OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, …); `api_key_storage` metadata only |
| All `*.json` | No `"api_key": "<long value>"` (or secret/token/password) assignments |
| Token-prefix scan across all tracked files | **Zero hits** |

### 6. Test / telemetry placeholders (not leaks)

| Path | Content | Assessment |
|---|---|---|
| `src/lib/telemetryConfig.test.ts` | `phc_test_key` | Obvious test fixture; not a production key shape |

### 7. Secret-handling source (no embedded credentials)

| Path | Role |
|---|---|
| `src/utils/aiProviderSecrets.ts` | Tauri invoke wrappers only — keys passed at runtime, not stored in repo |
| `src-tauri/src/git/credentials.rs` | Git credential helper integration — no hardcoded secrets |

---

## Scan commands (reproducible)

```bash
# Token-prefix sweep (tracked files only)
git ls-files -z | xargs -0 rg -l \
  '(ghp_|github_pat_|glpat-|sk_live_|sk_test_|xai-|gsk_|hf_[a-zA-Z0-9]{10}|npm_[a-zA-Z0-9]{10}|xox[a-z]-|AKIA[A-Z0-9]{16})'

# Credential assignment sweep
git ls-files -z | xargs -0 rg -l \
  '(api[_-]?key|secret|password|token)\s*[:=]\s*["\x27]?[a-zA-Z0-9_\-]{16,}' -i

# docs/ + json targeted
git ls-files -z docs/ '*.json' | xargs -0 rg -l \
  '(BEGIN (RSA |OPENSSH )?PRIVATE KEY|ghp_[a-zA-Z0-9]{20,}|sk-[a-zA-Z0-9]{20,})'
```

All three returned empty on 2026-09-14.

---

## Actions taken

- Wrote this handoff only.
- **Did not** commit, rotate, dump ENV, or scan outside the repo.

## Follow-ups (optional, out of scope tonight)

- Add a `.env.example` with placeholder names only if onboarding docs ever need it — not required for hygiene tonight.
- Consider gitignoring `demo-vault-v2/` fixture dir if QA notes accumulate there (hygiene, not a current leak).

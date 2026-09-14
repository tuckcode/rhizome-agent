---
session: 2026-09-14T16:29-05:00
model: Grok 4.6 (Cursor)
description: >-
  C18 Welcome leftover: onboarding.welcome.templateDescription still
  says Download the Getting Started vault. Key locked this window.
  Hardcoded English later is fine. Do not rewrite en.json.
commits: none
---

# C18 — Welcome Download words leftover

**Origin:** Cursor Grok 4.6 · 2026-09-14 16:29 · findings only. No commit.

Sources: `docs/HANDOFF.md` **C18-DECIDED** · `AGENTS.md` Localization
(2026-08-29) · `src/lib/locales/en.json` · `src/components/WelcomeScreen.tsx`.

Did not edit product code. Did not rewrite `en.json`. Did not git add.

## C18 (current rule)

**DECIDED — English only for v0.** Atticus 2026-08-16 / 2026-08-21 /
2026-08-29. Do not report missing locales as a blocker. Do not run
`pnpm l10n:translate`. `pnpm l10n:validate` failing is the expected state.

**2026-08-29 update (AGENTS.md wins over the older C18 sentence):**

- A hardcoded English string in a component is fine.
- Do **not** migrate existing strings into or out of `en.json`.
- Keys already there stay. Removing them is the same churn as adding them.

HANDOFF C18 still says “still put user-facing copy in `en.json`.” That
line is **stale** relative to the 2026-08-29 drop. Do not use it to
justify an `en.json` rewrite this window.

## Measured key

`src/lib/locales/en.json` line 82:

```
"onboarding.welcome.templateDescription": "Download the Getting Started vault"
```

`WelcomeScreen` still reads that key via `translate()` in both `welcome`
and missing-vault modes (`getWelcomeScreenPresentation`). The first-run
card shows those exact words. Tests pin them
(`WelcomeScreen.test.tsx`: “shows the simplified template option
description” and “keeps those Download words in en.json — C18”).

The default first-run path is a **local** scaffold
(`create_getting_started_vault` unless `RHIZOME_GETTING_STARTED_REPO_URL`
is set). The Download / clone wording is stale copy, not a missing
scaffold. C11 remote starter stays deferred.

## This window (locked)

- **Do not rewrite `en.json`.**
- **Do not migrate** `onboarding.welcome.templateDescription` out of
  `en.json`.
- The key stays `"Download the Getting Started vault"`.
- Hardcoded English **later** is fine (AGENTS.md C18). Not this file.

Prior same leftover: [1449](2026-09-14-1449-cursor-grok-4-6-welcome-download-copy.md),
[1468](2026-09-14-1468-cursor-grok-4-6-restore-c18.md),
[1497](2026-09-14-1497-cursor-grok-4-6-d6-commands.md).

## Not this window

- No product edit. No commit. No push. No rebuild.
- Do not close C18. Do not re-open localization.

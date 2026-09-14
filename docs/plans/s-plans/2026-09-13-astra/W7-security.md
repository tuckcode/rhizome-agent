# W7 — HOME vault and MCP scope

**Owner:** existing Cursor security sibling, Grok.
**Start:** continue now. Follow the [parent contract](README.md).

Read #46 and the current security diff. Claim the affected Rust and MCP paths before further changes.

1. Verify rejection across explicit, configured, and fallback vault paths.
2. Test HOME aliases, symlinks, tilde expansion where accepted, and normal nested vaults.
3. Prove global Prime settings remain unchanged.
4. Review global skill cleanup for provenance, user-authored content, and observable errors.
5. Keep all cleanup tests in temporary fixtures. Inspect call paths before running seed tests.
6. Run focused Rust checks, `pnpm test:mcp`, and required local analysis.
7. Release shared paths to W4 at a tested checkpoint.

**Review leads:** JavaScript currently uses lexical `resolve`. Global skill cleanup currently deletes by directory name and discards its error.
Recheck these observations against your current diff before acting.

**Done:** unsafe roots cannot expose HOME or alter global settings. Normal vault tools and vault-less Chat remain usable.
**Stop:** uncertain ownership requires preserving content. No global cleanup by name alone. No unrelated scanner or dependency project.
Residual #29 redaction work stays a separate bounded slice if already owned.

Daily-drive security requires the known #46 fix and safe handling at changed credential boundaries.
Use synthetic ENV/password/API-key fixtures. Verify redaction without exposing real values.
Broader credential hygiene is reserve work only after actionable W1–W11 tasks and daily-drive checks finish.
Follow the God plan's reserve limits. Do not search HOME, dump ENV, rotate keys, or rewrite user configuration.

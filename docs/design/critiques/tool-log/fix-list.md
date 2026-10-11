# Fix list: Tool log note

Source critique: [2026-10-10-design.md](./2026-10-10-design.md). When a new version comes in, change the status to `fixed` or `won't fix` instead of deleting the row.

**Open:** 1 blocker · 5 worth fixing · 3 minor

| ID | Severity | Category | Finding | Fix (tokens) | Status | First seen |
|---|---|---|---|---|---|---|
| T-B1 | blocker | hierarchy and layout | Note body is ~30 lines of raw run events ("[tool] Read is running.") | Answer as the body; one collapsed "Run log" with mono rows per tool; lifecycle only on failure | open | 2026-10-10 |
| T-W1 | worth fixing | hierarchy and layout | No H1 or answer; opens with the quoted prompt | H1 title → Answer summary → "Asked:" in `--muted` | open | 2026-10-10 |
| T-W2 | worth fixing | hierarchy and layout | "agent: / mode:" as body text | Frontmatter → properties panel or mono chips | open | 2026-10-10 |
| T-W3 | worth fixing | copy | Grok CLI vs Hermes vs Claude Code on the same screen | Chat empty state and chip name the same agent; provenance separate | open | 2026-10-10 |
| T-W4 | worth fixing | color | Selected row uses a mint border + olive fill | `--state-selected` + 2px `--accent` left bar | open | 2026-10-10 |
| T-W5 | worth fixing | hierarchy and layout | Empty AI Chat panel ~28% of the width | Collapsed by default | open | 2026-10-10 |
| T-M1 | minor | interaction and states | Block handle floats on every log line | Single log block | open | 2026-10-10 |
| T-M2 | minor | hierarchy and layout | Permanent "No remote" label | Contextual / tooltip dot | open | 2026-10-10 |
| T-M3 | minor | copy | Breadcrumb "Note" vs folder name | Always the folder path | open | 2026-10-10 |

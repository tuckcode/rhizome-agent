# Open issues after the 2026-09-30 pass

**Origin:** Cursor Grok 4.7 · 2026-09-30.

Closed this pass because the tree already does the job: #46, #13, #52, #51. Earlier the same day: #32, #41. Model list #45 is parked. C83, the stall plan, is a separate plan and waits on an Opus review.

## Do not send to a subagent

These still need a product call from Atticus.

- **#5** Parent spec for the Prime harness surface. Children are the work. Do not "implement #5".
- **#40** Is Rhizome a harness, or a client of harnesses? Open decision.
- **#56** `stream_ai_model` is still a second provider path. ADR-0168 is design intent until #56 is resolved. Do not delete that path in a drive-by.

## Ready to build

Each line is one subagent. They do not share files, except #26 and #48 both touch Settings. Do not give those two to two writers at once.

| Issue | What is left | Size |
| --- | --- | --- |
| #23 | Search already indexes session transcripts and skips tool noise. `openSessionTranscriptHit` exists and is tested. The app search box does not call it. Wire a hit so it opens that session at `messageIndex`. | S |
| #26 | Shipped. **Update now** calls `apply_prime_update`, which runs `prime-agent update`. Do not rebuild it. | — |
| #57 | `migrate_legacy_cache` and the agents.md move are gone. `migrate_is_a_to_type` still runs from `lifecycle_cmds.rs` on vault open. Confirm the vault has no remaining `is_a:` notes, migrate that one file if it is still there, then remove the startup call. Do not edit `~/Laputa` except that one migration, and do not commit vault notes. | S |
| #39 | Graph query tools exist (`rhizome_graph_health`, orphans, neighbors, path). The graph is still a screen you open by hand. When a graph tool answers, open the graph on that result. Do not redesign the graph. | M |
| #48 | OmniRoute is not in the tree. Auto-start it the way the Mindwalk sidecar starts, and point an OpenAI-compatible provider at `http://127.0.0.1:20128` after the port is confirmed against a real install. If `omniroute` is not installed, stop and say so. Do not invent the port. | M |
| #50 | The agent cannot read the live window without macOS Accessibility and Screen Recording, and a rebuild drops those permissions. `uiAudit.ts` is a start. Build a view of the running app (element tree, sizes, console) that does not need those permissions. | L |

## Order

1. #23 and #57. Small, and they do not share files.
2. #48 after the stall work. It touches Settings. #26 is already shipped.
3. #39 after the graph tools are left alone by #23.
4. #50 last. It is the large one.

#40 and #56 stay in the queue until Atticus decides. Silence is not a decision.

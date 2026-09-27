# B-15 / C75 — cold-launch transcript remount and Sessions rail

**Origin:** Grok 4.7 · 2026-09-27 · worktree `cursor/wave-3-b15`

Blank shell and Prime spawn were already mitigated. This pass measured the two costs that HANDOFF still names: the full transcript remount, and the Sessions-rail list.

The transcript remount is larger. That mount lives in `AiPanelMessageHistory` (`AiPanelChrome.tsx`), which this task does not own. `AiPanel.tsx` is also out of bounds. The rail was reduced instead.

## Method

Command: `node scripts/measure-cold-launch-cost.mjs`

That runs `src/utils/coldLaunchCost.bench.test.tsx` under Vitest in jsdom. One warmup, then 15 iterations. The figure is the median. The rail is timed first.

What each iteration times:

1. Sessions rail. Render `PrimeSessionList`, flush the `list_prime_session_summaries` promise, and stop when the open-session rows are in the document.
2. Transcript remount. `primeTranscriptToConversation` on the fixture, then commit `AiPanelMessageHistory` with every resulting message.

Fixture, sized from this machine's Prime store on 2026-09-27. The text is synthetic. No session log was copied.

| | Store | Fixture |
|---|---|---|
| Newest log (what idle restore reads) | 333 lines, 469127 bytes | 333 items, 469238 bytes of JSON, 167 chat messages |
| Logs whose first 8 KB mention a message | 96 of 189 files | 96 live rows |

Before is `HEAD` (`5c37d28`) with this same bench, run immediately before the rail change. After is the windowed list, measured again on the final code.

## Numbers

| | Before | After |
|---|---|---|
| Transcript remount, median | 1104.9 ms (min 881.1, max 1338.9) | same code. A later run was 873.8 ms (min 791.2, max 1077.6) |
| Transcript convert | 0.1 ms | 0.1 ms |
| Sessions rail, median | 209.4 ms (min 189.8, max 258.3) | 51.5 ms (min 41.7, max 75.6) |
| Rows mounted | 96 of 96 | 24 of 96 |
| DOM nodes in the rail | 1265 | 329 |

The transcript is the larger cost (about 1105 ms against about 209 ms). The rail change does not touch that path. The later transcript run overlaps the before range. Treat 1104.9 ms as the transcript figure.

The rail after-run maximum (75.6 ms) is below the before-run minimum (189.8 ms).

## What changed

`PrimeSessionList` mounts the first 24 live rows (`SESSION_LIST_WINDOW`). Scroll near the end of the list, or focus the last mounted row, mounts the next 24. Search, filter, and sort still run on the full list, then the window applies. A search that matches a later row still shows that row. Archived rows use the same window once the archive is open.

Row components are memoized, and their handlers take a session id, so a roster poll does not rebuild every button.

## Not done

The transcript remount was not reduced. Doing that means not painting every `AiMessage` on restore. That edit is in `AiPanelChrome.tsx` and the restore call in `AiPanel.tsx`. Both are outside this task's files.

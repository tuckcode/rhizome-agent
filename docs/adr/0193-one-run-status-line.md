---
type: ADR
id: "0193"
title: "One run status line, and a Stop shortcut"
status: active
date: 2026-11-14
---

**Origin:** Claude Fable 5.2 · 2026-11-14 · front-end run, plan item 2

## Context

A chat run showed that it was busy in at least four places: a pulse on
the panel border for the whole run, a spinner under the input, a dot in
the session list, and pulses inside the message. None of them said what
the run did. Two of them were live regions.

A run with no event looked the same as a run that worked. The user
could not tell a long tool call from a provider that had stopped.

Two earlier decisions are relevant.

- The native audit of 2026-09-26 put a quiet spinner under the input
  and kept tool names off it.
- Stop was click-only. The other close key leaves Chat
  (`useAiPanelFocus`), so the old composer foot promised no keyboard
  stop.

## Decision

1. **One model describes the run.** `src/lib/chatRunStatus.ts` returns
   one of these states: thinking, writing, a tool that runs, a wait for
   approval, no response, a pause at the step limit, a start failure, or
   idle.
2. **One line shows it.** `ChatRunStatusLine` sits above the composer.
   It keeps its height when idle, so the composer does not move. It is
   not a live region, a start failure included. `ChatRunLiveStatus`
   stays the one live region and announces a start failure once.
3. **A tool that runs for 5 seconds shows its elapsed time.**
4. **A run with no event for 30 seconds, and no tool that runs, shows
   "No response for N seconds" and a Stop button.** The label claims
   what the events show. It does not say that the run is stuck. The live
   region announces this state once.
   A pause at the step limit offers "Continue for N more steps". A
   ChatGPT sign-in that expired says so first and offers Sign in, which
   focuses the account row's Sign in button in Settings > Connected.
   Another provider's sign-in gets a generic cause. An engine that did
   not start says "Rhizome couldn't start its engine." with Retry, and
   keeps the host's words behind Copy error. The line never shows them.
5. **The border pulse and the spinner under the input go.** The border
   stays 2px in `primary` while a run is active. It does not move.
6. **Stop has a shortcut:** Cmd+Period on Mac and Ctrl+Period elsewhere.
   It acts only while focus is in Chat, outside the note pane, and not
   while a modal is open. The key that leaves Chat keeps its job.

This reverses the two earlier decisions in the context. The status line
names the tool, and Stop is no longer click-only.

## Consequences

- The start failure of a worker moves from the composer foot to the
  status line. `ChatComposerFoot.tsx` is deleted.
- The session-list dot stays. It answers a different question: which
  session runs.
- The pulses inside the message (the tool count badge and the typing
  dots) stay until the run timeline work.
- The 30-second limit is one constant, `QUIET_AFTER_MS`. A slow local
  model can pass it before its first token. The label is still true in
  that case.

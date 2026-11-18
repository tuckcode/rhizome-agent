---
session: 2026-11-17T19:58-06:00
model: Claude
description: Fix the lock race that made the native chat image tests flaky on macOS.
---

# Native chat open race

`native_chat::tests::a_failed_send_does_not_shift_later_images` failed once on
the macOS Rust job (PR #307) with `first image: "native chat worker closed"`
and passed on rerun.

Cause: `NativeChats::open_with_engine` spawned the worker and then called
`remember_logged_target`. That reads the log through `open_session_log`, whose
`write_lock_is_held` probe briefly takes the session lock. The worker takes the
same lock in `ensure_log` (`open_session_writer`). When the two overlapped, the
worker's lock failed, the worker returned, and the first send found the
channel closed. `a_reopened_chat_can_send_an_image` and the app's reopen path
for catalog and free-tier chats had the same exposure.

Fix: read the saved target before spawning the worker.

Evidence (Linux, local): 1,300 plain runs never hit the window. With a 20 ms
sleep added inside the probe (experiment only, not committed), main failed
100 of 100 runs at native_chat.rs:2206 and the fixed tree passed 100 of 100;
`a_reopened_chat_can_send_an_image` went from 99 of 100 failing to 0.

Engine stack: the ADR-0191 step 5 branch keeps the same call order in
`open_with_engine` and this change applies to it cleanly. Its Claude Code
reopen path calls `remember_target` first, so it does not probe.

Possible follow-up: the read-only probe can still collide with a writer that
starts at the same moment from another path. Making the probe never block a
writer would close that for good.

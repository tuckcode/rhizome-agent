---
session: 2026-11-14T17:46-06:00
model: GPT-6
description: Prevent the reopened native chat worker from racing its target lookup for the session log lock.
---

# Reopened chat image test

The saved target lookup briefly locks the session log. When the worker
starts first, it can try to acquire the same lock before the lookup
releases it. The worker then reports that the session is open in another
window and exits. The image send reports a closed worker.

The opener now reads the saved target before it starts the worker. The
lookup still preserves a cached target and can read a recovery successor.

The temporary timing probe failed before the change and passed after it.
The native chat suite passed all 40 tests. With Rust 1.100.0, the image test
passed 600 of 600 runs with six processes active. The earlier unmodified
test failed 6 of 600 runs under the same load.

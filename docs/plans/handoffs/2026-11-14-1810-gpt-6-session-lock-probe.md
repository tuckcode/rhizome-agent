---
session: 2026-11-14T18:10-06:00
model: GPT-6
description: Prevent C105 when a log reader in the same process probes a starting chat worker's lock.
---

# C105 session lock probe

The regression holds a concurrent session read at its lock probe until a
real chat worker asks for the writer lock. Before the fix, the worker
exited and the first send reported that the worker closed. With the fix,
the reader releases its probe and the worker replies.

The local lock registry distinguishes a read probe from a writer. A
writer retries only when a read probe in the same process holds the lock.
The retry window is 50 ms. A local writer or a lock from another process
still causes immediate refusal. The operating system does not identify an
external lock as a probe or a writer.

The Unix process test checks that an active external writer blocks a
second writer and that killing it releases the file lock.

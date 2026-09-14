---
session: 2026-09-14T15:19-05:00
model: Grok 4.6 (Cursor)
description: >-
  D6 commit message drafts. Do not commit until ~15:45 or Atticus says
  commit. Never git add -A.
---

# D6 commit messages (drafts)

**HEAD still `4416411`.** Origin `5c629a0`. App `476756c`.
Path-limited commits. `git commit -- path/a path/b`.
Co-author: `Cursor Grok 4.6 <noreply@cursor.com>`.

`lib.rs` goes in **one** Rust commit (group 7 + hide test). Do not
add it twice.

## 1. C72 labels

```
fix: label View shortcuts Notes Browse closed and open

⌘2 / ⌘3 names match the settled stack. Inbox stays the folder.
Packaged leftover is still 476756c.

Co-Authored-By: Cursor Grok 4.6 <noreply@cursor.com>
```

## 2. D2/D3 readability

```
fix: make Chat context chips and preflight readable

Long chips truncate. Queue text stays 12px. Preflight stays 12px
with an amber mark.

Co-Authored-By: Cursor Grok 4.6 <noreply@cursor.com>
```

## 3. Neighbor tests

```
test: lock leftover shipped Chat and Settings chrome

Empty-vault mounts, C70 clocks, Nous in the picker, Case 2 / #36
parked, Mycelium iframe, action hover tooltips.

Co-Authored-By: Cursor Grok 4.6 <noreply@cursor.com>
```

## 4 + 7. Native (one Rust commit)

```
fix: owner-only settings writes and HOME vault refuse

secure_fs for settings and secrets. HOME aliases stay refused.
Hide-on-close helper names stay locked. Native Sentry still
leaves ghr_ / sk_test_ parked.

Co-Authored-By: Cursor Grok 4.6 <noreply@cursor.com>
```

Put `lib.rs` here once. Skip a separate group-4 commit.

## 5. Docs + ship skill

```
docs: land Astra pack, living-docs stamps, and rhizome-ship

Three SHAs stay separate. Import waits for 1. Ship is three verbs.
C64 / W4 / hide live-check stay NOT RUN.

Co-Authored-By: Cursor Grok 4.6 <noreply@cursor.com>
```

## 6. S1–S4

```
fix: keep MCP frontmatter data-only and widen JS redaction

No JS engine in vault frontmatter. Extra leftover prefixes stay
in JS only. Do not widen rust ghr_ this window.

Co-Authored-By: Cursor Grok 4.6 <noreply@cursor.com>
```

## 8. Dep pins

```
fix: pin js-yaml and fast-uri on the live lockfile

Tiptap High stays parked. Do not bump Hono / qs / fflate.

Co-Authored-By: Cursor Grok 4.6 <noreply@cursor.com>
```

## Stop

No push. No `/Applications` rebuild. No `git add -A`.
Do not close #46 or #41.

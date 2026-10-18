---
type: ADR
id: "0190"
title: "Native chat images"
status: active
date: 2026-10-18
---

**Origin:** Grok 4.7 · 2026-10-18 · native chat image input

## Context

Native is the only chat engine (ADR-0187). The composer already stages
PNG, JPEG, GIF, and WebP for a message. The native send path carried
text only, so a pasted image never reached the model and never survived
a reload.

ADR-0183 stores the turn as JSONL. Putting multi-megabyte images inside
those lines would blow the 100 MiB session cap and change every event
checksum. Old logs have no image field.

Vision is a per-model fact. The free-tier request used to set
`vision: false` on every row, which would refuse images for every model.

## Decision

**Images are stored by reference, next to the session log.** The index
is `<app config dir>/native-sessions/<session_id>.images.json`. The
bytes are `<session_id>-images/<turn>-<index>.img`. One index entry is
written for every user turn, including a turn with no images, so the
next turn lines up with the log. A missing index means the chat has no
images. Old logs still open.

**Caps match the composer.** At most 4 images per message. Each image
is at most 5 MB decoded. The types are PNG, JPEG, GIF, and WebP.

**The provider call uses that provider's content shape.** OpenAI,
Gemini, Ollama, LM Studio, OpenRouter, and other OpenAI-compatible
hosts get `image_url` data URLs. Anthropic gets base64 image blocks.
A text turn with no images stays a string.

**Vision comes from the model catalog.** A pinned models.dev snapshot
(`vision_catalog.json`, 2026-10-18) and, when present, the OpenRouter
and models.dev caches used for reasoning levels supply input
modalities. `image` in that list is vision. A list without `image` is
text-only. No row means unknown. The model id is not a guess. Unknown
and text-only both refuse the turn with a visible error. The text is
not sent with the image removed. The on-disk cache wins over the pin
when it has a row.

## Consequences

A reloaded chat can send an earlier image again, up to the caps above.
A model with no catalog row cannot receive images until a row lists
`image`, or the saved model capability says vision. Free tier skips
text-only routes when the turn has images and refuses when none of the
routes accept them.

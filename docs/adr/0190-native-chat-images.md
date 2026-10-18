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
is at most 5 MB of decoded file bytes. The types are PNG, JPEG, GIF,
and WebP. A message whose own images encode past 12 MB is refused
before the turn is logged. Older image turns can be replaced with a
note so the request stays under that budget. The current turn's images
are never the ones dropped.

**The provider call uses that provider's content shape.** OpenAI,
Gemini, Ollama, LM Studio, OpenRouter, and other OpenAI-compatible
hosts get `image_url` data URLs. Anthropic gets base64 image blocks.
A text turn with no images stays a string.

**Vision comes from the model catalog.** A pinned models.dev snapshot
(`vision_catalog.json`, 2026-10-18) and, when present, the OpenRouter
and models.dev caches used for reasoning levels supply input
modalities. `image` in that list is vision. A list without `image` is
text-only. No row means unknown. The model id is not a guess. Text-only
refuses the turn. Unknown asks first. Send anyway treats that model as
vision for the request, including free-tier routes, and can be undone.
The text is not sent with the image removed. The on-disk cache wins
over the pin when it has a row. Anthropic targets stay refused before
a turn starts.

## Consequences

A reloaded chat can send an earlier image again, up to the caps above.
Opening, forking, or rolling a chat keeps the model target so a later
image send still knows which model it is for. A model with no catalog
row can receive images after Send anyway. Free tier reports the vision
state of its routes, skips routes that cannot take the image, and
refuses when every route that can is cooling down.

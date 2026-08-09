# Open Notebook Podcast — Architecture Reference

Extracted from `lfnovo/open-notebook` codebase (MIT license) on 2026-06-30.

## Profile System

**EpisodeProfile**: episode settings
- `outline_llm` / `transcript_llm`: model registry references
- `language`: BCP-47 locale
- `num_segments`: 3-20
- `speaker_config`: references SpeakerProfile by name
- `default_briefing`: template for the podcast intro

**SpeakerProfile**: voice configuration
- 1-4 speakers
- Each speaker: `name`, `voice_id`, `backstory`, `personality`
- `voice_model`: TTS model from registry
- Per-speaker `voice_model` override supported

## Generation Pipeline (6 stages)

1. **Content Selection** — choose notebook sources
2. **Outline Generation** — LLM produces timed outline with speaker assignments
3. **Dialogue Generation** — LLM writes natural dialogue from outline
4. **Text-to-Speech** — each speaker's lines via their TTS model
5. **Audio Mixing** — merge into final MP3
6. **Job Tracking** — async via surreal-commands, status polling

## Key Design Decisions

- **Profile snapshots**: Episode/speaker profiles stored as dicts on PodcastEpisode (not refs), so edits don't retroactively change past episodes
- **Async processing**: Generation runs in background (not blocking UI)
- **No auto-retry**: `max_attempts: 1` to prevent duplicate episodes
- **Model registry**: Profiles reference model IDs, not raw provider strings
- **BCP-47 languages**: Full locale support (pt-BR, en-US, etc.)

## For Rhizome Implementation

- Profiles → markdown files with frontmatter in vault
- Episode output → `projects/<slug>/briefings/` 
- TTS → Hermes existing TTS support (OpenAI, Edge, ElevenLabs)
- No SurrealDB needed — file-based profile storage
- Podcast-creator library is MIT and standalone

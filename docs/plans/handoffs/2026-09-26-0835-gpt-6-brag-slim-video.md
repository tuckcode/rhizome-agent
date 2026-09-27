---
session: 2026-09-26T08:35-05:00
model: GPT-6 Codex
description: >-
  Installed BRAG Slim and prepared a Rhizome Agent launch-video plan, share copy,
  and render workspace. Claude should complete the composition, render, and QA.
also: [Claude]
commits: none
---

# Claude handoff: create the Rhizome Agent BRAG video

## User request

Atticus asked: “install and create for rhizome agent” using
<https://github.com/latent-spaces/brag#new-brag-slim>.
He then asked Luna to create this handoff for Claude.
Claude owns the remaining video work.

## Skill installation

BRAG Slim is installed at `~/.codex/skills/brag-slim/SKILL.md`.
The requested skill came from `latent-spaces/brag`, path `skills/brag-slim`.
Node `v22.22.3` and FFmpeg are available on `PATH`.
Read the full skill before continuing.

## Prepared files

Luna created these untracked files:

- `brag-output/brag-plan.md` — angle, tone, storyboard, source claims, and audio direction.
- `brag-output/share-copy.txt` — post-ready copy.
- `brag-output/work/index.html` — initial render workspace shell.

Luna did not finish the composition or render. Do not assume `brag-output/brag.mp4` exists.
Keep all frames, audio, scripts, and render intermediates under `brag-output/work/`.

The repository also has unrelated user work. Preserve it. Do not stage or commit these paths:

- `.cursor/rules/one-job-in-flight.mdc`
- `docs/model-misfires/2026-09-21-cursor-grok-4-7.md`
- `src/hooks/useUpdater.ts` and `src/hooks/useUpdater.test.ts`
- `src/utils/releaseDownloadPage.ts` and `src/utils/releaseDownloadPage.test.ts`
- `.tmp-look/`, `docs/plans/2026-09-25-astra-native-frontend-audit-report.md`, `docs/plans/evidence/`

## Rhizome story

Rhizome Agent is a macOS chat app for Prime Agent. It lets a person bring their own model, chat, open notes beside the conversation, and keep selected work as plain-Markdown notes in a local vault they own.

Use exact product language from `README.md` and `docs/PUBLIC-PREVIEW.md`.
Do not claim automatic permanent memory, a bundled Prime install, Windows support, or a release download.
The video is an illustrative demo with synthetic content.
Add a small `Illustrative demo` label if the composition introduces staged text.

## Visual direction

Use the `polished` BRAG Slim tone.
Use landscape format at 1920 × 1080, 30 fps, about 20 seconds.
Use Rhizome’s dark theme, bundled JetBrains Mono, existing BrandMark, and dithered visual identity.
Use soft transitions through the deep background.
Keep text settled long enough to read.
Do not make the video look like a generic SaaS advertisement.

Storyboard:

1. **0.0–3.2 seconds.** Breathing Rhizome mark. Show `AI chat. Keep the work.`
2. **3.2–9.6 seconds.** Show the real chat surface. Stage a short prompt about planning a release and a concise response.
3. **9.6–16.4 seconds.** Show the real note pane beside chat. Use `Keep what matters.` and `Plain Markdown. On your disk.`
4. **16.4–20.0 seconds.** Show the complete dither banner. Use `Your work. Your memory.` and `macOS developer preview`.

The prepared plan contains the same storyboard in `brag-output/brag-plan.md`.

## Real source material

Use real source files when practical:

- `src/components/BrandMark.tsx`
- `src/components/PrimeSessionSubhead.tsx`
- `src/components/AiMessage.tsx`
- `src/components/ChatNotePane.tsx`
- `src/components/ChatComposerDeck.tsx`
- `src/components/BootSplash.tsx` and `src/components/BootSplash.css`
- `src/assets/brand/rhizome-organic-hero.png`
- `docs/design/brand/2026-09-13/banner-dither.png`

The dither image is at `docs/design/brand/2026-09-13/banner-dither.png`.
Its prompts and provenance are at `docs/design/brand/2026-09-13/PROMPTS.md`.
The design gallery is `docs/design/brand/2026-09-13/README.md`.
The original output folder is `~/Documents/Codex/2026-09-13/you-are-astra-write-the-god/outputs/rhizome-brand-exploration/`.

## Browser render approach

Use a browser composition if it gives the cleanest result.
Make each frame a pure function of time.
Wait for the bundled font and local images before capturing frames.
Do not depend on a live model response or network service.
Use a mock/staged chat state with the real visual language.
Do not alter product code to support the video unless a small isolated render helper is essential.

## Audio

Create an original 96 BPM instrumental in D minor.
Use soft electric-key chords, rounded bass, restrained percussion, and quiet transition accents.
Do not use voiceover or downloaded copyrighted music.
Mix effects under the music.

## Required deliverables

Create `brag-output/brag.mp4`, `brag-output/brag.jpg`, `brag-output/share-copy.txt`, and `brag-output/brag-plan.md`.
Keep intermediates in `brag-output/work/`.
Make the poster a settled frame.
Replace frame zero with the poster without changing duration or audio sync.

## Required QA

Before the final render, inspect stills from every scene and each transition.
Check text contrast, overflow, logo proportions, dither sharpness, and audio sync.
Check the first frame because social platforms use it as the thumbnail.
Check that the final frame communicates Rhizome Agent to a stranger without prior context.
Use `ffprobe` to confirm the MP4 duration, frame rate, dimensions, and audio stream.

## Completion report

Report absolute paths for the video, poster, plan, and share copy.
State the creative angle, render dimensions, duration, QA result, and any limitation.
Do not rebuild `/Applications`.
Do not push this branch.

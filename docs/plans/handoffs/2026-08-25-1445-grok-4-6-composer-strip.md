---
session: 2026-08-25T14:45-05:00
model: Grok 4.6 (Cursor)
description: >-
  Composer cluster as one strip: #38 live pills, #9 model moved to composer,
  #35 one-click thinking toggle. #21 argument hints were already in the
  slash menu.
---

# Composer control strip

Four issues, one surface. Built together so they do not redesign the same
row four times.

## What landed

**#38** — Agent, vault, and skills chips are DropdownMenu triggers (caret,
hover, 999px). Vault list calls the same `switchVault` the status bar uses.
Skills is see-only: Prime has no skill-toggle command, and the product
agent list is Prime-only, so the agent menu names Prime as current rather
than faking a second harness.

**#9** — Model+thinking stays one *state*, not two pickers. The control
moved from the telemetry subhead to the composer (harness convention;
#38). Subhead is status: live, session id, vault path, uptime.

**#35** — `PrimeThinkingToggle`: one click cycles a quiet host level
(`off`/`minimal`/`low`) and a loud one (`high`/`xhigh`/`max`). Level is
visible without hovering. Full list remains in the model menu. Sticky
because `set_prime_thinking_level` is session state.

**#21** — already shipped (`ChatCommandMenu` shows `argumentHint`; none
when absent). Untouched.

PostHog: `composer_pill_opened` `{ pill }`; thinking changes carry
`source: menu | toggle`. No paths, no model ids on the pill event.

## Out of scope

`pnpm l10n:translate` (C18). GitHub issues left open (no live Prime demo).
Two New chat buttons (related on #38, not the AC). Skill install/toggle
(no host command). Grafting a second agent.

## English keys

`ai.composer.agent`, `ai.composer.current`, `ai.composer.skills`,
`ai.composer.thinkingToggle`, `ai.composer.thinkingToggleAria`,
`ai.composer.thinkingToggleHint`.

## Next

Shell decisions in ADR-0166 / NEXT §1, or memory loop #24/#25. Do not
start a plugin kernel.

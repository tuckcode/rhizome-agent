---
type: ADR
id: "0164"
title: "One gate decides every celebration"
status: active
date: 2026-08-20
---
## Context

Rhizome Agent is gaining a celebratory confetti burst for finished work. Two
kinds of thing can decide a milestone was reached, and both are legitimate:

- **The app**, when it sees an event it can verify — a Prime goal reported
  complete, a first vault connected. Objective, but blind to whether the work
  was hard.
- **Prime**, when it judges that what it just finished was worth marking. This
  is the trigger Cursor chose for its own confetti, and reading their
  implementation out of the installed bundle showed why: "meaningful
  milestone" is a judgement the app cannot make, so they gave the model a
  `show_confetti` tool plus a prompt rule telling it to be stingy — "at most
  once per milestone, never for routine work".

The failure mode with both sources live is not hypothetical. Prime finishes a
hard fix and celebrates; the goal that fix completed fires its event a second
later; the user sees two bursts for one achievement. That does not read as
twice the accomplishment — it reads as a bug, and an effect that fires twice
for one thing becomes wallpaper within a week.

A second problem sits underneath it. Nothing in this app consulted
`prefers-reduced-motion` before now, which was fine while nothing moved on its
own. A full-window particle burst is exactly the class of animation that
setting exists for; for some people it causes nausea or migraine rather than
mild irritation. Any design where each trigger remembers to check that
preference will eventually ship a trigger that forgot.

## Decision

**No source fires the cannon. Every source asks one gate, and the gate can
refuse.**

`decideCelebration` (`src/lib/celebration.ts`) is a pure function taking the
gate's state, the reason, the clock, the user's setting and the reduced-motion
preference, and returning whether to celebrate plus the next state. It refuses
for exactly three reasons, and names which:

| Refusal | When |
|---|---|
| `disabled` | The user turned celebrations off |
| `reduced-motion` | The system asks for reduced motion |
| `cooldown` | Something already celebrated within 60 seconds |

`CelebrationProvider` owns that state and mounts **one** `ConfettiCannon` for
the whole app. Sources call `useCelebration().celebrate(reason)` and get back
a boolean; they never learn whether a burst was theirs.

Three details that are load-bearing:

- **The gate state is a ref, not React state.** Two sources firing in the same
  tick would both read an empty gate and both get through if the update waited
  for a render.
- **A refused attempt does not extend the cooldown.** Otherwise a chatty
  source could hold the gate shut indefinitely and no burst would ever show.
- **`prefers-reduced-motion` is also checked inside `ConfettiCannon`.** The
  gate is the policy; the component is the backstop. An accessibility promise
  that depends on every future caller remembering is not a promise.

**The setting defaults to on** (`celebrations_enabled`, absent meaning on).
Cursor defaults its equivalent off behind an experiment flag, which is right
for software going to millions of people including enterprises where surprise
animation is a support ticket. That reasoning does not transfer to this app.
A default-off toggle is where a feature nobody is confident about goes to be
unseen; if the trigger list is wrong, hiding it behind a default does not fix
the trigger list. The discipline lives in the trigger list and the cooldown.

## Consequences

Adding a trigger is one `celebrate(reason)` call and a new `CelebrationReason`
member. It cannot bypass the cooldown, the setting, or the accessibility check
without deliberately rendering a second cannon, which review would catch.

The cooldown means a genuine second milestone inside 60 seconds is silently
swallowed. That is the intended trade: a missed celebration costs nothing, a
doubled one costs the effect's meaning. `celebration_requested` is emitted for
every request including refusals, so a run of `cooldown` refusals will show if
two sources habitually notice the same milestone.

Reduced motion suppresses celebrations entirely rather than substituting a
quieter animation. A gentler fallback might be better for those users, but
inventing one on their behalf is a guess, and the honest reading of the
preference is that they asked for no motion.

## Alternatives considered

**Event triggers only.** Simple, verifiable, and it makes the app celebrate
exactly the things it can already see — which excludes everything that
actually feels like an achievement. "The push succeeded" is not a milestone;
"the thing you have been fighting for an hour finally works" is, and only the
agent in the conversation knows that happened.

**Agent trigger only**, as Cursor does. Coherent, and it is the majority of
the value. Rejected because a goal completing is a real, user-declared
milestone that should be marked even when the agent that finished it has
already moved on — and because the goal event costs one line once the gate
exists.

**Per-source cooldowns.** Would let each source rate-limit itself without a
shared gate. Rejected: it solves the wrong problem. The duplicate is *across*
sources, and two sources each behaving perfectly still produce two bursts.

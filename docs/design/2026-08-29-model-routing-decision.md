# Model routing decision: Switchyard, TokenJuice, OmniRoute

**Origin:** Claude Sonnet 4.5 (sub-agent) · 2026-08-29 · model routing evaluation

**Status: unratified — proposal for Atticus.** This is a decision-support
document, not a decision. Nothing here is ratified and nothing here should be
built without Atticus signing off, ideally as an ADR update or a
`harness-doctrine.md` edit by whoever owns that file next.

## The one paragraph

None of the three candidates should become a Rhizome-owned runtime, and the
doctrine already says so for two of them — this note mostly confirms and
sharpens what `harness-doctrine.md` and `token-routing-and-compression.md`
already concluded rather than overturning it. Switchyard and TokenJuice stay
**DEFER behind Prime**, unchanged, because both are organs by the Frankenstein
test (both keep routing/compressing after Prime is deleted) and both already
have a correct non-organ path — Prime is pointed at them, Rhizome never
supervises them. OmniRoute is the one candidate that needs a sharper verdict
than the open issue currently gives it: as filed (#48), it is **REJECT**, not
"small feature" — it is a second, Rhizome-supervised provider path that
explicitly bypasses Prime (`api_model` skips the Prime path in
`ChatHome.tsx:66`), which is exactly what the lineage locks forbid. The
narrower thing worth having — OmniRoute's model catalog reachable *through*
Prime, the same way any other OpenAI-compatible endpoint would be — is not
gated by this doctrine at all, it is gated by Prime having no custom-provider
mechanism (per issue #45), so that version is **DEFER upstream**, not
Rhizome's to build. Doing nothing costs real things — no free-tier routing,
no token compaction, no local gateway UX — but the doctrine's actual claim is
that those costs are Prime's to fix or not fix, and Rhizome absorbing them
early would trade a temporary convenience for a permanent second execution
path that has to be maintained, secured, and reconciled with Prime's model
picker forever.

## Doctrine recap (for readers who skip to the table)

The Frankenstein test: *if we deleted Prime tomorrow, would this piece still
try to run?* Yes → organ → do not transplant. The escape hatch is a
**contract, artifact, or signal** Rhizome can render/store without owning the
loop that produced it. The lineage lock on Execution says Prime "may become
richer protocol, tools, RLM, schedules, refine" but "may not become a
Rhizome-owned runtime or second provider path." That single clause decides
Switchyard and OmniRoute both.

## Candidate 1 — Switchyard

**Verdict: DEFER (unchanged from `harness-doctrine.md` and
`token-routing-and-compression.md`).** Doctrine clause: Execution lineage lock
— "may not become... a second provider path" — plus the Frankenstein test.

**Frankenstein test:** yes, an organ. Switchyard is a standing Rust proxy that
keeps routing requests to models on its own after Prime is gone; it has its
own provider registry, its own protocol translation, its own metrics. That is
the textbook shape of what the doctrine calls an organ, not a metabolite.

**What I verified:** read `docs/design/harness-doctrine.md` and
`docs/design/token-routing-and-compression.md` in full (both already carry a
2026-08-23/26 evaluation). Confirmed the fork exists: `gh api
repos/tuckcode/Switchyard` shows it as a fork of `NVIDIA-NeMo/Switchyard`
(created 2026-08-23, Apache-2.0, pre-alpha, last upstream push
2026-08-28). I did not re-clone or re-read Switchyard's source — the existing
note already names four open upstream protocol issues (dropped tool calls,
reused tool-call IDs, demoted system/developer roles, no subagent-aware
routing) that would break Prime's agent loop if pointed at it today, and I
have no reason to believe those closed in six days.

**Where the contract lives:** `Rhizome → Prime → Switchyard sidecar →
providers`. Rhizome's only legitimate touch is rendering which *logical
route* answered versus the *physical model*, if Prime ever exposes that
distinction — never running or configuring the proxy itself.

**Cost of doing nothing:** no cheap-model-for-grep / frontier-for-writeup
cost savings yet. That cost is real but is Prime's roadmap item, not
Rhizome's — Rhizome has no model routing logic to save money on in the first
place, since Prime already owns model selection.

**What would flip the verdict:** Prime itself adopts (or sidecars) Switchyard
and exposes route vs. physical-model as a field in its session/turn state.
At that point Rhizome's job is still just rendering, so the verdict for
*Rhizome* barely moves — what changes is that there's finally something to
render. A Rhizome-side trial would need, at minimum, the four open protocol
issues closed and evidence (per the note's own half-life test) that tool-loop
correctness matches passthrough on a named workload.

## Candidate 2 — TinyHumans TokenJuice

**Verdict: DEFER (unchanged).** Doctrine clause: harness-doctrine.md's ADAPT
row — "Visualize Prime's model-visible projection; never compact
independently" — and the OpenHuman DEFER-source-review entry.

**Frankenstein test:** yes, an organ, for the same reason as any
context-mutating pass: if Rhizome ran its own TokenJuice over Prime's tool
results, it would keep rewriting what enters the model's context after Prime
is gone, which is a second compaction authority. The existing note is
explicit about this and I found no reason to soften it: the only two allowed
metabolites are (a) a *display* collapse of large tool cards — that changes
what the human sees, not what the model ate — and (b) rendering a CCR
("compress-cache-retrieve") breadcrumb if Prime or a Prime skill ever emits
one.

**What I verified:** re-read the TokenJuice section of
`token-routing-and-compression.md` — upstream is `vincentkoc/tokenjuice`
(rule-overlay compressor), forked into OpenHuman as a content-kind router. I
did not re-read the upstream source or the OpenHuman PR; the existing note
already marks this a partial (not full) OpenHuman read and nothing in this
task changes that gap.

**Cost of doing nothing:** long Chat sessions keep paying full token cost for
noisy tool output (git diffs, test logs, search hits) that a rule-based
compressor could shrink before it ever reaches Prime's context. That is a
real, felt cost for anyone running long sessions — but it is a cost inside
Prime's context-management job, not Rhizome's rendering job.

**What would flip the verdict:** Prime (via a skill or its own daemon logic)
adopts content-kind compaction and emits a retrievable breadcrumb for what it
compacted. Then Rhizome's job changes from "nothing" to "render the
breadcrumb, offer retrieve" — still not compacting anything itself. Absent
that, the only thing that could justify a Rhizome-side compressor is a
*non-agent* job that never touches Prime context at all (the note names menu
bar capture / Inbox distill as a plausible different job) — and that would be
a new, separately scoped feature, not this candidate revived.

## Candidate 3 — OmniRoute (issue #48)

**Verdict: REJECT as filed. DEFER (upstream-gated) for the narrower version.**
Doctrine clauses: Execution lineage lock ("may not become... a second
provider path"); REJECT ledger row "App-stored provider keys or a Rhizome
model router for Prime chat | Bypasses Prime auth/tools/state."

**Frankenstein test, as filed:** yes, unambiguously an organ, and the issue
says so about itself. Issue #48's own "Caveats worth deciding up front"
section states: *"It bypasses Prime. `api_model` targets skip the Prime path
entirely (`ChatHome.tsx:66`)... OmniRoute models would be plain chat — no
tools, skills or Prime sessions."* The sketch in the issue has Rhizome
resolving the OmniRoute binary, spawning it (`mycelium.rs`-style child
process supervision), health-checking it, and registering it as a provider
with its own model catalog — that is Rhizome growing a second supervised
runtime with its own provider registry, which is precisely what "may not
become a... second provider path" forbids. If Prime were deleted tomorrow,
a Rhizome-supervised OmniRoute process would keep running and keep serving
chat completions on its own. That is an organ by definition, not a close
call.

I want to be plain that the issue's framing — "why this is a small feature,
not a new subsystem" — is not supported by its own body once you apply the
doctrine. It correctly identifies that the *transport* shape
(`OpenAiCompatible` + `base_url`) and the *supervision* pattern
(`mindwalk_candidates()` / `mycelium.rs`) already exist in the codebase. That
makes it *cheap to build*. Cheap-to-build and organ-shaped are different
axes; the doctrine gates the second one, not the first. Reuse of an existing
sidecar pattern was also exactly the "existing precedent" reasoning the
doctrine's Immediate sequence step 3 warns against generalizing from — Prime
project MCP was rejected the same way it looked wired but wasn't meant to be.

**The narrower, doctrine-compatible version:** issue #45's second comment
(2026-08-27, self-correction by the issue author) confirms Rhizome already
has a working non-Prime path for exactly this shape —
`AiModelProviderKind::OpenAiCompatible` with `base_url`/`api_key` — and that
this path already **bypasses Prime by design** (`isPrimeTarget` check in
`ChatHome.tsx:66`). So a user can point Rhizome's existing direct-API chat at
a manually-started OmniRoute instance *today*, no new code, and get plain
chat without tools/skills/sessions. That is not new organ risk because the
bypass-Prime provider path already exists and is already accepted product
surface for plain chat — issue #48 is not proposing to create that
capability, it is proposing to *automate supervision of a specific binary*
and *feed it into settings as a first-class provider*, which is the part that
crosses into organ territory (standing process lifecycle owned by Rhizome).

The version that would actually serve the underlying want — cheap/free model
access reachable from a Prime session with tools intact — is gated the same
way Switchyard is: **Prime has no custom-provider or base-URL mechanism**
(confirmed directly in issue #45's first comment: "Prime supports six
providers, full stop... `settings.json` exposes no custom-provider or
baseURL mechanism"). That is an upstream Prime gap, not a Rhizome one. The
correct place for OmniRoute-through-Prime is the same shape as Switchyard:
`Rhizome → Prime → OmniRoute-as-a-provider`, once Prime can point at an
arbitrary OpenAI-compatible base URL.

**What I verified:** read issue #48 in full (`gh issue view 48`) including
its own caveats section; read issue #45 in full with all three comments
(`gh issue view 45 --comments`), which independently confirm both the
Prime-provider-list limitation and the `ChatHome.tsx:66` bypass claim from
two different angles (the auth-flow comment and the OpenAI-compatible-path
correction comment). I did not install or run OmniRoute — issue #48 says
outright it is "not installed on this machine," and I did not change that
state. I did not read `src-tauri/src/mycelium.rs`, `src-tauri/src/ai_models.rs`,
or `ChatHome.tsx` directly; I am relying on the issue text's line citations
and the doctrine's own precedent for `mycelium.rs` as the sidecar template.
If those citations are stale, the organ classification of "spawn + supervise
+ register a provider" would not change, but the specific `ChatHome.tsx:66`
line number might have drifted.

**Cost of doing nothing:** the manual `omniroute` terminal step stays manual
— a real, named annoyance from Atticus (2026-08-27 quote in the issue: "you
have to type omniroute in console to get it started... maybe automating that
somehow"). Free-model routing via Rhizome's existing direct-API path also
stays available today without any of this work, just without automated
process supervision — so the actual gap being closed by building #48 as
filed is narrower than "enables OmniRoute," it is "removes one manual
terminal command," which is a much smaller thing to weigh against taking on
a second supervised runtime.

**What would flip the verdict:** two independent conditions, either one
sufficient to revisit —
1. Prime gains a custom-provider / base-URL mechanism (closes the #45 gap).
   Then OmniRoute becomes a provider Prime points at, and Rhizome's role
   shrinks to settings UI for that provider entry — no supervision, no organ.
2. Someone explicitly re-scopes #48 to *not* register OmniRoute as a
   Rhizome-supervised chat provider at all, and instead ships only the
   "start/stop the OmniRoute process and expose its base URL as a value the
   user pastes into their existing API-provider settings" — i.e. process
   convenience only, no provider registration, no catalog ownership, no
   claim that it works inside Prime chat. That is a genuinely small feature
   and doesn't trip the lineage lock, but it is a different issue than #48
   as currently written and should be filed or re-scoped as such rather than
   read as "OmniRoute is basically done."

## Cost of doing nothing, stated once, plainly

Doing nothing on all three candidates means: no cost savings from
cheap/frontier model splitting, no token compaction on long sessions, and the
OmniRoute terminal step stays manual. Those are real, named user costs, not
imaginary ones — Atticus asked for exactly two of these three things
directly. But "doing nothing in Rhizome" is not the same as "doing nothing
period": all three have a legitimate path that starts with Prime gaining a
capability (custom providers, content-kind compaction, or a stage router)
and Rhizome then rendering it. The cost of building any of them as a
Rhizome-owned organ instead is not a one-time cost — it is a standing
maintenance, security, and UX-reconciliation burden (a second model picker
truth, a second credential store, a second process to orphan-proof) that
outlasts whatever convenience it bought on day one. The doctrine's existing
verdicts already priced that trade correctly for Switchyard and TokenJuice;
this note's main addition is pricing it the same way for OmniRoute, whose
issue text undersells its own organ-shape.

## Sources read for this note

- `docs/design/harness-doctrine.md` (ADR-0168, ratified 2026-08-24)
- `docs/design/token-routing-and-compression.md` (2026-08-26)
- `CONTEXT.md` — "Model" glossary entry (line 38: "An LLM selected **through
  Prime**... Not a separate in-app 'agent backend.'")
- `gh issue view 48` — OmniRoute as a managed local gateway
- `gh issue view 45 --comments` — model settings / provider curation, all
  three comments
- `gh api repos/tuckcode/Switchyard` — confirmed the fork exists, its parent,
  and last-push date

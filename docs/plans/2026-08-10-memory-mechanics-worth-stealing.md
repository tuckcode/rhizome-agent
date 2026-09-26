# Memory mechanics worth stealing — 2026-08-10

Corrects a scoping error in `2026-08-10-destination-model-peer-research.md`,
which dismissed Mem0, Letta, and Zep/Graphiti on the grounds that they have no
user-owned file layout. Their *storage* is irrelevant. Their **mechanics** —
what happens to an existing memory when a new one arrives — are portable, and
Rhizome has almost none of them.

**Not repeated here:** *when* to save (`2026-08-02-competitor-trigger-research.md`)
or *where it lands* (`2026-08-10-destination-model-peer-research.md`).
**Answered here:** what happens to memory #1 when memory #2 contradicts it.

Sources fetched 2026-08-13. Primary (repo source, PR bodies, shipped code)
preferred throughout; anything inferred is marked. Prime Agent findings are read
from the installed `prime-agent@0.7.1` at
`~/.local/lib/node_modules/prime-agent`.

---

## 0. Corrections to the brief

Five claims in the task framing did not survive reading the code. Three matter.

**a) `src-tauri/src/consolidation.rs` does not exist. Neither does ADR-0163.**
`docs/adr/` stops at `0162-mcp-server-identity-rhizome.md`. What exists is: a
settings flag (`settings.rs:21`, `DEFAULT_AUTOMATIC_CONSOLIDATION_ENABLED = false`,
plus `automatic_consolidation_enabled: Option<bool>` and four tests), a doc
comment at `settings.rs:20` pointing at
`docs/adr/0163-automatic-consolidation-l0-to-l1.md` — **a file that was never
written** — and two design docs (`docs/design/automatic-memory-consolidation.md`,
`docs/plans/2026-08-02-consolidation-spike-scope.md`). No module, no trigger, no
checkpoint file, no L0→L1 code at all. The flag gates nothing. So "threshold
constants are placeholders" is generous: there are no threshold constants.
*This should get a `C`-number in HANDOFF — a settings field and four tests
referencing a nonexistent ADR is exactly the kind of residue this repo's rules
say to track rather than mention in passing.*

**b) Session auto-distill defaults OFF, and its own file header says the
opposite.** `sessionAutoDistill.ts:1–4` reads *"Default ON when unset; explicit
false opts out."* The implementation four lines later
(`isSessionAutoDistillEnabled`) is `return value === true`, with the comment
*"Product default OFF … Explicit true opts in."* Two contradicting comments in
one 15-line span. The code is right; the header is stale. It is wired at
`aiAgentStreamCallbacks.ts:248`, fire-and-forget on stream end, as described.

**c) "No quality gate beyond length" understates it slightly.** There are three
gates, all weak: `MIN_ASSISTANT_CHARS = 80` on the input;
`isTransientAgentFailureText` (9 regexes for OAuth/RPC failures) on the input;
and `is_junk_distill_title` (`rhizome_distill.rs:131`, 6 substring checks) on the
LLM's *output* title. All three are blocklists for tooling noise. None is a
salience judgment. The brief's substantive point stands.

**d) "Knowledge cards appended to concepts/" — it is worse than append.**
`write_distilled_card` (`rhizome_distill.rs:146`) calls `unique_slug_path`, which
loops `slug`, `slug-2`, `slug-3`… until it finds a path that does not exist, then
`std::fs::write`s a **new file**. Nothing is appended to anything; no existing
note is ever read. Two distills of the same concept produce
`event-sourcing.md` and `event-sourcing-2.md`. The test named
`write_distilled_card_dedupes_on_collision` (`rhizome_distill.rs:469`) is
filename disambiguation, not deduplication — the word "dedupe" in that test name
is actively misleading about what the system does. Every distill also writes
`state: fleeting` into frontmatter (`rhizome_write_location.rs:130`) and nothing
ever changes it.

**e) The rest is confirmed.** No dedup, no contradiction handling, no
update-in-place, no decay, no confidence, no review queue. Verified by grep:
zero occurrences of `supersed`/`confidence` in `src-tauri/src` outside an
unrelated comment in `vault_access.rs`.

### Two capabilities the brief did not mention, which change every verdict below

**Rhizome already ships a local embedding model.** `src-tauri/src/rhizome_search/embedder.rs`
runs **BAAI/bge-small-en-v1.5 via fastembed-rs (ONNX)** in-process, with
`cosine_similarity` already implemented and unit-tested, and `service.rs` keeps a
warm per-vault index with an `invalidate()` hook already called after
out-of-band writes. **Embedding a candidate card and comparing it against the
vault costs zero API calls and zero dollars.** Every "needs a vector store"
objection to the mechanisms below is already answered in-tree.

**Arbitrary frontmatter keys are already view-filterable.**
`resolve_condition_field` (`vault/views.rs:345`) falls through to
`resolve_dynamic_condition_field`, which reads `entry.properties` — populated
from any non-structural frontmatter key. So `valid_until:`, `superseded_by:`,
`confidence:` become filterable in `views/*.yml` **with no Rust change**. This is
the single biggest reason the markdown-native adaptations below are cheap.

---

## 1. Update vs append — the premise is out of date

### What Mem0 used to do

Two LLM calls per `add()`. Call 1 extracted facts. Call 2 was fed the extracted
facts plus the top-10 semantically nearest existing memories and returned one of
four events per fact: **ADD / UPDATE / DELETE / NONE**. UPDATE kept the same id
and replaced the text; DELETE fired on direct contradiction
("Loves cheese pizza" + "Dislikes cheese pizza" → delete). The prompt
(`DEFAULT_UPDATE_MEMORY_PROMPT`) and its helper `get_update_memory_messages` are
**still in `mem0/configs/prompts.py`**, which is why every blog post still
describes this design.

### What Mem0 actually does now

They deleted it. PR
[#4805 "feat(oss): port v3 pipeline with hybrid search, entity extraction, and additive scoring"](https://github.com/mem0ai/mem0/pull/4805),
merged **2026-04-14** (+10,200/−17,228), says in its own summary:

> Replace the 2-LLM-call add pipeline with single-pass additive extraction using
> `ADDITIVE_EXTRACTION_PROMPT` (ADD-only, memories accumulate with
> `linked_memory_ids`)

and lists under **Breaking Changes**:

> `add()` only returns `"ADD"` events (no `"UPDATE"`/`"DELETE"`) — Memories
> accumulate; accept ADD-only results

Verified against `main`: `_add_to_vector_store` (`mem0/memory/main.py:879`) is an
8-phase pipeline with exactly one LLM call, and `get_update_memory_messages` is
referenced nowhere outside `prompts.py` and its own test (GitHub code search,
2 hits). **The mechanism the brief wanted to steal was removed by its author
seven months ago, for cost.**

### What replaced it (this is the part worth stealing)

Reconciliation moved from a second LLM call into *context for the first one*:

1. **Phase 1** — one embedding of the parsed turn, `top_k=10` search over existing
   memories, no threshold. UUIDs are remapped to integers `"0".."9"` before being
   shown to the LLM, with the code comment `# Map UUIDs to integers
   (anti-hallucination)`.
2. **Phase 2** — one LLM call. Existing memories are in the prompt labelled
   *"Use these ONLY for deduplication and linking — do NOT extract new memories
   from Existing Memories… If new information in New Messages is semantically
   equivalent to an Existing Memory with no meaningful new context, skip it."*
3. **Phase 5** — `hashlib.md5(text)` against existing payload hashes and
   within-batch hashes. Exact-text dedup only.
4. **Contradiction is recorded, not resolved.** The prompt's linking rules end
   with: link an existing memory when there is *"**Contradiction**: New
   information that conflicts with an existing memory."* The output carries
   `linked_memory_ids`; the contradicted memory is untouched.

So Mem0 2026 is: **append-only, with the existing neighbours shown to the
extractor as a suppression list, exact-hash dedup, and contradictions filed as
links.** That is one LLM call and one embedding per save.

### Verdict

| | |
|---|---|
| **Needs a DB?** | No. Needs *nearest-neighbour retrieval*, which Rhizome already has locally. |
| **Cost/save** | 1 LLM call + 1 query embedding + N card embeddings. Rhizome already pays the LLM call; the embeddings are free (local ONNX). |
| **Verdict** | **ADAPT — highest-value item in this document.** |

**Markdown-native version.** Before `write_distilled_card` writes, embed
`card.title + card.context` and query the warm index for the top 5 concept cards.
Then:

- **cosine ≥ ~0.95 or identical normalized title** → do not write. Append a
  dated line to the existing card's body instead, or drop it entirely and log a
  `distill_skipped_duplicate` event.
- **0.80–0.95** → write the card, but inject the neighbours' titles and `context:`
  lines into the distill prompt as Mem0 does ("these already exist; skip anything
  semantically equivalent; link instead"), and emit `related:: [[…]]` wikilinks
  from the new card. Rhizome already has wikilinks; `linked_memory_ids` is a
  worse version of them.
- **< 0.80** → today's behaviour.

This alone kills the `event-sourcing-2.md` failure mode and costs no money.
It is a change to one function plus a prompt.

**Do not** rebuild the ADD/UPDATE/DELETE second call. The only company that
shipped it at scale removed it, and Rhizome's per-save budget is an entire agent
invocation, not an API call — a second one would roughly double the cost of every
save for a decision that Graphiti (§2) and Prime (§7) both make more cheaply.

---

## 2. Contradiction and staleness — Graphiti's temporal invalidation is real

Yes, it is real, it is shipped, and it is the cleanest mechanism in this survey.

### What it does, concretely

Graphiti edges carry **four timestamps**, two per time axis (bi-temporal):

- `valid_at` / `invalid_at` — when the fact was true **in the world**
- `created_at` / `expired_at` — when the system **learned/stopped believing** it

The reconciliation is in `resolve_edge_contradictions`
(`graphiti_core/utils/maintenance/edge_operations.py:538`). Given a new edge and
a list of invalidation candidates, for each candidate it:

1. **skips** any candidate whose validity interval does not overlap the new
   edge's (`edge.invalid_at <= new.valid_at`, or `new.invalid_at <= edge.valid_at`)
   — non-overlapping facts are not contradictions, they are history;
2. otherwise, if the candidate became valid **before** the new edge did, sets
   `edge.invalid_at = resolved_edge.valid_at` and
   `edge.expired_at = expired_at or utc_now()`.

**Nothing is ever deleted.** The old fact keeps its text and gains an end date
plus a system-time stamp saying when belief in it stopped. Retrieval filters on
the interval.

Candidates come from a hybrid search over the new edge's fact text; the
duplicate-vs-contradiction call is one LLM pass returning
`EdgeDuplicate{duplicate_facts: list[int], contradicted_facts: list[int]}`
(`prompts/dedupe_edges.py:24`). Its own worked examples are the clearest
statement of the distinction anywhere in this survey:

> Result: `duplicate_facts=[0], contradicted_facts=[]` (identical factual information)
> Result: `duplicate_facts=[], contradicted_facts=[1]` (same relationship but updated title — contradiction, NOT a duplicate)
> Result: `duplicate_facts=[], contradicted_facts=[]` (different events on different days — neither duplicate nor contradiction)

Note also `_extract_edge_timestamps` (`edge_operations.py:576`): a *separate,
deliberately lightweight* LLM call whose only job is to resolve a fact's
`valid_at`/`invalid_at` against the episode's reference time — and it early-returns
if timestamps are already set. Temporal grounding is treated as cheap and
skippable, not as part of the main extraction.

Zep's own numbers for the system built on this: **94.8% vs MemGPT's 93.4% on DMR,
up to 18.5% accuracy improvement on LongMemEval with ~90% latency reduction**
([arXiv 2501.13956](https://arxiv.org/abs/2501.13956)). The abstract does not
attribute those numbers specifically to invalidation — *treat the mechanism as
verified and its benchmark contribution as unattributed.*

### Verdict

| | |
|---|---|
| **Needs a DB?** | **No.** The graph is Graphiti's storage; the mechanism is four date fields and an interval comparison. |
| **Cost/save** | The interval arithmetic is free. Finding candidates costs a search (free locally). Classifying duplicate-vs-contradiction costs 1 LLM call — **or zero, if you let the distilling agent emit it as part of the card it is already producing.** |
| **Verdict** | **ADOPT the model, ADAPT the plumbing. Ranked #2.** |

**Markdown-native version.** Add to the distill frontmatter contract:

```yaml
valid_from: 2026-08-10      # world time; the agent grounds this (see §3)
valid_until:                # empty = still believed
superseded_by:              # [[wikilink]] to the card that ended it
superseded_at:              # system time — when we stopped believing it
```

Superseding is then `update_frontmatter` (already exists,
`src-tauri/src/frontmatter/mod.rs:81`) on the old file plus a wikilink on the new
one. No file is deleted, no body is rewritten, `git` shows a one-line diff, and
the vault stays hand-editable. `views/*.yml` can filter `valid_until` **today**
via the `entry.properties` fall-through — a "currently believed" view is a YAML
file, not a Rust change.

This also makes an existing, unenforced principle real: `vault_access.rs:38`
already says ADRs are *"governed by 'never edit, supersede instead'"*. Graphiti
is that rule with dates attached, applied to knowledge instead of decisions.

**The one thing that does not port.** Graphiti invalidates *edges* (subject-
predicate-object facts), which have crisp boundaries. Rhizome's unit is a
paragraph-sized card that can be 80% still-true. Superseding a whole card because
one sentence went stale is lossy. Mitigation: either keep cards atomic enough to
supersede whole (Mem0's 15–80-word guidance, §3), or supersede at the card level
and accept that the new card restates what survived. Do not try to invalidate
sub-spans of a markdown body — that is the failure mode Letta's `memory_replace`
exists to manage (§5), and it needs an editing primitive Rhizome does not have.

---

## 3. Extraction quality — nobody uses a classifier; they use a very long prompt

The honest answer to "what decides something is worth remembering": **none of
these tools use a classifier, a scorer, or a salience heuristic.** They use
prose, at length, in the extraction prompt itself.

`ADDITIVE_EXTRACTION_PROMPT` (`mem0/configs/prompts.py:468`) is roughly 300 lines
of rules. Its governing bias is stated outright:

> **When in doubt, extract.** A slightly redundant memory is far less costly than
> a missing one. The deduplication system downstream will handle true duplicates.

And, contra Rhizome's own distill prompt ("Skip chitchat"):

> Conversations about pets, hobbies, childhood memories, funny anecdotes, and
> personal preferences are NOT "chitchat" to be skipped… Only skip messages that
> are PURELY phatic ("Hi!", "Sounds good!", "Thanks!") with zero informational
> content.

The specific rules worth copying verbatim into Rhizome's `build_distill_prompt`,
because they cost nothing and each fixes a real vault-rot mode:

1. **Temporal grounding against an observation date, not today.** *"'User went to
   Paris last week' is useless 6 months later. 'User went to Paris the week of May
   15, 2023' is meaningful forever."* Mem0 passes **Observation Date** and
   **Current Date** separately and forbids resolving relative references against
   the current one. Rhizome passes neither; a card saying "we decided yesterday"
   is permanently ambiguous.
2. **Self-contained.** *"Replace all pronouns with specific names or 'User.'"*
   Required for any similarity-based dedup to work at all.
3. **Concise but complete — 15–80 words, up to 100.** A concrete length budget
   that makes cards atomic enough to supersede whole (§2).
4. **Capture the transition, not just the new state.** *Bad: "User prefers oat
   milk lattes." Good: "User switched from almond milk to oat milk lattes after
   developing an almond sensitivity."* This is a **contradiction-avoidance**
   device: a memory that names what it replaces cannot silently coexist with its
   predecessor.
5. **Never generalize a specific.** Proper nouns, titles, quantities preserved
   exactly — *"users search by name; a memory without the name is unfindable."*
6. **No echo extraction / no meta-extraction.** Do not save "User asked for X to
   be shortened"; save the content. Directly relevant to Rhizome, whose
   auto-distill feeds it a `## User` + `## Assistant` pair and will happily
   produce cards *about the conversation* rather than *from* it.
7. **No detail contamination from context.** Do not merge details from the
   retrieved neighbours into the new extraction. Necessary the moment you start
   injecting neighbours into the prompt (§1).

### Verdict

| | |
|---|---|
| **Needs a DB?** | No. It is prompt text. |
| **Cost/save** | **Zero.** Rhizome already makes this LLM call. |
| **Verdict** | **ADOPT. Ranked #3 — the only zero-cost item on the list.** |

The one thing Mem0 has that Rhizome cannot copy for free is the *downstream*
dedup that licenses "when in doubt, extract." Adopt §1 first, or adopt the
prompt rules and get a bigger pile of near-duplicates faster.

**On the 80-char gate specifically:** it is not comparable to anything here, and
that is fine — it is a *prefilter before an LLM pass*, where Mem0's rules are
instructions *to* the LLM pass. Rhizome's actual quality decision already happens
inside the distilling agent; it is simply under-instructed. Replacing 80 chars
with an LLM judge (Prime's approach, §7) is a real option but costs a second
model call per turn; tightening the existing prompt costs nothing. Do the free
thing first.

---

## 4. Dedup — Graphiti's three-tier ladder, and the thresholds are published

This is the best-engineered thing found. `graphiti_core/utils/maintenance/dedup_helpers.py`
resolves entity duplicates in three escalating tiers, **spending an LLM call only
on the residue**:

**Tier 1 — exact.** `_normalize_string_exact`: lowercase, collapse whitespace,
hash-map lookup. Free. (`resolve_extracted_edges` does the same for facts, keying
on `(source_uuid, target_uuid, normalized_fact)`.)

**Tier 2 — fuzzy, deterministic, no embeddings.** 3-gram shingles over the
normalized name → 32-permutation MinHash (blake2b, 8-byte digests) → LSH bands of
4 → Jaccard on the shingle sets. Published constants:

```python
_NAME_ENTROPY_THRESHOLD = 1.5
_MIN_NAME_LENGTH        = 6
_MIN_TOKEN_COUNT        = 2
_FUZZY_JACCARD_THRESHOLD = 0.9
_MINHASH_PERMUTATIONS   = 32
_MINHASH_BAND_SIZE      = 4
```

The **entropy gate** is the subtle part and is worth stealing on its own. Before
trusting fuzzy similarity, Graphiti computes Shannon entropy over the characters
of the name; short or repetitive names fall below 1.5 and are excluded from the
fuzzy tier entirely, with the comment: *"low entropy, which signals we should
defer resolution to the LLM instead of trusting fuzzy similarity."* Cheap
matchers are allowed to decide only where they are reliable.

**Tier 3 — LLM.** Only for what survives, and the prompt returns
`duplicate_facts` and `contradicted_facts` in the same call (§2) — one decision,
not two.

For comparison, **Mem0's entire dedup is MD5 of the exact text** (tier 1 only)
plus asking the extractor nicely not to re-extract. **Letta has none.**

### Verdict

| | |
|---|---|
| **Needs a DB?** | **No.** Tiers 1 and 2 are pure string functions over titles. Tier 3 is an LLM call you may already be making. |
| **Cost/save** | Tier 1 ≈ free. Tier 2 ≈ microseconds. Tier 3 = 1 LLM call, only on ambiguous cases. Rhizome's local embedder can substitute for or supplement tier 2 at ~ms and $0. |
| **Verdict** | **ADOPT the ladder shape. Ranked #1 jointly with §1** — §1 is *what to do with a near-duplicate*, this is *how to find one cheaply*. |

**Markdown-native version.** In `write_distilled_card`, before `unique_slug_path`:

1. `slugify(title)` already exists — an exact slug hit is tier 1, and today it is
   the trigger for `-2` suffixing. **Invert it:** an exact slug collision should
   mean "probably the same concept," not "pick a new filename."
2. Tier 2: Jaccard over 3-gram shingles of the title, threshold 0.9, gated on the
   entropy/length checks above. ~40 lines of Rust, no dependency.
3. Tier 2b (Rhizome-specific, better than Graphiti's): cosine over the existing
   BGE-small embeddings, which catches "Event Sourcing" vs "Storing State as
   Events" that shingles never will.
4. Tier 3: hand the surviving ambiguity to the distilling agent as prompt context
   rather than as a separate call.

**Calibration warning:** every threshold above is Graphiti's, tuned for **entity
names**, not for paragraph-length cards. `_FUZZY_JACCARD_THRESHOLD = 0.9` on
3-grams of a 60-word card body will behave nothing like it does on "Alice Smith."
Treat 0.9 as the starting point for *titles only* and derive the body/embedding
threshold from a real vault before shipping. This is exactly the "placeholder
constant" trap the consolidation spike scope already flagged; do not repeat it.

---

## 5. Self-editing memory — Letta's tools are good; the drift is documented

### What Letta actually gives the agent

`letta/functions/function_sets/base.py`, on `main`:

| Tool | Semantics |
|---|---|
| `core_memory_append(label, content)` | legacy append |
| `core_memory_replace(label, old_content, new_content)` | legacy replace |
| `memory_replace(label, old_string, new_string)` | **precise edit; `old_string` must match verbatim and appear exactly once** |
| `memory_insert(label, new_string, insert_line=-1)` | line-addressed insert |
| `memory_apply_patch(label, patch)` | patch application |
| `memory_rethink(label, new_memory)` | **wholesale rewrite of a block** |
| `memory_finish_edits()` | end of edit sequence |
| `archival_memory_insert / _search` | out-of-context tier |

`memory_replace` is the interesting one, and it is an exact clone of a coding
agent's str-replace editor, including the guardrails:

- 0 occurrences → `ValueError: No replacement was performed, old_string … did not
  appear verbatim`
- \>1 occurrences → `ValueError: … Multiple occurrences … in lines [n, m]. Please
  ensure it is unique.`
- line-number prefixes in `old_string` → hard reject (three separate regex
  guards, because the model kept pasting back the view-only line numbers)
- docstring: *"Do NOT attempt to replace long strings, e.g. do not attempt to
  replace the entire contents of a memory block"*

and `memory_rethink`'s docstring is the policy: *"Use this tool to make large
sweeping changes (e.g. when you want to condense or reorganize the memory
blocks), do NOT use this tool to make small precise edits."* **Two tools, one
policy: precise edits are surgical and validated; wholesale rewrites are a
separate, explicitly-named act.**

Blocks are character-bounded (`limit`, typically ~5000 chars) with
`chars_current`/`chars_limit` tracked, and can be marked **read-only** so the
agent cannot touch them.

### Does it drift? Yes, and it is measured

- **Letta's own docs** warn that setting `value` directly *"completely replaces
  the entire block content"* and *"the last write wins"*, with data loss if
  multiple processes edit concurrently — recommended only in *"controlled
  scenarios where overwriting is acceptable."*
- **Two shipped failure modes** described in the ecosystem writeups (secondary
  sources, *unverified against Letta's own issue tracker*): the **empty block**
  (agent runs for weeks and never appends, because the trigger was never made
  concrete) and the **runaway block** (agent appends every micro-observation until
  it crowds out the rest of the context). Both are the failure modes of
  model-decided saves already identified in the 2026-08-02 research; the tools do
  not fix them.
- **[Memory-Induced Tool-Drift in LLM Agents (arXiv 2605.24941)](https://arxiv.org/pdf/2605.24941)**
  is the serious one, and it is a *safety* finding, not a hygiene one: stored
  personality-level biases (cost-consciousness, impatience, risk tolerance)
  silently distort tool-call *parameters* in unrelated professional contexts.
  105 scenarios × 5 bias dimensions × 7 domains; **seven frontier models all
  showed substantial drift; deflection scores rose by up to +3.6 on a 1–5 scale**
  under both direct injection and three production memory architectures; 608 of
  6,062 tools across 288 verified MCP servers were flagged susceptible. The
  paper's stated conclusion is that current defenses only partially mitigate it.

That last one is a live risk for Rhizome specifically, because
`get_vault_context` and the `rhizome-vault` skill feed vault content into agents
that then call tools. **Auto-distilled cards are attacker- and accident-reachable
prose that lands in a context window that drives tool calls.** This argues for
the review queue Rhizome does not have, and against turning session auto-distill
on by default.

### Verdict

| | |
|---|---|
| **Needs a DB?** | No — it is string editing over a bounded text blob, which is what a markdown note is. |
| **Cost/save** | Zero beyond the agent call already happening. |
| **Verdict** | **ADAPT the two-tool split. Ranked #4.** REJECT unsupervised agent rewriting of arbitrary vault notes. |

**Markdown-native version.** Rhizome already exposes `create_note`, `get_note`,
`update_frontmatter` — but **no body-level edit primitive**, which is why every
save path is a fresh file. Adding one should copy Letta's split exactly:

- `rhizome_amend_card(path, old_string, new_string)` — verbatim, unique-match-
  or-error, refuses whole-body replacement. This is the workhorse.
- `rhizome_rewrite_card(path, body)` — explicitly named as the sweeping-change
  tool, and **gated**: only on cards the current session created, or behind the
  review queue.
- Reuse the existing read-only mechanism. `vault_access.rs` already has
  `READ_ONLY_VAULT_PATHS` (`RHIZOME_VAULT.md`, the Portent type files). That is
  Letta's read-only block, already shipped — extend it rather than invent
  something.

Do not give agents `memory_rethink` over a user's vault. Letta's blocks are the
agent's own scratch state; Rhizome's notes are the user's documents. The failure
mode is not "the agent's memory got worse," it is "the user's file got
overwritten."

---

## 6. Decay / forgetting — nobody does it

Direct answer to the brief's question: **it is append-forever in practice,
everywhere, with one soft exception.**

- **Letta** — no decay. Blocks have a character `limit`; when full, it is the
  agent's job to condense. Failure to condense is a failure mode, not a policy.
- **Zep/Graphiti** — no decay. Invalidation sets `invalid_at`/`expired_at`; the
  fact remains queryable as history. This is deliberate: the temporal model exists
  *so that* nothing has to be forgotten.
- **Mem0** — one real mechanism, and it is not decay:
  [memory expiration](https://docs.mem0.ai/platform/features/memory-expiration).
  A caller sets `expiration_date: YYYY-MM-DD` (UTC, inclusive) and after it
  passes, `search()` and `get_all()` skip the memory. The doc is explicit:
  *"Expiration hides a memory, it does not delete it. The record stays in storage
  untouched"* — fetch-by-id still returns it, clearing the date restores it.
  **Nothing computes the date; a human or an agent sets it.** Not decay,
  not a heuristic: an explicit, reversible TTL.
- **Research** proposes plenty — recency-based decay, importance thresholds,
  learned removal policies, Weibull relevance curves, and "Oblivion" framing
  forgetting as reduced accessibility rather than deletion — but these are papers
  and surveys, *not* shipped behaviour in any of the three tools examined
  (*surveyed via secondary sources; individual papers not read in full*).

### Verdict

| | |
|---|---|
| **Needs a DB?** | No. |
| **Cost/save** | Zero. |
| **Verdict** | **REJECT automatic decay** — nobody ships it, and silently hiding a user's notes is a worse product than keeping them. **ADAPT expiration-as-soft-hide**, at low priority. Ranked #7. |

**Markdown-native version.** An optional `expires: YYYY-MM-DD` frontmatter key
that search and the Library panel skip once passed, with the file untouched on
disk. Reversible by deleting one line in a text editor. Suits exactly the class
of card auto-distill is best at and worst at simultaneously: "we are debugging X
this week." Note that §2's `valid_until` is the *world-time* version of the same
idea and is the more valuable of the two — if only one ships, ship `valid_until`.

**Explicit anti-recommendation:** do not implement recency- or frequency-based
automatic forgetting in a vault the user owns and can see. The literature that
proposes it is modelling agent context budgets, not human note collections. In a
markdown vault, deletion is the user's verb.

---

## 7. Prime `/refine` — the closest working example, and it is on this machine

The brief's hunch was right. `/refine` is a shipped, default-on, update-in-place
memory system with versioning, optimistic concurrency, and rollback. It is the
only system in this survey that does all three. Read from
`prime-agent@0.7.1`, `dist/core/refinement/refinement.js` (783 lines) and
`dist/core/agent-session.js`.

### What it does

**Storage.** `harness_state.json`, one JSON object with four buckets —
`prompt`, `memory`, `skill`, `subagent` — each an id→entry map. Two stores:
**global** (`~/.prime/agent/harness/`) and **local** (per-session
`session-artifacts/<id>/harness/`), merged for the prompt with local shadowing
global under a `local:`/`global:` id prefix. Writes are atomic (temp file +
`renameSync`, mode preserved). A corrupt state file **degrades to empty rather
than throwing**, with the reasoning in a comment: it is read on every
system-prompt build, so it must never break the session.

**Edits.** The refiner LLM returns JSON with an `edits` array; each edit is
`create | update | delete` × `prompt | memory | skill | subagent`, with `id`,
`title`, `content`, `path`, `metadata`, and a **`reason` per edit**. Applied by
`applyRefinementProposal`:

- `create` with an existing id → rejected, `"entry already exists"`
- `update`/`delete` with no existing entry → rejected, `"entry not found"`
- every applied write **increments `entry.version`**, preserves `created_at`,
  stamps `updated_at`, sets `source: "refine"`
- **optimistic concurrency:** if a baseline snapshot was taken and the on-disk
  entry no longer matches it, the edit is rejected with `"entry changed during
  refinement planning"` — because the planning LLM call *"can take many seconds,
  during which the kernel or another session may write the shared
  `harness_state.json`"*. Plan and apply are deliberately separate functions so
  the file can be re-read immediately before applying.
- `base_system_prompt` is hard-coded uneditable; prompt entries are *"supplemental
  notes only"*

**Rollback.** Every result is appended to `refinements.jsonl` with `before` and
`after` snapshots per edit. `rollbackProposal` walks the applied edits **in
reverse** and emits the inverse: had-a-before → `update` back to it; created →
`delete`. A rollback is itself a refinement, recorded with `rollbackOf`.

**Trigger — and this is the mechanism worth stealing.** Auto-refine is
**enabled by default** (`settings-manager.js:538`): `turnInterval: 25` assistant
turns, `cooldownMs: 20 * 60_000`, plus a run on context compaction. But it does
not refine on the timer. It runs a **two-stage gate**:

1. **Review** (`reviewAutoRefine`, ≤4,096 output tokens, non-reasoning): a cheap
   judge sees the trajectory, current harness overview, and refinement history,
   and returns `{shouldRefine, rationale, instructions}`. Its prompt: *"approve
   when the trajectory contains evidence useful to this session's future turns.
   Reject one-off noise, unsupported hypotheses, and transient tool outputs."*
2. **Refine** (`planRefinement`, ≤32,000 output tokens) — only if stage 1 said yes,
   and it inherits stage 1's `instructions` as focus.

Both stages force non-reasoning mode (`void thinkingLevel`) with an explicit
comment that reasoning-capable models otherwise spend their whole budget on
thinking and return no parseable JSON. Truncated JSON is diagnosed distinctly
from malformed JSON (`isIncompleteJson` counts brace depth and string state) so
"you blew the output budget" never gets reported as "the model returned garbage."

**Scope discipline.** Local is the default; global requires an explicit request
and is restricted to *"stable cross-session lessons, durable user preferences,
reusable skills/subagents, or tool/environment facts."* During a local
refinement, **global entries are read-only context** and the model is forbidden
from proposing edits to them. Project-specific lessons may go global only if the
title/path/content explicitly names the project.

**Context budget.** The overview shown to the refiner is capped —
`maxEntriesPerKind: 6`, content truncated to 180 chars, last 5 refinements — with
the framing *"compact summaries, not full descriptions. Use them as
routing/context hints; inspect… only when detail matters."* The trajectory slice
is capped at 80,000 chars (40,000 for the review gate).

The kernel-side surface is a skill: `await refine.run(instructions=None,
global_=False)` returns `{"scheduled": True}` immediately and **never runs
mid-cell** — a scheduled refinement runs when the turn ends, then the harness
rebuilds the system prompt and resumes the agent.

### Verdict

| | |
|---|---|
| **Needs a DB?** | No. One JSON file + one JSONL log per scope. |
| **Cost/save** | 1 cheap LLM call per checkpoint (≤4k out) + 1 expensive call (≤32k out) **only when the cheap one approves**. Amortised over 25 turns, not per turn. |
| **Verdict** | **ADOPT the two-stage gate and the versioned/rollback discipline. Ranked #3 (tied with §3) for the gate; #5 for versioning.** |

**What Rhizome should take, in order of value:**

1. **The two-stage gate, in place of `MIN_ASSISTANT_CHARS = 80`.** Rhizome
   currently fires a full agent distill on *every* turn over 80 characters. Prime
   fires a *cheap* judge every 25 turns with a 20-minute cooldown, and the
   expensive pass only on approval. That is strictly cheaper **and** strictly
   higher-precision than what auto-distill does today. It also directly answers
   the standing "what if the agent never triggers it" question that
   `automatic-memory-consolidation.md` was written for — **and it is a working
   implementation of that document's unsolved "who invokes the agent call in the
   background" problem, running on this machine.** The consolidation spike should
   be re-scoped around it rather than around an event-count threshold.
2. **`version` + `created_at`/`updated_at` on every card, and `before`/`after`
   snapshots in `.rhizome/events.jsonl`.** Rhizome's event log already records
   that a distill happened; it does not record what changed. Once §1 and §2 make
   writes non-append, that gap becomes the difference between an auditable vault
   and an un-undoable one. Prime's `refinements.jsonl` is the shape; Rhizome
   already has the file.
3. **Optimistic concurrency.** The exact hazard Prime guards against — a
   many-seconds LLM call while another writer touches the same state — is
   Rhizome's situation *precisely*: `vault_watcher.rs` plus a user editing in the
   app plus a background distill. Rhizome's current append-only design is
   accidentally immune. **The moment §1 or §2 lands, it stops being immune**, and
   `"entry changed during refinement planning"` is the error it will need.
4. **Local-vs-global scope.** Maps onto per-project vs vault-wide knowledge, and
   the read-only-global-during-local-refinement rule is a good default.
5. **Degrade-to-empty on a corrupt state file.** Rhizome has the mirror-image bug
   already tracked: one malformed `events.jsonl` line blanks the whole 200-event
   feed (2026-08-02 finding 8). Prime's comment explains the principle;
   `loadGlobalRefinementHistory` skips malformed JSONL lines individually *"so a
   single bad append cannot break rollback."* That is the fix for that finding,
   written out.

**What not to take:** the JSON blob store. Prime's harness is agent-owned runtime
state with no user-facing existence; Rhizome's equivalent is markdown the user
reads and edits. Take the discipline, keep the files.

---

## The ranking

By value-to-Rhizome, decisively:

| # | Mechanism | Source | Cost/save | Verdict |
|---|---|---|---|---|
| **1** | **Pre-write near-duplicate check** — exact slug → shingle/Jaccard → local cosine → agent, with neighbours injected into the distill prompt as a suppression list | Graphiti dedup ladder + Mem0 v3 phase 1–2 | **$0** (local BGE-small already in-tree) | **ADAPT** |
| **2** | **Temporal supersession frontmatter** — `valid_from` / `valid_until` / `superseded_by` / `superseded_at`; never delete, never rewrite | Graphiti `resolve_edge_contradictions` | $0 (agent already emits the card) | **ADOPT model / ADAPT plumbing** |
| **3** | **Two-stage save gate** — cheap LLM judge on an N-turn checkpoint with cooldown, expensive extraction only on approval, replacing the 80-char prefilter; **plus** the extraction-prompt rules (absolute dates, self-contained, 15–80 words, capture the transition, no echo/meta-extraction) | Prime `/refine` auto-review + Mem0 `ADDITIVE_EXTRACTION_PROMPT` | **cheaper than today** | **ADOPT** |
| **4** | **`old_string`-unique amend primitive**, split from an explicitly-named wholesale-rewrite tool that is gated | Letta `memory_replace` / `memory_rethink` | $0 | **ADAPT** |
| **5** | **Versioning + before/after snapshots + inverse-edit rollback + optimistic concurrency** in `.rhizome/events.jsonl` | Prime `applyRefinementProposal` / `refinements.jsonl` | $0 | **ADOPT — and it becomes mandatory the moment #1 or #2 ships** |
| **6** | **Contradiction-as-link** — emit `related::`/`supersedes::` wikilinks between a new card and its neighbours instead of resolving | Mem0 `linked_memory_ids` | $0 | **ADAPT** (Rhizome's wikilinks are already better than the source's UUID array) |
| **7** | **`expires:` soft-hide** — filter from search, never delete, one line to undo | Mem0 memory expiration | $0 | **ADAPT, low priority** — `valid_until` (#2) covers most of it |
| — | Second LLM call for ADD/UPDATE/DELETE reconciliation | Mem0 pre-v3 | 2× LLM calls | **REJECT** — removed by its own author, 2026-04-14 |
| — | Automatic recency/frequency decay | research only | — | **REJECT** — nothing ships it; deletion is the user's verb in a vault |
| — | Vector store / graph DB as the memory substrate | all three | infra | **REJECT** — settled by the destination-model research; the local embedder covers the retrieval need |
| — | Unsupervised agent rewriting of arbitrary vault notes | Letta `memory_rethink` | — | **REJECT** — last-write-wins data loss is documented by Letta itself; tool-drift risk is measured (arXiv 2605.24941) |

**Two things are worse in the peer tools than in Rhizome today**, stated plainly
because the brief asked:

- **Mem0's dedup is weaker than what Rhizome could ship this week.** MD5 of exact
  text catches nothing a human would call a duplicate. Rhizome has a local
  embedding model sitting idle at write time. Do not copy Mem0's dedup; copy
  Graphiti's.
- **Nobody has a review queue, and every one of them names the resulting failure
  mode.** Rhizome not having one is a shared gap, not a lag — but Rhizome is the
  only system here whose memory store is *a folder of files a human already reads
  and edits*, which means its review affordance can be "open the file" rather
  than "build a moderation UI." That is a structural advantage, currently unused:
  `state: fleeting` is written on every distilled card and read by nothing.

**Sequencing.** #3's prompt rules are free and independent — do them first. Then
#1, because it is the one that stops the vault rotting and needs no new
concepts. #2 next, because it is what #1 does with the near-duplicates it finds
that are *changes* rather than repeats. #5 lands with #1/#2 or not at all —
shipping update-in-place without an undo trail is the one genuinely bad outcome
available here.

---

## Sources

**Mem0**
- <https://github.com/mem0ai/mem0/pull/4805> — "port v3 pipeline…"; the ADD-only breaking change, merged 2026-04-14
- `mem0/memory/main.py` (`main`) — `_add_to_vector_store`, 8-phase pipeline, `top_k=10`, MD5 dedup: <https://raw.githubusercontent.com/mem0ai/mem0/main/mem0/memory/main.py>
- `mem0/configs/prompts.py` (`main`) — `ADDITIVE_EXTRACTION_PROMPT`, and the now-dead `DEFAULT_UPDATE_MEMORY_PROMPT` / `get_update_memory_messages`: <https://raw.githubusercontent.com/mem0ai/mem0/main/mem0/configs/prompts.py>
- <https://docs.mem0.ai/platform/features/memory-expiration> — expiration hides, does not delete
- <https://docs.mem0.ai/core-concepts/memory-types>

**Zep / Graphiti**
- `graphiti_core/utils/maintenance/edge_operations.py` — `resolve_extracted_edges`, `resolve_edge_contradictions`, `_extract_edge_timestamps`: <https://raw.githubusercontent.com/getzep/graphiti/main/graphiti_core/utils/maintenance/edge_operations.py>
- `graphiti_core/utils/maintenance/dedup_helpers.py` — MinHash/LSH/Jaccard/entropy constants: <https://raw.githubusercontent.com/getzep/graphiti/main/graphiti_core/utils/maintenance/dedup_helpers.py>
- `graphiti_core/prompts/dedupe_edges.py` — `EdgeDuplicate{duplicate_facts, contradicted_facts}`: <https://raw.githubusercontent.com/getzep/graphiti/main/graphiti_core/prompts/dedupe_edges.py>
- <https://arxiv.org/abs/2501.13956> — Zep paper; DMR 94.8% vs 93.4%, LongMemEval +18.5% / −90% latency (invalidation not attributed in the abstract)

**Letta**
- `letta/functions/function_sets/base.py` — `memory_replace` / `memory_insert` / `memory_apply_patch` / `memory_rethink` and their guardrails: <https://raw.githubusercontent.com/letta-ai/letta/main/letta/functions/function_sets/base.py>
- <https://docs.letta.com/guides/agents/memory-blocks> — char limits, read-only blocks, last-write-wins warning
- <https://www.letta.com/blog/memory-blocks/>
- <https://arxiv.org/pdf/2605.24941> — Memory-Induced Tool-Drift in LLM Agents
- Empty-block / runaway-block failure modes: secondary write-ups only, **unverified** against Letta's issue tracker

**Prime Agent** (installed `prime-agent@0.7.1`, read 2026-08-13)
- `~/.local/lib/node_modules/prime-agent/dist/core/refinement/refinement.js`
- `~/.local/lib/node_modules/prime-agent/dist/core/agent-session.js`
- `~/.local/lib/node_modules/prime-agent/dist/core/settings-manager.js:538` — `turnInterval: 25`, `cooldownMs: 20 * 60_000`, `enabled: true`
- `~/.local/lib/node_modules/prime-agent/skills/refine/SKILL.md`
- `~/.local/lib/node_modules/prime-agent/docs/usage.md`

**Decay / forgetting (research, secondary)**
- <https://arxiv.org/pdf/2602.06052> — Rethinking Memory Mechanisms of Foundation Agents (survey)
- <https://arxiv.org/pdf/2603.11768> — Governing Evolving Memory in LLM Agents (SSGM)
- <https://arxiv.org/pdf/2605.10870> — Rate-Distortion Framework for Agent Memory

**Rhizome files verified for this document**
- `src/utils/sessionAutoDistill.ts`, `src/lib/aiAgentStreamCallbacks.ts:248`
- `src-tauri/src/rhizome_distill.rs` (`write_distilled_card:146`, `is_junk_distill_title:131`)
- `src-tauri/src/rhizome_write_location.rs` (`unique_slug_path:155`, `default_frontmatter:128`)
- `src-tauri/src/rhizome_search/embedder.rs`, `src-tauri/src/rhizome_search/service.rs`
- `src-tauri/src/vault/views.rs:345` (`resolve_condition_field` → `entry.properties` fall-through)
- `src-tauri/src/frontmatter/mod.rs:81` (`update_frontmatter`)
- `src-tauri/src/settings.rs:20–21, 142–144, 269–275` (the flag whose ADR does not exist)
- `src-tauri/src/vault_access.rs:35–41` ("never edit, supersede instead")
- `docs/design/automatic-memory-consolidation.md`, `docs/plans/2026-08-02-consolidation-spike-scope.md`

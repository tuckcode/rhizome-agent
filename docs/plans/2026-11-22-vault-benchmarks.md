# Vault benchmarks: show what the vault does for agents

**Origin:** Claude Opus 5.5 · 2026-11-22 · Onlook session (indigo-plover, work in cobalt-heron)

## Goal

Show with numbers that a linked Markdown vault makes agents cheaper and more
accurate. Two tracks:

1. **Vault efficiency test.** Our own vault, our own tools. Counts tool calls,
   tokens, and coverage for graph-shaped questions. No model in the loop.
2. **LongMemEval.** A public long-term memory benchmark (Wu et al., ICLR 2025,
   [arXiv 2410.10813](https://arxiv.org/abs/2410.10813)). 500 questions. Each
   question has about 50 past chat sessions (about 115k tokens) and marks the
   sessions that hold the answer.

## Track 1: vault efficiency test

Script: `scripts/bench/vault-efficiency.mjs`. It starts the real MCP server
over stdio on a **copy** of a vault (graph tools append to
`.rhizome/events.jsonl`) and measures every reply.

Three question kinds, picked by a seeded sampler:

| Kind | Question | Baseline plan | Graph plan |
|------|----------|---------------|------------|
| context | Read X and what surrounds it | `get_note` X, `get_note` each outgoing link (cap 20), `search_notes` X's title for incoming | 1 `rhizome_graph_pack` |
| relation | How are X and Y related (2 to 3 hops) | Breadth-first: per note, `get_note` + `search_notes` title, cap 40 calls | 1 `rhizome_graph_path` |
| backlinks | Which notes link to X | `search_notes` X's title (limit 50) | 1 `rhizome_graph_neighbors` |

The baseline gets each linked note's path for free. A real agent spends
search calls to resolve `[[Title]]` links, so real baseline costs are higher.
Tokens are estimated as characters / 4.

## Track 2: LongMemEval

### Stage 1: retrieval only (no model)

Script: `scripts/bench/longmemeval_retrieval.py`. Each session becomes one
note in a throwaway vault. Retrievers rank sessions for the question:

- `rhizome`: `rhizome-tool search` (the ranked search behind `rhizome_search`)
- `bm25`: plain BM25 over the same notes (the paper's flat baseline kind)
- `phrase`: the `search_notes` rule (whole question as one substring)

Metrics: `recall_any@k` (one evidence session in top k) and `recall_all@k`
(all evidence sessions in top k). 470 questions (30 abstention questions have
no evidence and are skipped).

Data: `xiaowu0162/longmemeval-cleaned`, file `longmemeval_s_cleaned.json`
(277 MB). Download it into its own folder. Do not commit it.

### Stage 2: vault memory with a model (needs approval: cost)

1. **Distill.** A model turns each session into linked notes: one note per
   durable fact or event, with `[[links]]` to people, places, and earlier
   facts it updates. This is what `rhizome_distill` does for real sessions.
2. **Answer.** The reader model gets the question and Rhizome tools only:
   `rhizome_search`, `rhizome_graph_pack`, `rhizome_graph_path`, `get_note`.
3. **Judge.** The LongMemEval judge prompt grades each answer.
4. **Compare** with (a) full history in context and (b) BM25 top-k sessions
   in context, on the same reader model.
5. **Report** accuracy by question type, plus tokens and tool calls per
   question.

Size: 19,195 unique sessions, about 49M input tokens to distill in full.
Pilot: 30 questions (5 per question type), about 1,500 sessions and about
3.7M distill input tokens.

The strongest expected gains: knowledge-update (a new note links to the fact
it replaces) and multi-session questions (links join facts across sessions).

### Stage 3: multi-hop retrieval (later)

HippoRAG ([arXiv 2405.14831](https://arxiv.org/abs/2405.14831)) ranks passages
with Personalized PageRank over a knowledge graph, seeded by the query's
entities, and reports gains on MuSiQue and 2WikiMultiHopQA. Rhizome already
has the graph (wikilinks). Add a PPR ranker over it, seeded by search hits,
and test on the same datasets.

## Related work

- A-MEM ([arXiv 2502.12110](https://arxiv.org/abs/2502.12110)): Zettelkasten-style
  linked agent memory, tested on LoCoMo. Closest prior art to Rhizome.
- HippoRAG 2 ([arXiv 2502.14802](https://arxiv.org/abs/2502.14802)).

## Results

Filled in below by the session that ran each track.

### Track 1 result (2026-11-22)

Rhizome Vault copy, 662 real notes. Seeds 7, 11, 23. 120 questions.

| Kind | Questions | Calls (baseline → graph) | Est. tokens (baseline → graph) | Coverage (baseline → graph) |
|------|-----------|--------------------------|--------------------------------|-----------------------------|
| context | 45 | 373 → 45 | 384,147 → 84,427 | 0.71 → 0.85 |
| relation | 45 | 448 → 45 | 252,346 → 11,319 | 0.51 → 1.00 |
| backlinks | 30 | 30 → 30 | 27,190 → 32,657 | 0.22 → 1.00 |

**Limits. Read these before you quote the numbers.**

- The questions are graph-shaped by design. Most agent questions are not.
- The answer key is the graph itself, so graph-tool coverage near 1.00 is
  close to automatic. The key shows that search misses links. It does not
  show that the graph is complete.
- The baseline is a fixed script. A real agent may stop early or use grep.
  The relation baseline (breadth-first reading) is a weak plan.
- Fewer tokens is not the same answer. Pack returns snippets, and path
  returns note names only. Answer quality is not measured here. Stage 2 of
  Track 2 measures it.
- Tokens are characters / 4.

Coverage: share of true direct links found (context, backlinks), or share of
questions answered (relation). Pack coverage is below 1.00 because the pack
caps links at 20. Backlinks cost slightly more with the graph because
`rhizome_graph_neighbors` returns every edge in the neighbourhood. Plain
search finds about 1 in 5 of the notes that link to a note. The cause is not
checked yet. Likely suspects: links by alias or path, and the 50-result cap.

### Track 2, stage 1 result (2026-11-22)

LongMemEval-S cleaned, 470 questions with evidence. One session = one note.

| Retriever | recall_any@5 | recall_all@5 | recall_any@10 | recall_all@10 |
|-----------|--------------|--------------|---------------|---------------|
| rhizome (`rhizome-tool search`) | 0.966 | 0.832 | 0.979 | 0.902 |
| bm25 | 0.970 | 0.830 | 0.983 | 0.904 |
| phrase (`search_notes` rule) | 0.002 | 0.000 | 0.002 | 0.000 |

recall_all@5 by question type:

| Type | n | rhizome | bm25 |
|------|---|---------|------|
| multi-session | 121 | 0.645 | 0.661 |
| temporal-reasoning | 127 | 0.772 | 0.740 |
| single-session-preference | 30 | 0.867 | 0.867 |
| knowledge-update | 72 | 0.958 | 0.972 |
| single-session-user | 64 | 1.000 | 1.000 |
| single-session-assistant | 56 | 1.000 | 1.000 |

Findings:

- Rhizome's ranked search matches plain BM25 on raw sessions. Ranking is
  not where the vault wins.
- `search_notes` (whole query as one phrase) almost never finds evidence for
  a natural-language question. Agents that use it for questions get nothing.
- The gap is multi-session questions: in 35% of them, the top 5 misses at
  least one evidence session. Linked notes (stage 2) target this gap.
- Each vault path gets its own copy of the 129 MB embedding model under
  `<OS cache>/com.tolaria.app/search/<vault-key>/model`. Many vaults, or a
  renamed vault, download the model again. One shared model folder would fix
  it. The first stage 1 attempt left 23 GB of model copies before this was
  found. The script now reuses one vault folder.

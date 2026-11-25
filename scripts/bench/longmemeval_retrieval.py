#!/usr/bin/env python3
"""LongMemEval stage 1: session retrieval, no model in the loop.

For each question, every history session becomes one note in a fresh
throwaway vault. Three retrievers then rank the sessions for the question:

  rhizome   `rhizome-tool search` (the app's ranked search, as rhizome_search)
  bm25      a plain BM25 over the same notes (the paper's flat baseline kind)
  phrase    the `search_notes` rule: the whole question as one substring

LongMemEval marks which sessions hold the evidence (answer_session_ids), so
recall is exact. Abstention questions (id ends in _abs) have no evidence and
are skipped, as in the paper's retrieval tables.

  recall_any@k  at least one evidence session in the top k
  recall_all@k  every evidence session in the top k

Usage:
  python3 -I longmemeval_retrieval.py <longmemeval_s_cleaned.json> <rhizome-tool> \
      [--limit N] [--out results.json] [--work /tmp/dir]

Progress is saved to <out>.rows.jsonl after each question. A rerun with the
same --out resumes where it stopped.
"""

import argparse
import collections
import glob
import json
import math
import os
import re
import shutil
import subprocess
import time

TOKEN = re.compile(r"[a-z0-9]+")
STOP = set(
    "a an and are as at be but by did do does for from had has have how i in is it "
    "my me of on or so that the their them then there these they this to was we were "
    "what when where which who why will with you your".split()
)
KS = (5, 10)


def tokens(text):
    return [t for t in TOKEN.findall(text.lower()) if t not in STOP]


def bm25_rank(docs, query, k1=1.5, b=0.75):
    toks = {sid: tokens(text) for sid, text in docs.items()}
    n = len(toks)
    avg = sum(len(t) for t in toks.values()) / max(n, 1)
    df = collections.Counter(w for t in toks.values() for w in set(t))
    q = tokens(query)
    scores = {}
    for sid, t in toks.items():
        tf = collections.Counter(t)
        s = 0.0
        for w in q:
            if w not in tf:
                continue
            idf = math.log(1 + (n - df[w] + 0.5) / (df[w] + 0.5))
            s += idf * tf[w] * (k1 + 1) / (tf[w] + k1 * (1 - b + b * len(t) / avg))
        scores[sid] = s
    return sorted(scores, key=lambda sid: -scores[sid])


def session_text(date, turns):
    body = "\n\n".join(f"**{t['role']}:** {t['content']}" for t in turns)
    return f"# Session {date}\n\n{body}\n"


def write_vault(root, q):
    docs = {}
    for sid, date, turns in zip(q["haystack_session_ids"], q["haystack_dates"], q["haystack_sessions"]):
        text = session_text(date, turns)
        docs[sid] = text
        with open(os.path.join(root, f"{sid}.md"), "w", encoding="utf-8") as fh:
            fh.write(f"---\ndate: {date}\n---\n{text}")
    return docs


def rhizome_rank(tool, root, question, limit, tries=3):
    for attempt in range(tries):
        out = subprocess.run(
            [tool, "search", root, question, "--limit", str(limit)],
            capture_output=True, text=True, timeout=300,
        )
        if out.returncode == 0:
            hits = json.loads(out.stdout)
            return [h["path"][:-3] if h["path"].endswith(".md") else h["path"] for h in hits]
        time.sleep(5 * (attempt + 1))
    raise RuntimeError(out.stderr.strip()[:300])


# Rhizome keeps a search index AND a copy of the embedding model per vault
# path, under <OS cache>/com.tolaria.app/search/<name>-<hash>/. A new vault
# per question would download the 129 MB model each time. So the run reuses
# one vault folder and, between questions, removes the index but keeps the
# model.
CACHE_ROOT = os.path.expanduser("~/Library/Caches/com.tolaria.app/search")


def reset_vault(root):
    for name in os.listdir(root):
        path = os.path.join(root, name)
        if os.path.isdir(path):
            shutil.rmtree(path)
        else:
            os.remove(path)
    for cache in glob.glob(os.path.join(CACHE_ROOT, os.path.basename(root) + "-*")):
        for name in os.listdir(cache):
            if name == "model":
                continue
            path = os.path.join(cache, name)
            shutil.rmtree(path) if os.path.isdir(path) else os.remove(path)


def phrase_rank(docs, question):
    q = question.lower()
    return [sid for sid, text in docs.items() if q in text.lower()]


def score(ranked, gold):
    row = {}
    for k in KS:
        top = set(ranked[:k])
        row[f"recall_any@{k}"] = int(bool(top & gold))
        row[f"recall_all@{k}"] = int(gold <= top)
    return row


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("data")
    ap.add_argument("tool")
    ap.add_argument("--limit", type=int, default=0, help="first N questions only")
    ap.add_argument("--out")
    ap.add_argument("--work", default="/tmp")
    args = ap.parse_args()

    with open(args.data, encoding="utf-8") as fh:
        data = [q for q in json.load(fh) if not q["question_id"].endswith("_abs")]
    if args.limit:
        data = data[: args.limit]

    root = os.path.join(args.work, "lme-run-vault")
    os.makedirs(root, exist_ok=True)
    progress = (args.out or os.path.join(args.work, "lme-stage1")) + ".rows.jsonl"
    rows = []
    if os.path.exists(progress):
        with open(progress, encoding="utf-8") as fh:
            rows = [json.loads(line) for line in fh if line.strip()]
    done = {r["id"] for r in rows}

    started = time.time()
    for i, q in enumerate(data):
        if q["question_id"] in done:
            continue
        reset_vault(root)
        docs = write_vault(root, q)
        gold = set(q["answer_session_ids"])
        ranked = {
            "rhizome": rhizome_rank(args.tool, root, q["question"], max(KS)),
            "bm25": bm25_rank(docs, q["question"]),
            "phrase": phrase_rank(docs, q["question"]),
        }
        row = {"id": q["question_id"], "type": q["question_type"], "evidence": len(gold)}
        for name, r in ranked.items():
            row[name] = score(r, gold)
        rows.append(row)
        with open(progress, "a", encoding="utf-8") as fh:
            fh.write(json.dumps(row) + "\n")
        if (i + 1) % 25 == 0:
            print(f"{i + 1}/{len(data)} questions, {time.time() - started:.0f}s", flush=True)
    reset_vault(root)

    def mean(name, metric, subset):
        return round(sum(r[name][metric] for r in subset) / len(subset), 3) if subset else None

    metrics = [f"recall_{m}@{k}" for k in KS for m in ("any", "all")]
    summary = {"questions": len(rows), "overall": {}, "by_type": {}}
    for name in ("rhizome", "bm25", "phrase"):
        summary["overall"][name] = {m: mean(name, m, rows) for m in metrics}
    for qtype in sorted({r["type"] for r in rows}):
        subset = [r for r in rows if r["type"] == qtype]
        summary["by_type"][qtype] = {
            "n": len(subset),
            **{name: mean(name, "recall_all@5", subset) for name in ("rhizome", "bm25")},
        }
    if args.out:
        with open(args.out, "w", encoding="utf-8") as fh:
            json.dump({"summary": summary, "rows": rows}, fh, indent=2)
    print(json.dumps(summary, indent=2))


if __name__ == "__main__":
    main()

#!/usr/bin/env node
// Vault efficiency test: what does an agent pay to answer graph-shaped
// questions with plain note reads, and what does it pay with the graph
// tools? It calls the real MCP server over stdio and measures each reply.
//
// No model is in the loop. The test counts tool calls and reply size for a
// fixed, reproducible plan per question. Tokens are estimated as chars / 4.
//
// The baseline is generous on purpose: it gets each linked note's path for
// free (a real agent would spend search calls to resolve [[Title]] links).
//
// Usage:
//   RHIZOME_TOOL_PATH=src-tauri/target/debug/rhizome-tool \
//     node scripts/bench/vault-efficiency.mjs <vault-copy> [--seed N] [--out file.json]
//
// Run it on a COPY of a vault. The graph tools append to .rhizome/events.jsonl.

import { writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'

const here = path.dirname(fileURLToPath(import.meta.url))
const mcpDir = path.resolve(here, '../../mcp-server')
const require = createRequire(path.join(mcpDir, 'package.json'))
const { Client } = require('@modelcontextprotocol/sdk/client/index.js')
const { StdioClientTransport } = require('@modelcontextprotocol/sdk/client/stdio.js')

const argv = process.argv.slice(2)
const vault = argv.find((a) => !a.startsWith('--'))
if (!vault) {
  console.error('usage: vault-efficiency.mjs <vault-copy> [--seed N] [--out file.json]')
  process.exit(2)
}
const flag = (name, fallback) => {
  const i = argv.indexOf(name)
  return i >= 0 ? argv[i + 1] : fallback
}
const seed = Number(flag('--seed', '7'))
const outFile = flag('--out', null)
const PER_KIND = { context: 15, relation: 15, backlinks: 10 }
const MAX_BASELINE_READS = 40
const CONTEXT_LINK_CAP = 20

// Small deterministic PRNG so a seed reproduces the same questions.
function rng(s) {
  let x = s >>> 0 || 1
  return () => {
    x ^= x << 13; x >>>= 0
    x ^= x >>> 17
    x ^= x << 5; x >>>= 0
    return x / 0x100000000
  }
}
const rand = rng(seed)
const sample = (items, n) => {
  const copy = [...items]
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy.slice(0, n)
}

const transport = new StdioClientTransport({
  command: process.execPath,
  args: ['index.js'],
  cwd: mcpDir,
  env: { ...process.env, VAULT_PATH: path.resolve(vault), WS_UI_PORT: '65533' },
  stderr: 'ignore',
})
const client = new Client({ name: 'vault-efficiency', version: '0.0.0' }, { capabilities: {} })
await client.connect(transport)

/** One tool call. Returns the reply text and its size. */
async function call(name, args) {
  const res = await client.callTool({ name, arguments: args })
  const text = (res.content ?? []).map((c) => c.text ?? '').join('')
  if (res.isError) throw new Error(`${name} failed: ${text.slice(0, 200)}`)
  return { text, chars: text.length }
}
const json = (text) => JSON.parse(text.slice(text.indexOf('{')))

// The full graph, loaded once, to pick questions and to know ground truth.
const { execFileSync } = await import('node:child_process')
const full = JSON.parse(
  execFileSync(process.env.RHIZOME_TOOL_PATH, ['graph', path.resolve(vault)], { maxBuffer: 256 << 20 }).toString(),
)
const nodes = new Map(full.nodes.map((n) => [n.id, n]))
const real = (id) => nodes.get(id) && !nodes.get(id).ghost
const out = new Map()
const inn = new Map()
for (const e of full.edges) {
  if (e.source === e.target) continue
  if (!out.has(e.source)) out.set(e.source, new Set())
  if (!inn.has(e.target)) inn.set(e.target, new Set())
  out.get(e.source).add(e.target)
  inn.get(e.target).add(e.source)
}
const outOf = (id) => [...(out.get(id) ?? [])].filter(real)
const inOf = (id) => [...(inn.get(id) ?? [])].filter(real)
const undirected = (id) => new Set([...outOf(id), ...inOf(id)])

function bfsDistance(from, to, limit = 3) {
  const seen = new Map([[from, 0]])
  const queue = [from]
  while (queue.length) {
    const id = queue.shift()
    const d = seen.get(id)
    if (id === to) return d
    if (d >= limit) continue
    for (const next of undirected(id)) {
      if (!seen.has(next)) { seen.set(next, d + 1); queue.push(next) }
    }
  }
  return Infinity
}

const realIds = [...nodes.values()].filter((n) => !n.ghost).map((n) => n.id).sort()
const contextPool = realIds.filter((id) => { const k = undirected(id).size; return k >= 3 && k <= 60 })
const backlinkPool = realIds.filter((id) => inOf(id).length >= 3)

const results = []
const read = (id) => call('get_note', { path: id })

// --- Kind 1: "Read X and tell me what surrounds it." ---
for (const id of sample(contextPool, PER_KIND.context)) {
  // Baseline: read X, read each outgoing link, search the title for incoming.
  let calls = 1
  let chars = (await read(id)).chars
  const outLinks = outOf(id).slice(0, CONTEXT_LINK_CAP)
  for (const target of outLinks) { calls++; chars += (await read(target)).chars }
  const title = nodes.get(id).title
  const search = await call('search_notes', { query: title, limit: 20 })
  calls++; chars += search.chars
  const foundIn = inOf(id).filter((src) => search.text.includes(src)).length
  const truth = undirected(id).size
  const baseFound = Math.min(outLinks.length + foundIn, truth)

  const pack = await call('rhizome_graph_pack', { note: id, limit: CONTEXT_LINK_CAP })
  const packed = json(pack.text)
  results.push({
    kind: 'context', note: id, truthLinks: truth,
    baseline: { calls, chars, linksFound: baseFound },
    graph: { calls: 1, chars: pack.chars, linksFound: Math.min(packed.links.length, truth), totalReported: packed.totalLinks },
  })
}

// --- Kind 2: "How are X and Y related?" (2 or 3 hops apart) ---
const pairs = []
for (const from of sample(realIds.filter((id) => undirected(id).size > 0), 400)) {
  if (pairs.length >= PER_KIND.relation) break
  const ring = [...undirected(from)].flatMap((a) => [...undirected(a)]).filter((b) => b !== from)
  const candidates = sample([...new Set(ring)], 20)
  const to = candidates.find((c) => { const d = bfsDistance(from, c); return d === 2 || d === 3 })
  if (to) pairs.push([from, to])
}
for (const [from, to] of pairs) {
  // Baseline: breadth-first. For each note it reads the note (reveals
  // outgoing links) and searches the note's title (reveals some incoming
  // links), as a careful agent would. Two calls per step.
  let calls = 0
  let chars = 0
  let found = false
  const seen = new Set([from])
  const queue = [from]
  while (queue.length && calls < MAX_BASELINE_READS) {
    const id = queue.shift()
    calls++; chars += (await read(id)).chars
    const search = await call('search_notes', { query: nodes.get(id).title, limit: 20 })
    calls++; chars += search.chars
    const next = [...outOf(id), ...inOf(id).filter((src) => search.text.includes(src))]
    if (next.includes(to)) { found = true; break }
    for (const n of next) if (!seen.has(n)) { seen.add(n); queue.push(n) }
  }
  const p = await call('rhizome_graph_path', { from, to })
  const report = json(p.text)
  results.push({
    kind: 'relation', from, to, hops: bfsDistance(from, to),
    baseline: { calls, chars, answered: found },
    graph: { calls: 1, chars: p.chars, answered: Boolean(report.connected) },
  })
}

// --- Kind 3: "Which notes link to X?" ---
for (const id of sample(backlinkPool, PER_KIND.backlinks)) {
  const truth = inOf(id)
  const title = nodes.get(id).title
  const search = await call('search_notes', { query: title, limit: 50 })
  const found = truth.filter((src) => search.text.includes(src)).length
  const n = await call('rhizome_graph_neighbors', { note: id, depth: 1 })
  const hood = json(n.text)
  const inSet = new Set(hood.edges.filter((e) => e.target === id).map((e) => e.source))
  const graphFound = truth.filter((src) => inSet.has(src)).length
  results.push({
    kind: 'backlinks', note: id, truthLinks: truth.length,
    baseline: { calls: 1, chars: search.chars, linksFound: found },
    graph: { calls: 1, chars: n.chars, linksFound: graphFound },
  })
}

await client.close()

// --- Summary ---
const sum = (xs, f) => xs.reduce((a, x) => a + f(x), 0)
const summary = {}
for (const kind of ['context', 'relation', 'backlinks']) {
  const rows = results.filter((r) => r.kind === kind)
  const coverage = (side) => kind === 'relation'
    ? sum(rows, (r) => (r[side].answered ? 1 : 0)) / rows.length
    : sum(rows, (r) => r[side].linksFound) / sum(rows, (r) => r.truthLinks)
  summary[kind] = {
    questions: rows.length,
    baseline: { calls: sum(rows, (r) => r.baseline.calls), estTokens: Math.round(sum(rows, (r) => r.baseline.chars) / 4), coverage: +coverage('baseline').toFixed(3) },
    graph: { calls: sum(rows, (r) => r.graph.calls), estTokens: Math.round(sum(rows, (r) => r.graph.chars) / 4), coverage: +coverage('graph').toFixed(3) },
  }
}
const report = { seed, vaultNotes: realIds.length, generatedAt: new Date().toISOString(), summary, results }
if (outFile) writeFileSync(outFile, JSON.stringify(report, null, 2))
console.log(JSON.stringify({ seed, vaultNotes: realIds.length, summary }, null, 2))

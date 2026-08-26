/**
 * Bridge Prime/Pi session JSONL → Mindwalk-friendly events.
 *
 * Prime's dominant tool is `ipython` (often with `%%bash`). Raw sessions light
 * zero file targets in Mindwalk. Rewrite those cells into bash/command-shaped
 * tool records Mindwalk already understands.
 */

function extractBashFromIpythonCode(code: string): string | null {
  const trimmed = code.replace(/^\uFEFF/, '')
  const lines = trimmed.split(/\r?\n/)
  if (lines[0]?.trim() !== '%%bash' && lines[0]?.trim() !== '%%sh') {
    // Also accept whole-cell shell without magic if it looks like a script with cd/git/rg
    if (/^\s*(cd|git|rg|fd|find|ls|cat|sed|npm|pnpm|cargo|python3?)\b/m.test(trimmed) && !trimmed.includes('await ')) {
      return trimmed
    }
    return null
  }
  return lines.slice(1).join('\n')
}

function rewriteToolCallArguments(toolName: string, args: unknown): { toolName: string; args: unknown; rewritten: boolean } {
  if (toolName !== 'ipython' && toolName !== 'IPython' && toolName !== 'bash') {
    return { toolName, args, rewritten: false }
  }
  if (!args || typeof args !== 'object') return { toolName, args, rewritten: false }
  const record = args as Record<string, unknown>
  const code = typeof record.code === 'string'
    ? record.code
    : typeof record.input === 'string'
      ? record.input
      : typeof record.command === 'string'
        ? record.command
        : null
  if (!code) return { toolName, args, rewritten: false }
  const bash = extractBashFromIpythonCode(code)
  if (!bash) return { toolName, args, rewritten: false }
  return {
    toolName: 'bash',
    args: { ...record, command: bash, code: undefined, description: record.description ?? 'ipython %%bash' },
    rewritten: true,
  }
}

/** Deep-walk a JSON value and rewrite toolCall-shaped nodes. */
export function rewritePrimeSessionValue(value: unknown): { value: unknown; rewritten: number } {
  let rewritten = 0

  const walk = (node: unknown): unknown => {
    if (Array.isArray(node)) return node.map(walk)
    if (!node || typeof node !== 'object') return node
    const obj = node as Record<string, unknown>

    // OpenAI-ish tool call on assistant content
    if (obj.type === 'toolCall' && typeof obj.name === 'string') {
      const next = rewriteToolCallArguments(obj.name, obj.arguments ?? obj.args ?? obj.input)
      if (next.rewritten) rewritten += 1
      return {
        ...obj,
        name: next.toolName,
        arguments: next.args,
      }
    }

    // Nested message.content arrays
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(obj)) {
      out[k] = walk(v)
    }

    // toolResult with matching name
    if (typeof out.toolName === 'string' && out.toolName === 'ipython') {
      // leave toolResult name; Mindwalk keys off the call side primarily
    }
    return out
  }

  return { value: walk(value), rewritten }
}

export function bridgePrimeSessionJsonl(raw: string): { bridged: string; rewrittenTools: number; lineCount: number } {
  const lines = raw.split(/\r?\n/)
  let rewrittenTools = 0
  const out: string[] = []
  for (const line of lines) {
    if (!line.trim()) {
      out.push(line)
      continue
    }
    try {
      const parsed = JSON.parse(line) as unknown
      const { value, rewritten } = rewritePrimeSessionValue(parsed)
      rewrittenTools += rewritten
      out.push(JSON.stringify(value))
    } catch {
      out.push(line)
    }
  }
  return { bridged: out.join('\n') + (raw.endsWith('\n') ? '' : ''), rewrittenTools, lineCount: lines.filter((l) => l.trim()).length }
}

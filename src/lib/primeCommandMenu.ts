/**
 * Command-menu sourcing for the composer `/` list (#10 + #16).
 *
 * Prime's `get_commands` returns every installed skill. On a machine that
 * also uses Claude/Codex this is mostly a personal coding toolkit — a live
 * probe against 0.7.2 returned 101 entries, 89 of them `source: auto` +
 * `scope: user` under `~/.agents/skills`. Those must not appear here.
 *
 * Origin is `sourceInfo`, not the command name. Docs still describe a flatter
 * `source`/`location` layout; the wire uses this shape. Fail closed when
 * provenance is missing rather than guessing.
 */

export interface PrimeCommandSourceInfo {
  path?: string
  source?: string
  scope?: string
  origin?: string
  baseDir?: string
}

export interface PrimeReportedCommand {
  name?: string
  description?: string
  source?: string
  argumentHint?: string
  sourceInfo?: PrimeCommandSourceInfo
}

export type CommandMenuKind = 'skill' | 'instant'

export interface CommandMenuEntry {
  name: string
  slash: string
  description: string
  kind: CommandMenuKind
}

function slashName(name: string): string {
  return name.startsWith('skill:') ? name.slice('skill:'.length) : name
}

/**
 * Prime's own bundled skills, plus skills Rhizome itself installed into the
 * vault. Everything else — especially auto-discovered user skills — is a
 * personal toolkit for other tools, not this product.
 */
export function isProductCommand(command: PrimeReportedCommand): boolean {
  const info = command.sourceInfo
  if (!info) return false
  if (info.source === 'builtin') return true
  if (info.source === 'auto' && info.scope === 'project') return true
  return false
}

export function selectCommandMenuEntries(
  commands: readonly PrimeReportedCommand[],
): CommandMenuEntry[] {
  const entries: CommandMenuEntry[] = []

  for (const command of commands) {
    const name = command.name?.trim()
    if (!name || !isProductCommand(command)) continue

    entries.push({
      name,
      slash: slashName(name),
      description: command.description?.trim() ?? '',
      kind: command.source === 'skill' || name.startsWith('skill:') ? 'skill' : 'instant',
    })
  }

  return entries
}

export interface ActiveSlashQuery {
  start: number
  query: string
}

/**
 * `/` opens a command anywhere in the composer, but only as its own token.
 * A date (`2026/08/16`) or a path (`src/lib/foo.ts`, `/usr/bin`) is not a
 * command — those are why the menu must get out of the way mid-sentence.
 */
export function findActiveSlashQuery(
  value: string,
  selectionIndex: number,
): ActiveSlashQuery | null {
  const clamped = Math.max(0, Math.min(selectionIndex, value.length))
  const before = value.slice(0, clamped)
  const start = before.lastIndexOf('/')
  if (start < 0) return null
  if (start > 0 && !/\s/.test(before.charAt(start - 1))) return null

  const query = before.slice(start + 1)
  if (query.includes('/') || /[\s\r\n]/.test(query)) return null
  return { start, query }
}

export function matchCommandMenuEntries(
  entries: readonly CommandMenuEntry[],
  query: string,
): CommandMenuEntry[] {
  const needle = query.trim().toLowerCase()
  if (!needle) return [...entries]
  return entries.filter((entry) => entry.slash.toLowerCase().startsWith(needle))
}

/**
 * Protocol commands Rhizome implements itself. Prime's TUI `/fork`,
 * `/compact` and `/export` are not in `get_commands` and would no-op if
 * forwarded as prompt text — so they live here, not in the skill list.
 */
export const PROTOCOL_COMMANDS: CommandMenuEntry[] = [
  { name: 'fork', slash: 'fork', description: 'Branch from a past message', kind: 'instant' },
  { name: 'compact', slash: 'compact', description: 'Compact this conversation', kind: 'instant' },
]

export function buildCommandMenu(
  commands: readonly PrimeReportedCommand[],
): CommandMenuEntry[] {
  const reserved = new Set(PROTOCOL_COMMANDS.map((entry) => entry.slash))
  const skills = selectCommandMenuEntries(commands).filter((entry) => !reserved.has(entry.slash))
  return [...PROTOCOL_COMMANDS, ...skills]
}

export type CommandMenuAction =
  | { kind: 'prompt'; text: string }
  | { kind: 'instant'; name: string }

export interface CommandMenuEdit {
  value: string
  nextSelectionIndex: number
}

/**
 * Replace the active `/token` with the chosen command. Skills stay as
 * prompt text (`/goal`); instant commands leave the box empty so they
 * are not forwarded to Prime as a no-op.
 */
export function applyCommandMenuSelection(
  value: string,
  selectionIndex: number,
  entry: CommandMenuEntry,
): CommandMenuEdit & { action: CommandMenuAction } | null {
  const active = findActiveSlashQuery(value, selectionIndex)
  if (!active) return null

  const after = value.slice(selectionIndex)
  const next = `${value.slice(0, active.start)}${after}`
  return {
    value: next,
    nextSelectionIndex: active.start,
    action: entry.kind === 'instant'
      ? { kind: 'instant', name: entry.slash }
      : { kind: 'prompt', text: `/${entry.slash}` },
  }
}

/** Escape closes the menu and leaves the slash in the input. */
export function dismissSlashQuery(
  value: string,
  selectionIndex: number,
): CommandMenuEdit {
  return { value, nextSelectionIndex: selectionIndex }
}

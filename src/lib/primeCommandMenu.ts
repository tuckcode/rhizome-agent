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

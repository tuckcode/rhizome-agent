import { describe, expect, it } from 'vitest'
import {
  applyCommandMenuSelection,
  buildCommandMenu,
  dismissSlashQuery,
  findActiveSlashQuery,
  matchCommandMenuEntries,
  selectCommandMenuEntries,
  type CommandMenuEntry,
  type PrimeReportedCommand,
} from './primeCommandMenu'

/**
 * Shapes pinned from a live `get_commands` probe against prime-agent 0.7.2
 * (isolated daemon, 2026-08-16). Docs still show a flatter `source`/`location`
 * layout; the wire uses `sourceInfo`. Do not invent fields the daemon does
 * not send.
 */
function reported(
  overrides: Partial<Omit<PrimeReportedCommand, 'sourceInfo'>> & {
    sourceInfo?: PrimeReportedCommand['sourceInfo']
  } = {},
): PrimeReportedCommand {
  const { sourceInfo, ...rest } = overrides
  return {
    name: 'skill:ask-matt',
    description: 'Ask which skill or flow fits',
    source: 'skill',
    ...rest,
    sourceInfo: {
      path: '/Users/dtc/.agents/skills/ask-matt/SKILL.md',
      source: 'auto',
      scope: 'user',
      origin: 'top-level',
      ...sourceInfo,
    },
  }
}

describe('selectCommandMenuEntries', () => {
  it('drops auto-discovered user skills from ~/.agents/skills', () => {
    const menu = selectCommandMenuEntries([
      reported({ name: 'skill:ask-matt' }),
      reported({
        name: 'skill:tdd',
        sourceInfo: { path: '/Users/dtc/.agents/skills/tdd/SKILL.md', source: 'auto', scope: 'user' },
      }),
    ])

    expect(menu.map((entry) => entry.name)).toEqual([])
  })

  it('keeps Prime builtin skills', () => {
    const menu = selectCommandMenuEntries([
      reported({
        name: 'skill:goal',
        description: 'Set a persistent objective',
        sourceInfo: {
          path: '/Users/dtc/.local/lib/node_modules/prime-agent/dist/skills/goal/SKILL.md',
          source: 'builtin',
          scope: 'user',
        },
      }),
    ])

    expect(menu).toEqual([
      {
        name: 'skill:goal',
        slash: 'goal',
        description: 'Set a persistent objective',
        kind: 'skill',
      },
    ])
  })

  it('keeps the project-scoped rhizome-vault skill Rhizome seeded', () => {
    const menu = selectCommandMenuEntries([
      reported({
        name: 'skill:rhizome-vault',
        description: 'Call Rhizome vault tools',
        sourceInfo: {
          path: '/Users/dtc/Documents/Rhizome Vault/.prime/agent/skills/rhizome-vault/SKILL.md',
          source: 'auto',
          scope: 'project',
          origin: 'top-level',
        },
      }),
    ])

    expect(menu.map((entry) => entry.name)).toEqual(['skill:rhizome-vault'])
    expect(menu[0].kind).toBe('skill')
    expect(menu[0].slash).toBe('rhizome-vault')
  })

  it('fails closed when sourceInfo is missing rather than guessing from the name', () => {
    const menu = selectCommandMenuEntries([
      { name: 'skill:mystery', source: 'skill' },
    ])

    expect(menu).toEqual([])
  })
})

describe('findActiveSlashQuery', () => {
  it('opens on a slash at the start of the input', () => {
    expect(findActiveSlashQuery('/', 1)).toEqual({ start: 0, query: '' })
  })

  it('opens on a slash after whitespace, not only at position zero', () => {
    expect(findActiveSlashQuery('please /go', 10)).toEqual({ start: 7, query: 'go' })
  })

  it('does not treat a date as a command', () => {
    expect(findActiveSlashQuery('due 2026/08/16', 14)).toBeNull()
  })

  it('does not treat a relative path as a command', () => {
    expect(findActiveSlashQuery('see src/lib/foo.ts', 18)).toBeNull()
  })

  it('closes once a second slash makes it a file path', () => {
    expect(findActiveSlashQuery('/usr/bin', 8)).toBeNull()
  })

  it('closes once a space ends the command token', () => {
    expect(findActiveSlashQuery('/compact now', 12)).toBeNull()
  })
})

const sampleMenu: CommandMenuEntry[] = [
  { name: 'fork', slash: 'fork', description: 'Branch from a past message', kind: 'instant' },
  { name: 'skill:goal', slash: 'goal', description: 'Set a persistent objective', kind: 'skill' },
]

describe('matchCommandMenuEntries', () => {
  it('shows every entry on a bare slash', () => {
    expect(matchCommandMenuEntries(sampleMenu, '').map((entry) => entry.slash)).toEqual([
      'fork',
      'goal',
    ])
  })

  it('filters by the command name', () => {
    expect(matchCommandMenuEntries(sampleMenu, 'go').map((entry) => entry.slash)).toEqual(['goal'])
  })

  it('returns nothing when nothing matches, so the menu can close', () => {
    expect(matchCommandMenuEntries(sampleMenu, 'zzzz')).toEqual([])
  })
})

describe('buildCommandMenu', () => {
  it('puts fork, compact and export on the menu as instant commands', () => {
    const menu = buildCommandMenu([])
    expect(menu.filter((entry) => entry.kind === 'instant').map((entry) => entry.slash)).toEqual([
      'fork',
      'compact',
      'export',
    ])
  })

  it('does not let a user skill leak in beside the protocol commands', () => {
    const menu = buildCommandMenu([reported({ name: 'skill:ask-matt' })])
    expect(menu.map((entry) => entry.slash)).toEqual(['fork', 'compact', 'export'])
  })
})

describe('applyCommandMenuSelection', () => {
  it('replaces the slash token with the skill as prompt text', () => {
    expect(applyCommandMenuSelection('please /go', 10, {
      name: 'skill:goal',
      slash: 'goal',
      description: 'Set a persistent objective',
      kind: 'skill',
    })).toEqual({
      value: 'please /goal',
      nextSelectionIndex: 12,
      action: { kind: 'prompt', text: '/goal' },
    })
  })

  it('clears the token when an instant command is chosen', () => {
    expect(applyCommandMenuSelection('/fork', 5, {
      name: 'fork',
      slash: 'fork',
      description: 'Branch from a past message',
      kind: 'instant',
    })).toEqual({
      value: '',
      nextSelectionIndex: 0,
      action: { kind: 'instant', name: 'fork' },
    })
  })
})

describe('dismissSlashQuery', () => {
  it('leaves the slash in the input', () => {
    expect(dismissSlashQuery('/compact', 8)).toEqual({
      value: '/compact',
      nextSelectionIndex: 8,
    })
  })
})

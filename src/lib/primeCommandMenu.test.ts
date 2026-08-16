import { describe, expect, it } from 'vitest'
import {
  selectCommandMenuEntries,
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

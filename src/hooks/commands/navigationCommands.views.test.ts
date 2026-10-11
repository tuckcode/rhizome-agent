import { describe, expect, it, vi } from 'vitest'
import { RAIL_VIEWS } from '../../lib/railViews'
import { buildNavigationCommands } from './navigationCommands'

describe('navigation Views commands', () => {
  it('exposes the four rail views in order under the Views group', () => {
    const onSelect = vi.fn()
    const commands = buildNavigationCommands({
      onQuickOpen: vi.fn(),
      onSelect,
      showInbox: true,
    })
    const views = commands.filter((command) => command.group === 'Views')
    expect(views.map((command) => command.id)).toEqual(RAIL_VIEWS.map((view) => view.commandId))
    expect(views.map((command) => command.label)).toEqual(RAIL_VIEWS.map((view) => view.goLabel))

    const inboxIndex = commands.findIndex((command) => command.id === 'go-inbox')
    const firstViewIndex = commands.findIndex((command) => command.id === 'go-research')
    expect(inboxIndex).toBeGreaterThan(-1)
    expect(firstViewIndex).toBeGreaterThan(inboxIndex)

    views[2]?.execute()
    expect(onSelect).toHaveBeenCalledWith({ kind: 'filter', filter: 'mycelium' })
  })
})

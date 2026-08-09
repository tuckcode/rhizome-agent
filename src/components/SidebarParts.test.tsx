import { render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { Rocket } from '@phosphor-icons/react'
import { SectionContent } from './SidebarParts'
import type { SidebarSelection } from '../types'

const group = { label: 'Projects', type: 'Project', Icon: Rocket }
const baseProps = {
  group,
  itemCount: 3,
  selection: { kind: 'filter', filter: 'all' } as SidebarSelection,
  onSelect: () => {},
  onContextMenu: () => {},
}

describe('SectionContent type-row glyph (wave 5.4a node bullets)', () => {
  afterEach(() => {
    localStorage.removeItem('ff_shell_command_rail')
  })

  it('renders the Phosphor type icon (no node dot) when the command-rail flag is off', () => {
    // Explicit opt-out, not removeItem: the flag defaults ON since cce13385
    // (network shell is the product default), so clearing the key now yields
    // the flag-ON path and this test would assert the opposite of its name.
    localStorage.setItem('ff_shell_command_rail', 'false')
    render(<SectionContent {...baseProps} />)
    expect(screen.queryByTestId('sidebar-type-dot')).not.toBeInTheDocument()
  })

  it('replaces the type icon with a colored node dot when the command-rail flag is on', () => {
    localStorage.setItem('ff_shell_command_rail', 'true')
    render(<SectionContent {...baseProps} />)
    const dot = screen.getByTestId('sidebar-type-dot')
    expect(dot).toBeInTheDocument()
    // 7px round dot painted in the type's color.
    expect(dot).toHaveStyle({ width: '7px', height: '7px', borderRadius: '50%' })
  })
})

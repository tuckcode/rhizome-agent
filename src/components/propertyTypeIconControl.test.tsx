import type { ReactElement } from 'react'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render as rtlRender, screen, waitFor, within } from '@testing-library/react'
import { DynamicPropertiesPanel } from './DynamicPropertiesPanel'
import type { VaultEntry } from '../types'
import { initDisplayModeOverrides } from '../utils/propertyTypes'
import { bindVaultConfigStore, resetVaultConfigStore } from '../utils/vaultConfigStore'
import { TooltipProvider } from '@/components/ui/tooltip'

beforeAll(() => {
  global.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} }
  Element.prototype.scrollIntoView = vi.fn()
  Element.prototype.hasPointerCapture = () => false
  Element.prototype.setPointerCapture = vi.fn()
  Element.prototype.releasePointerCapture = vi.fn()
  if (!window.getComputedStyle) window.getComputedStyle = vi.fn().mockReturnValue({}) as never
})

const makeEntry = (overrides: Partial<VaultEntry> = {}): VaultEntry => ({
  path: '/vault/note/test.md',
  filename: 'test.md',
  title: 'Test Note',
  isA: 'Note',
  aliases: [],
  belongsTo: [],
  relatedTo: [],
  status: 'Active',
  owner: null,
  cadence: null,
  archived: false,
  modifiedAt: 1700000000,
  createdAt: 1700000000,
  fileSize: 100,
  snippet: '',
  wordCount: 0,
  relationships: {},
  icon: null,
  color: null,
  order: null,
  template: null,
  sort: null,
  outgoingLinks: [],
  ...overrides,
})

function render(ui: ReactElement) {
  return rtlRender(ui, { wrapper: TooltipProvider })
}

describe('property type icon control', () => {
  beforeEach(() => {
    resetVaultConfigStore()
    bindVaultConfigStore(
      { zoom: null, view_mode: null, editor_mode: null, tag_colors: null, status_colors: null, property_display_modes: null },
      vi.fn(),
    )
    initDisplayModeOverrides({})
  })

  it('renders the visible type icon trigger before the property label text', () => {
    render(
      <DynamicPropertiesPanel
        entry={makeEntry()}
        frontmatter={{ cadence: 'Weekly' }}
        onUpdateProperty={vi.fn()}
      />
    )

    const row = screen.getByTestId('editable-property')
    const trigger = screen.getByTestId('display-mode-trigger')
    const label = screen.getByText('Cadence').parentElement

    expect(row).toContainElement(trigger)
    expect(label?.firstElementChild).toContainElement(trigger)
    expect(screen.getByTestId('display-mode-icon-text')).toBeInTheDocument()
  })

  it('opens the existing picker from the icon trigger and updates the icon after selection', async () => {
    render(
      <DynamicPropertiesPanel
        entry={makeEntry()}
        frontmatter={{ cadence: 'Weekly' }}
        onUpdateProperty={vi.fn()}
      />
    )

    fireEvent.click(screen.getByTestId('display-mode-trigger'))
    fireEvent.click(screen.getByTestId('display-mode-option-status'))

    await waitFor(() => {
      expect(screen.getByTestId('display-mode-icon-status')).toBeInTheDocument()
    })
  })

  it('does not start value editing when Enter is pressed on the type trigger', () => {
    render(
      <DynamicPropertiesPanel
        entry={makeEntry()}
        frontmatter={{ cadence: 'Weekly' }}
        onUpdateProperty={vi.fn()}
      />
    )

    const trigger = screen.getByTestId('display-mode-trigger')
    trigger.focus()
    fireEvent.keyDown(trigger, { key: 'Enter' })

    expect(screen.queryByDisplayValue('Weekly')).not.toBeInTheDocument()
  })

  it('shows the relationship icon for relationship-like property rows', () => {
    render(
      <DynamicPropertiesPanel
        entry={makeEntry()}
        frontmatter={{ belongs_to: 'Project Alpha' }}
        onUpdateProperty={vi.fn()}
      />
    )

    const row = screen.getByTestId('editable-property')
    expect(within(row).getByTestId('display-mode-icon-relationship')).toBeInTheDocument()
  })
})

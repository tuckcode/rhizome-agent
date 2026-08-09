import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { SidebarProjectsNavigation } from './SidebarProjectsNavigation'
import type { VaultEntry, SidebarSelection } from '../types'

function makeEntry(overrides: Partial<VaultEntry> = {}): VaultEntry {
  return {
    path: overrides.path ?? `${overrides.title ?? 'note'}.md`,
    filename: overrides.filename ?? `${overrides.title ?? 'note'}.md`,
    title: overrides.title ?? 'Note',
    isA: overrides.isA ?? null,
    aliases: [],
    belongsTo: [],
    relatedTo: [],
    status: null,
    archived: overrides.archived ?? false,
    modifiedAt: null,
    createdAt: null,
    fileSize: 0,
    snippet: '',
    wordCount: 0,
    relationships: {},
    icon: null,
    color: null,
    order: null,
    sidebarLabel: null,
    template: null,
    sort: null,
    view: null,
    visible: true,
    organized: overrides.organized ?? true,
    favorite: false,
    favoriteIndex: null,
    listPropertiesDisplay: [],
    outgoingLinks: [],
    properties: overrides.properties ?? {},
    hasH1: false,
    fileKind: overrides.fileKind ?? 'markdown',
    ...overrides,
  }
}

const noSelection: SidebarSelection = { kind: 'filter', filter: 'all' }

describe('SidebarProjectsNavigation', () => {
  it('renders nothing when there are no entries', () => {
    const { container } = render(
      <SidebarProjectsNavigation entries={[]} selection={noSelection} onSelect={vi.fn()} />
    )
    expect(container).toBeEmptyDOMElement()
  })

  it('renders a project header and, when expanded, its pages', () => {
    const entries = [makeEntry({ title: 'Cargo Architecture', properties: { project: 'rhizome' } })]
    render(<SidebarProjectsNavigation entries={entries} selection={noSelection} onSelect={vi.fn()} />)

    expect(screen.getByTestId('project-node:rhizome')).toBeInTheDocument()
    // Collapsed by default (no auto-expand without a matching selection).
    expect(screen.queryByText('Cargo Architecture')).not.toBeInTheDocument()

    fireEvent.click(screen.getByText('rhizome'))
    expect(screen.getByText('Cargo Architecture')).toBeInTheDocument()
  })

  it('never renders bucket entries nested under a project', () => {
    const entries = [
      makeEntry({ title: 'Project Page', properties: { project: 'rhizome' } }),
      makeEntry({ title: 'Orphan Page', properties: {} }),
    ]
    render(<SidebarProjectsNavigation entries={entries} selection={noSelection} onSelect={vi.fn()} />)

    fireEvent.click(screen.getByText('rhizome'))
    expect(screen.getByText('Project Page')).toBeInTheDocument()
    expect(screen.queryByText('Orphan Page')).not.toBeInTheDocument()

    fireEvent.click(screen.getByText('UNASSIGNED'))
    expect(screen.getByText('Orphan Page')).toBeInTheDocument()
    expect(screen.getByTestId('project-node:rhizome')).not.toContainElement(
      screen.getByText('Orphan Page')
    )
  })

  it('fires onSelect with an entity selection when a page row is clicked', () => {
    const onSelect = vi.fn()
    const entry = makeEntry({ title: 'Cargo Architecture', properties: { project: 'rhizome' } })
    render(
      <SidebarProjectsNavigation entries={[entry]} selection={noSelection} onSelect={onSelect} />
    )

    fireEvent.click(screen.getByText('rhizome'))
    fireEvent.click(screen.getByText('Cargo Architecture'))
    expect(onSelect).toHaveBeenCalledWith({ kind: 'entity', entry })
  })

  it('auto-expands the project containing the currently selected entry', () => {
    const entry = makeEntry({ title: 'Cargo Architecture', properties: { project: 'rhizome' } })
    render(
      <SidebarProjectsNavigation
        entries={[entry]}
        selection={{ kind: 'entity', entry }}
        onSelect={vi.fn()}
      />
    )
    expect(screen.getByText('Cargo Architecture')).toBeInTheDocument()
  })
})

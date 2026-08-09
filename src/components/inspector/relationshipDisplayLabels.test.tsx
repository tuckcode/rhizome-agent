import { fireEvent, render as rtlRender, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { DynamicRelationshipsPanel } from './RelationshipsPanel'
import { ReferencedByPanel, type ReferencedByItem } from './ReferencedByPanel'
import { TooltipProvider } from '../ui/tooltip'
import type { VaultEntry } from '../../types'

const render = (ui: Parameters<typeof rtlRender>[0]) => rtlRender(ui, { wrapper: TooltipProvider })

const makeEntry = (overrides: Partial<VaultEntry> = {}): VaultEntry => ({
  path: '/vault/note/test.md',
  filename: 'test.md',
  title: 'Test Note',
  isA: 'Note',
  aliases: [],
  belongsTo: [],
  relatedTo: [],
  status: null,
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
  sidebarLabel: null,
  template: null,
  sort: null,
  view: null,
  visible: null,
  properties: {},
  organized: false,
  favorite: false,
  favoriteIndex: null,
  listPropertiesDisplay: [],
  hasH1: true,
  outgoingLinks: [],
  ...overrides,
})

describe('relationship display labels', () => {
  const onNavigate = vi.fn()

  it('adds suggested relationships with snake_case keys while showing humanized labels', () => {
    const onAddProperty = vi.fn()
    render(
      <DynamicRelationshipsPanel
        frontmatter={{}}
        entries={[makeEntry({ path: '/vault/project-alpha.md', filename: 'project-alpha.md', title: 'Project Alpha', isA: 'Project' })]}
        typeEntryMap={{}}
        onNavigate={onNavigate}
        onAddProperty={onAddProperty}
      />,
    )

    expect(screen.getByText('Belongs to')).toBeInTheDocument()
    expect(screen.queryByText('belongs_to')).not.toBeInTheDocument()

    const belongsToSlot = screen.getAllByTestId('suggested-relationship').find((slot) =>
      within(slot).queryByText('Belongs to'),
    )

    expect(belongsToSlot).toBeTruthy()
    fireEvent.click(within(belongsToSlot!).getByTestId('add-relation-ref'))
    const input = within(belongsToSlot!).getByTestId('add-relation-ref-input')
    fireEvent.change(input, { target: { value: 'Project Alpha' } })
    fireEvent.keyDown(input, { key: 'Enter' })

    expect(onAddProperty).toHaveBeenCalledWith('belongs_to', '[[project-alpha]]')
  })

  it('keeps snake_case and spaced relationship keys as separate groups', () => {
    render(
      <DynamicRelationshipsPanel
        frontmatter={{
          belongs_to: ['[[project-alpha]]'],
          'Belongs to': ['[[project-beta]]'],
        }}
        entries={[
          makeEntry({ path: '/vault/project-alpha.md', filename: 'project-alpha.md', title: 'Project Alpha', isA: 'Project' }),
          makeEntry({ path: '/vault/project-beta.md', filename: 'project-beta.md', title: 'Project Beta', isA: 'Project' }),
        ]}
        typeEntryMap={{}}
        onNavigate={onNavigate}
      />,
    )

    expect(screen.getAllByText('Belongs to')).toHaveLength(2)
    expect(screen.getByText('Project Alpha')).toBeInTheDocument()
    expect(screen.getByText('Project Beta')).toBeInTheDocument()
  })

  it('renders relationship rows as single-column stacks', () => {
    render(
      <DynamicRelationshipsPanel
        frontmatter={{ belongs_to: ['[[project-alpha]]'] }}
        entries={[makeEntry({ path: '/vault/project-alpha.md', filename: 'project-alpha.md', title: 'Project Alpha', isA: 'Project' })]}
        typeEntryMap={{}}
        onNavigate={onNavigate}
      />,
    )

    const relationshipRow = screen.getByTestId('relationship-section-label').parentElement
    expect(relationshipRow).toHaveClass('flex-col')
    expect(relationshipRow).toHaveStyle({ gridColumn: '1 / -1' })
  })

  it('humanizes snake_case keys in the referenced-by panel', async () => {
    const items: ReferencedByItem[] = [
      { entry: makeEntry({ path: '/vault/project-alpha.md', filename: 'project-alpha.md', title: 'Project Alpha', isA: 'Project' }), viaKey: 'belongs_to' },
    ]

    render(<ReferencedByPanel items={items} typeEntryMap={{}} onNavigate={onNavigate} />)

    expect(screen.getByText('Children')).toBeInTheDocument()
    fireEvent.focus(screen.getByText('Children'))
    expect(await screen.findByRole('tooltip')).toHaveTextContent('Derived inverse relationship, inverse of Belongs to.')
    expect(screen.queryByText(/← Belongs to/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/← belongs_to/i)).not.toBeInTheDocument()
  })

  it('dedupes canonical and legacy inverse keys into a single normalized inspector group', () => {
    const entry = makeEntry({ path: '/vault/project-alpha.md', filename: 'project-alpha.md', title: 'Project Alpha', isA: 'Project' })
    const items: ReferencedByItem[] = [
      { entry, viaKey: 'belongs_to' },
      { entry, viaKey: 'Belongs to' },
      { entry: makeEntry({ path: '/vault/topic-alpha.md', filename: 'topic-alpha.md', title: 'Topic Alpha', isA: 'Note' }), viaKey: 'related_to' },
    ]

    render(<ReferencedByPanel items={items} typeEntryMap={{}} onNavigate={onNavigate} />)

    expect(screen.getByText('Children')).toBeInTheDocument()
    expect(screen.getByText('Referenced by')).toBeInTheDocument()
    expect(screen.getAllByText('Project Alpha')).toHaveLength(1)
    expect(screen.queryByText(/← Belongs to/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/← belongs_to/i)).not.toBeInTheDocument()
  })

  it('does not show empty preferred inverse groups', () => {
    const items: ReferencedByItem[] = [
      { entry: makeEntry({ path: '/vault/project-alpha.md', filename: 'project-alpha.md', title: 'Project Alpha', isA: 'Project' }), viaKey: 'belongs_to' },
    ]

    render(<ReferencedByPanel items={items} typeEntryMap={{}} onNavigate={onNavigate} />)

    expect(screen.getByText('Children')).toBeInTheDocument()
    expect(screen.queryByText('Events')).not.toBeInTheDocument()
    expect(screen.queryByText('Referenced by')).not.toBeInTheDocument()
  })
})

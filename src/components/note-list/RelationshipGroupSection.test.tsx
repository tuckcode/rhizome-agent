import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { VaultEntry } from '../../types'
import { RelationshipGroupSection } from './RelationshipGroupSection'

const entry: VaultEntry = {
  path: '/vault/project-alpha.md',
  filename: 'project-alpha.md',
  title: 'Project Alpha',
  isA: 'Project',
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
}

describe('RelationshipGroupSection', () => {
  it('humanizes snake_case relationship group labels', () => {
    render(
      <RelationshipGroupSection
        group={{ label: 'belongs_to', entries: [entry] }}
        isCollapsed={false}
        sortPrefs={{}}
        onToggle={vi.fn()}
        handleSortChange={vi.fn()}
        renderItem={(item) => <div key={item.path}>{item.title}</div>}
      />,
    )

    expect(screen.getByText('Belongs to')).toBeInTheDocument()
    expect(screen.queryByText('belongs_to')).not.toBeInTheDocument()
  })
})

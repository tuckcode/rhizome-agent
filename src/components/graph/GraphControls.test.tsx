import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { GraphControls } from './GraphControls'

function renderControls(overrides: Partial<Parameters<typeof GraphControls>[0]> = {}) {
  const props = {
    query: '',
    onQueryChange: vi.fn(),
    types: ['Person', 'Project'],
    hiddenTypes: new Set<string>(),
    onToggleType: vi.fn(),
    ghostCount: 0,
    hideGhosts: false,
    onToggleGhosts: vi.fn(),
    colorForType: () => '#f00',
    visibleCount: 5,
    totalCount: 5,
    locale: 'en' as const,
    ...overrides,
  }
  render(<GraphControls {...props} />)
  return props
}

describe('GraphControls', () => {
  it('anchors bottom-right as a collapsed Find box so the canvas stays visible', () => {
    renderControls()
    const controls = screen.getByTestId('graph-controls')
    expect(controls).toHaveAttribute('data-expanded', 'false')
    expect(controls.className).toContain('bottom-3')
    expect(controls.className).toContain('right-3')
    expect(screen.queryByTestId('graph-type-filters')).not.toBeInTheDocument()
  })

  it('labels the compact field Find a note, not a large overlay', () => {
    renderControls()
    const field = screen.getByTestId('graph-search')
    expect(field).toHaveAccessibleName('Find a note…')
    expect(field).toHaveAttribute('placeholder', 'Find a note…')
    expect(field.className).toContain('text-[12px]')
    expect(field.className).toContain('h-7')
  })

  it('reports typing straight through', () => {
    const props = renderControls()
    fireEvent.change(screen.getByTestId('graph-search'), { target: { value: 'alpha' } })
    expect(props.onQueryChange).toHaveBeenCalledWith('alpha')
  })

  it('offers a clear button only when there is something to clear', () => {
    renderControls()
    expect(screen.queryByTestId('graph-search-clear')).not.toBeInTheDocument()
  })

  it('clears the query back to empty', () => {
    const props = renderControls({ query: 'alpha' })
    fireEvent.click(screen.getByTestId('graph-search-clear'))
    expect(props.onQueryChange).toHaveBeenCalledWith('')
  })

  it('expands to reveal type pills on demand', () => {
    const props = renderControls()
    fireEvent.click(screen.getByTestId('graph-controls-expand'))
    expect(screen.getByTestId('graph-controls')).toHaveAttribute('data-expanded', 'true')
    fireEvent.click(screen.getByTestId('graph-type-filter-Project'))
    expect(props.onToggleType).toHaveBeenCalledWith('Project')
  })

  it('auto-expands when a type filter is already hiding notes', () => {
    // A filter control that hides itself when used leaves no way to undo.
    renderControls({ hiddenTypes: new Set(['Project']) })
    const pill = screen.getByTestId('graph-type-filter-Project')
    expect(pill).toBeInTheDocument()
    expect(pill).toHaveAttribute('data-active', 'false')
    expect(pill).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByTestId('graph-type-filter-Person')).toHaveAttribute('data-active', 'true')
  })

  it('labels the untyped bucket instead of rendering a blank pill', () => {
    renderControls({ types: ['', 'Project'], defaultExpanded: true })
    expect(screen.getByTestId('graph-type-filter-untyped').textContent).toContain('Untyped')
  })

  it('offers a ghost toggle only when ghosts exist', () => {
    renderControls({ ghostCount: 0, defaultExpanded: true })
    expect(screen.queryByTestId('graph-type-filter-ghosts')).not.toBeInTheDocument()
  })

  it('toggles ghosts when there are some', () => {
    const props = renderControls({ ghostCount: 3, defaultExpanded: true })
    fireEvent.click(screen.getByTestId('graph-type-filter-ghosts'))
    expect(props.onToggleGhosts).toHaveBeenCalled()
  })

  it('stays quiet about counts until something is actually filtered', () => {
    renderControls({ visibleCount: 5, totalCount: 5 })
    expect(screen.queryByTestId('graph-filter-count')).not.toBeInTheDocument()
  })

  it('reports how much is hidden once a filter is on', () => {
    renderControls({ visibleCount: 2, totalCount: 5 })
    expect(screen.getByTestId('graph-filter-count').textContent).toContain('2')
    expect(screen.getByTestId('graph-filter-count').textContent).toContain('5')
  })

  it('hides the whole filter row when there is only one type and no ghosts', () => {
    // Filtering a single-type graph does nothing useful; the row would be
    // pure noise on a small vault.
    renderControls({ types: ['Note'], ghostCount: 0, defaultExpanded: true })
    expect(screen.queryByTestId('graph-type-filters')).not.toBeInTheDocument()
    expect(screen.queryByTestId('graph-controls-expand')).not.toBeInTheDocument()
  })
})

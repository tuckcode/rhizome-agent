import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NoteListHeader } from './NoteListHeader'

vi.mock('../../lib/telemetry', () => ({
  trackEvent: vi.fn(),
}))

const baseProps = {
  title: 'A note list title too long for its column',
  typeDocument: null,
  isEntityView: false,
  listSort: 'title' as const,
  listDirection: 'asc' as const,
  customProperties: [],
  searchVisible: false,
  search: '',
  isSearching: false,
  searchInputRef: { current: null },
  onCreateNote: vi.fn(),
  onOpenType: vi.fn(),
  onToggleSearch: vi.fn(),
  onSearchChange: vi.fn(),
  onSearchKeyDown: vi.fn(),
}

/** Make every element report a row that is too narrow for its content. */
function forceNarrowHeader() {
  const clientWidth = vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(200)
  const scrollWidth = vi.spyOn(HTMLElement.prototype, 'scrollWidth', 'get').mockReturnValue(320)
  return () => {
    clientWidth.mockRestore()
    scrollWidth.mockRestore()
  }
}

describe('NoteListHeader overflow menu', () => {
  let restore: () => void

  beforeEach(() => {
    restore = forceNarrowHeader()
  })

  afterEach(() => {
    restore()
  })

  it('lets a pointer pick a sort option from the collapsed header', async () => {
    const user = userEvent.setup()
    const onSortChange = vi.fn()
    render(<NoteListHeader {...baseProps} onSortChange={onSortChange} />)

    const overflow = await screen.findByTestId('note-list-header-overflow-trigger')
    await user.click(overflow)
    await user.click(await screen.findByTestId('sort-button-__list__'))
    await user.click(await screen.findByTestId('sort-option-modified'))

    await waitFor(() => expect(onSortChange).toHaveBeenCalledWith('__list__', 'modified', expect.anything()))
  })
})

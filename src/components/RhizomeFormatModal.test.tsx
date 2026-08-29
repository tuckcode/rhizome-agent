import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { RhizomeFormatModal } from './RhizomeFormatModal'
import { customToResearchMode } from '../lib/researchFormats'

const invoked = vi.hoisted(() => ({
  calls: [] as Array<{ cmd: string, args?: Record<string, unknown> }>,
  formats: [] as Array<{ id: string, title: string, instruction: string }>,
  saveFails: false,
}))

vi.mock('../mock-tauri', () => ({
  isTauri: () => false,
  mockInvoke: (cmd: string, args?: Record<string, unknown>) => {
    invoked.calls.push({ cmd, args })
    if (cmd === 'list_research_formats') return Promise.resolve(invoked.formats)
    if (cmd === 'save_research_format') {
      if (invoked.saveFails) return Promise.reject(new Error('nope'))
      const title = String(args?.title ?? '')
      invoked.formats = [
        ...invoked.formats,
        { id: title.toLowerCase().replace(/\s+/g, '-'), title, instruction: String(args?.instruction ?? '') },
      ]
      return Promise.resolve(invoked.formats)
    }
    return Promise.resolve(null)
  },
}))

const tracked = vi.hoisted(() => ({ counts: [] as number[] }))
vi.mock('../lib/productAnalytics', () => ({
  trackResearchFormatSaved: (total: number) => tracked.counts.push(total),
}))

function renderModal(props: Partial<React.ComponentProps<typeof RhizomeFormatModal>> = {}) {
  return render(
    <RhizomeFormatModal
      open
      onClose={() => {}}
      onSelect={() => {}}
      vaultPath="/vault"
      {...props}
    />,
  )
}

beforeEach(() => {
  invoked.calls = []
  invoked.formats = []
  invoked.saveFails = false
  tracked.counts = []
})

describe('RhizomeFormatModal built-in formats', () => {
  it('offers Book → Skill as a built-in research format', async () => {
    renderModal()

    expect(await screen.findByText('Book → Skill')).toBeInTheDocument()
    expect(screen.getByText('Agent skill')).toBeInTheDocument()
  })
})

describe('RhizomeFormatModal custom formats', () => {
  it('renders saved formats alongside the built-in ones', async () => {
    invoked.formats = [{ id: 'q3', title: 'Q3 Lens', instruction: 'Read it as a plan.' }]

    renderModal()

    // Twice on purpose: once in the list, once as the selected heading.
    await waitFor(() => expect(screen.getAllByText('Q3 Lens').length).toBeGreaterThan(0))
    // Built-ins still there — customs are added, not a replacement list.
    expect(screen.getAllByText('Architecture Map').length).toBeGreaterThan(0)
  })

  it('saves a format from the composer and reports the new count', async () => {
    renderModal()

    fireEvent.click(screen.getByTestId('research-format-add'))
    fireEvent.change(screen.getByTestId('research-format-title'), { target: { value: 'My Lens' } })
    fireEvent.change(screen.getByTestId('research-format-instruction'), {
      target: { value: 'Look at it sideways.' },
    })
    fireEvent.click(screen.getByTestId('research-format-save'))

    await waitFor(() => expect(tracked.counts).toEqual([1]))
    const save = invoked.calls.find(c => c.cmd === 'save_research_format')
    expect(save?.args).toMatchObject({
      vaultPath: '/vault',
      title: 'My Lens',
      instruction: 'Look at it sideways.',
    })
    // The composer closes and the saved format is now selectable.
    await waitFor(() => expect(screen.queryByTestId('research-format-composer')).toBeNull())
    expect(screen.getAllByText('My Lens').length).toBeGreaterThan(0)
  })

  it('refuses to save without both a name and an instruction', async () => {
    renderModal()

    fireEvent.click(screen.getByTestId('research-format-add'))
    fireEvent.change(screen.getByTestId('research-format-title'), { target: { value: 'Nameless' } })
    fireEvent.click(screen.getByTestId('research-format-save'))

    expect(await screen.findByRole('alert')).toBeInTheDocument()
    expect(invoked.calls.some(c => c.cmd === 'save_research_format')).toBe(false)
  })

  it('surfaces a save failure instead of closing the composer silently', async () => {
    invoked.saveFails = true
    renderModal()

    fireEvent.click(screen.getByTestId('research-format-add'))
    fireEvent.change(screen.getByTestId('research-format-title'), { target: { value: 'Doomed' } })
    fireEvent.change(screen.getByTestId('research-format-instruction'), {
      target: { value: 'Never lands.' },
    })
    fireEvent.click(screen.getByTestId('research-format-save'))

    expect(await screen.findByRole('alert')).toBeInTheDocument()
    expect(screen.getByTestId('research-format-composer')).toBeInTheDocument()
    expect(tracked.counts).toEqual([])
  })

  it('disables the add control when there is no vault to save into', () => {
    renderModal({ vaultPath: '' })

    expect(screen.getByTestId('research-format-add')).toBeDisabled()
  })
})

describe('customToResearchMode', () => {
  it('uses the instruction as the description, because that is what the agent is told', () => {
    const mode = customToResearchMode(
      { id: 'q3', title: 'Q3 Lens', instruction: 'Read it as a plan.' },
      'Custom',
    )

    expect(mode.description).toBe('Read it as a plan.')
    expect(mode.samplePeek.description).toBe('Read it as a plan.')
    expect(mode.categoryLabel).toBe('Custom')
  })
})

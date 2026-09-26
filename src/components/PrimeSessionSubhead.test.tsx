import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { APP_COMMAND_IDS, getAppCommandShortcutDisplay } from '../hooks/appCommandCatalog'
import { PrimeSessionSubhead } from './PrimeSessionSubhead'

/** Opens the status popover so its contents can be asserted on. */
function openStatus() {
  fireEvent.click(screen.getByTestId('prime-session-status'))
}

describe('PrimeSessionSubhead — title', () => {
  it('shows the conversation title as the strip’s leading text', () => {
    render(<PrimeSessionSubhead live sessionTitle="Fix the login bug" />)

    expect(screen.getByTestId('prime-session-title')).toHaveTextContent('Fix the login bug')
  })

  it('falls back to New chat when the session has no title yet', () => {
    render(<PrimeSessionSubhead live sessionTitle={null} />)

    expect(screen.getByTestId('prime-session-title')).toHaveTextContent('New chat')
  })

  it('falls back to New chat for a blank title', () => {
    render(<PrimeSessionSubhead live sessionTitle="   " />)

    expect(screen.getByTestId('prime-session-title')).toHaveTextContent('New chat')
  })
})

describe('PrimeSessionSubhead — status control', () => {
  it('stays quiet — dot only — when connected with nothing wrong', () => {
    render(<PrimeSessionSubhead live sessionId="019fe641-61fa-73e9-82ef-91fc90097aab" />)

    const status = screen.getByTestId('prime-session-status')
    expect(status).toHaveAccessibleName('Session status')
    expect(within(status).queryByText(/./)).not.toBeInTheDocument()
  })

  it('stays quiet — dot only — when idle with nothing wrong', () => {
    render(<PrimeSessionSubhead live={false} />)

    const status = screen.getByTestId('prime-session-status')
    expect(within(status).queryByText(/./)).not.toBeInTheDocument()
  })

  it('keeps a problem visible inline next to the dot, not hidden behind the popover', () => {
    render(<PrimeSessionSubhead live={false} problem={{ code: 'service_unreachable' }} />)

    const status = screen.getByTestId('prime-session-status')
    expect(status).toHaveTextContent(/prime-agent status/)
  })

  it('shows connection state, session id, vault path and uptime inside the popover', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-15T11:30:00.000Z'))
    render(
      <PrimeSessionSubhead
        live
        sessionId="019fe641-61fa-73e9-82ef-91fc90097aab"
        vaultPath="/Users/dtc/Documents/Laputa"
        startedAt="2026-08-15T09:00:00.000Z"
      />,
    )

    openStatus()

    expect(screen.getByTestId('prime-subhead-connection')).toHaveTextContent('Prime session live')
    expect(screen.getByTestId('prime-subhead-session')).toHaveTextContent('7aab')
    expect(screen.getByTestId('prime-subhead-vault')).toHaveTextContent('~/Documents/Laputa')
    expect(screen.getByTestId('prime-subhead-uptime')).toHaveTextContent('2h 30m')
    vi.useRealTimers()
  })

  it('never shows the absolute home path in the popover', () => {
    render(<PrimeSessionSubhead live vaultPath="/Users/dtc/Documents/Laputa" />)

    openStatus()

    expect(screen.queryByText('/Users/dtc/Documents/Laputa')).not.toBeInTheDocument()
  })

  it('omits popover segments it has no value for', () => {
    render(<PrimeSessionSubhead live vaultPath="/Users/dtc/vault" />)

    openStatus()

    expect(screen.queryByTestId('prime-subhead-session')).not.toBeInTheDocument()
    expect(screen.getByTestId('prime-subhead-vault')).toHaveTextContent('vault')
  })

  it('shows no uptime in the popover when the host is not live', () => {
    render(<PrimeSessionSubhead live={false} startedAt="2026-08-15T09:00:00.000Z" />)

    openStatus()

    expect(screen.queryByTestId('prime-subhead-uptime')).not.toBeInTheDocument()
  })

  it('omits uptime in the popover when the session start is unknown', () => {
    render(<PrimeSessionSubhead live sessionId="abcd-1234" />)

    openStatus()

    expect(screen.queryByTestId('prime-subhead-uptime')).not.toBeInTheDocument()
  })

  it('shows the live state rather than a stale problem once connected', () => {
    render(<PrimeSessionSubhead live problem={{ code: 'not_installed' }} />)

    openStatus()

    expect(screen.getByTestId('prime-subhead-connection')).toHaveTextContent('Prime session live')
    expect(screen.queryByText(/npm i -g/)).not.toBeInTheDocument()
  })

  it('names both versions when the service is too old', () => {
    render(
      <PrimeSessionSubhead
        live={false}
        problem={{ code: 'service_too_old', installedVersion: '0.6.4', requiredVersion: '0.7.1' }}
      />,
    )

    const status = screen.getByTestId('prime-session-status')
    expect(status).toHaveTextContent('0.6.4')
    expect(status).toHaveTextContent('0.7.1')
  })

  it('still names the required version when the installed one is unknown', () => {
    render(
      <PrimeSessionSubhead
        live={false}
        problem={{ code: 'service_too_old', requiredVersion: '0.7.1' }}
      />,
    )

    expect(screen.getByTestId('prime-session-status')).toHaveTextContent('0.7.1')
  })

  it('names the action when Prime is not installed', () => {
    render(<PrimeSessionSubhead live={false} problem={{ code: 'not_installed' }} />)

    expect(screen.getByTestId('prime-session-status')).toHaveTextContent(/npm i -g prime-agent/)
  })
})

describe('PrimeSessionSubhead — actions', () => {
  it('starts a new chat from the subhead when given a handler', () => {
    const onNewChat = vi.fn()
    render(<PrimeSessionSubhead live onNewChat={onNewChat} />)

    fireEvent.click(screen.getByRole('button', { name: 'New chat' }))
    expect(onNewChat).toHaveBeenCalledTimes(1)
  })

  it('opens the command palette from the title row', () => {
    const onOpenCommandPalette = vi.fn()
    render(<PrimeSessionSubhead live onOpenCommandPalette={onOpenCommandPalette} />)

    fireEvent.click(screen.getByTestId('open-command-palette'))
    expect(onOpenCommandPalette).toHaveBeenCalledTimes(1)
    expect(screen.getByTestId('open-command-palette')).toHaveTextContent('Command Palette')
    expect(screen.getByTestId('open-command-palette')).toHaveTextContent(
      getAppCommandShortcutDisplay(APP_COMMAND_IDS.viewCommandPalette) ?? '',
    )
  })

  it('opens this session footprint from the in-session button', () => {
    const onOpenFootprint = vi.fn()
    render(<PrimeSessionSubhead live onOpenFootprint={onOpenFootprint} />)

    fireEvent.click(screen.getByTestId('prime-session-footprint'))
    expect(onOpenFootprint).toHaveBeenCalledTimes(1)
    const chip = screen.getByTestId('prime-session-footprint')
    expect(chip).toHaveAccessibleName('Mycelium')
    expect(chip).toHaveAttribute('title', 'Mycelium')
  })

  /**
   * This strip is the window's title bar. Selectable text wins a drag against
   * the drag region, so the pointer sweeps a selection and the window never
   * moves — leaving a maximised window with no obvious place to grab it.
   * Reported from use, 2026-09-05.
   */
  it('does not let a drag select its text instead of moving the window', () => {
    const { container } = render(<PrimeSessionSubhead live sessionId="abc123" vaultPath="/vault" />)

    const strip = container.firstElementChild
    expect(strip).toHaveClass('select-none')
  })
})

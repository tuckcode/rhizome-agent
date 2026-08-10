import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AiAgentsStatus } from '../lib/aiAgents'
import { AiAgentsOnboardingPrompt } from './AiAgentsOnboardingPrompt'

const openExternalUrl = vi.fn()
const dragRegionMouseDown = vi.fn()

function emptyStatuses(): AiAgentsStatus {
  return {
    prime: { status: 'missing', version: null },
    claude_code: { status: 'missing', version: null },
    codex: { status: 'missing', version: null },
    opencode: { status: 'missing', version: null },
    pi: { status: 'missing', version: null },
    antigravity: { status: 'missing', version: null },
    kiro: { status: 'missing', version: null },
    hermes: { status: 'missing', version: null },
  }
}

const installLinkTargets = [
  ['ai-agents-onboarding-install-prime', 'https://www.npmjs.com/package/prime-agent'],
] as const

vi.mock('../utils/url', () => ({
  openExternalUrl: (...args: unknown[]) => openExternalUrl(...args),
}))
vi.mock('../hooks/useDragRegion', () => ({
  useDragRegion: () => ({ onMouseDown: dragRegionMouseDown }),
}))

function renderPrompt(statuses: Partial<AiAgentsStatus> = {}) {
  return render(
    <AiAgentsOnboardingPrompt
      statuses={{ ...emptyStatuses(), ...statuses }}
      onContinue={vi.fn()}
    />,
  )
}

function openSupportedAgentsMenu() {
  fireEvent.pointerDown(screen.getByTestId('ai-agents-onboarding-supported-menu'))
}

describe('AiAgentsOnboardingPrompt', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('shows the ready state when Prime is installed', () => {
    renderPrompt({
      prime: { status: 'installed', version: '1.2.3' },
      // Legacy backends installed must not appear in product onboarding.
      claude_code: { status: 'installed', version: '1.0.20' },
      hermes: { status: 'installed', version: '0.20.0' },
    })

    expect(screen.getByText('Prime is ready')).toBeInTheDocument()
    expect(screen.getByText('Prime on this machine')).toBeInTheDocument()
    expect(screen.getByText('Prime Agent')).toBeInTheDocument()
    expect(screen.queryByText('Claude Code')).not.toBeInTheDocument()
    expect(screen.queryByText('Hermes Agent')).not.toBeInTheDocument()
    expect(screen.getByTestId('ai-agents-onboarding-continue')).toHaveTextContent('Continue')
  })

  it('shows the missing state when Prime is not installed', () => {
    renderPrompt()

    expect(screen.getByText('Prime Agent is optional for first open')).toBeInTheDocument()
    expect(screen.queryByTestId('ai-agents-onboarding-empty')).not.toBeInTheDocument()
    expect(screen.queryByTestId('ai-agents-onboarding-detected-list')).not.toBeInTheDocument()
    expect(screen.getByText('Models & providers')).toBeInTheDocument()
    expect(screen.queryByTestId('ai-agents-onboarding-install-claude_code')).not.toBeInTheDocument()
    expect(screen.getByTestId('ai-agents-onboarding-continue')).toHaveTextContent('Set up later')
  })

  it('tells the user an installed agent must be launched once to authenticate', () => {
    renderPrompt()
    const authPanel = screen.getByTestId('ai-agents-onboarding-auth')
    expect(authPanel).toBeInTheDocument()
    expect(authPanel.textContent).toMatch(/log in|authenticate/i)
  })

  it('shows the auth reminder even once Prime is installed', () => {
    renderPrompt({ prime: { status: 'installed', version: '1.2.3' } })
    expect(screen.getByTestId('ai-agents-onboarding-auth')).toBeInTheDocument()
  })

  it('opens the Prime install link from the supported agents menu', () => {
    renderPrompt()

    installLinkTargets.forEach(([testId]) => {
      openSupportedAgentsMenu()
      fireEvent.click(screen.getByTestId(testId))
    })

    installLinkTargets.forEach(([, url]) => {
      expect(openExternalUrl).toHaveBeenCalledWith(url)
    })
  })

  it('keeps the long setup card bounded with a scrollable content area', () => {
    renderPrompt()

    expect(screen.getByTestId('ai-agents-onboarding-card')).toHaveClass(
      'max-h-[calc(100dvh-2rem)]',
      'overflow-hidden',
    )
    expect(screen.getByTestId('ai-agents-onboarding-scroll')).toHaveClass(
      'min-h-0',
      'overflow-y-auto',
      'overscroll-contain',
    )
    expect(screen.getByTestId('ai-agents-onboarding-continue')).toHaveTextContent('Set up later')
  })

  it('uses the surrounding surface as a drag region and excludes the card', () => {
    renderPrompt({
      prime: { status: 'installed', version: '1.2.3' },
    })

    const screenContainer = screen.getByTestId('ai-agents-onboarding-screen')
    fireEvent.mouseDown(screenContainer)

    expect(dragRegionMouseDown).toHaveBeenCalledOnce()
    expect(screenContainer.querySelector('[data-no-drag]')).not.toBeNull()
  })
})

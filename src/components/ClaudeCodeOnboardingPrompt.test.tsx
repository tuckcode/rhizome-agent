import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ClaudeCodeOnboardingPrompt } from './ClaudeCodeOnboardingPrompt'

const openExternalUrl = vi.fn()

vi.mock('../utils/url', () => ({
  openExternalUrl: (...args: unknown[]) => openExternalUrl(...args),
}))

describe('ClaudeCodeOnboardingPrompt', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('shows the detected state with a continue action', () => {
    render(<ClaudeCodeOnboardingPrompt status="installed" onContinue={vi.fn()} />)

    expect(screen.getByText('Claude Code detected')).toBeInTheDocument()
    expect(screen.getByTestId('claude-onboarding-continue')).toHaveTextContent('Continue')
    expect(screen.queryByTestId('claude-onboarding-install')).not.toBeInTheDocument()
  })

  it('shows the install path when Claude Code is missing', () => {
    render(<ClaudeCodeOnboardingPrompt status="missing" onContinue={vi.fn()} />)

    expect(screen.getByText('Claude Code not detected')).toBeInTheDocument()
    expect(screen.getByText('Install Claude Code to enable AI-powered note management.')).toBeInTheDocument()
    expect(screen.getByTestId('claude-onboarding-install')).toBeInTheDocument()
    expect(screen.getByTestId('claude-onboarding-continue')).toHaveTextContent('Continue without it')
  })

  it('opens the Claude Code install page', () => {
    render(<ClaudeCodeOnboardingPrompt status="missing" onContinue={vi.fn()} />)

    fireEvent.click(screen.getByTestId('claude-onboarding-install'))

    expect(openExternalUrl).toHaveBeenCalledWith('https://docs.anthropic.com/en/docs/claude-code')
  })

  it('calls onContinue from the detected state', () => {
    const onContinue = vi.fn()
    render(<ClaudeCodeOnboardingPrompt status="installed" onContinue={onContinue} />)

    fireEvent.click(screen.getByTestId('claude-onboarding-continue'))

    expect(onContinue).toHaveBeenCalledOnce()
  })

  it('disables continue while detection is still running', () => {
    render(<ClaudeCodeOnboardingPrompt status="checking" onContinue={vi.fn()} />)

    expect(screen.getByText('Checking for Claude Code')).toBeInTheDocument()
    expect(screen.getByTestId('claude-onboarding-continue')).toBeDisabled()
  })
})

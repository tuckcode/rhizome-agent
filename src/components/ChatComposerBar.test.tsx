import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ChatComposerBar } from './ChatComposerBar'
import { trackComposerPillOpened } from '../lib/productAnalytics'

vi.mock('../lib/productAnalytics', () => ({ trackComposerPillOpened: vi.fn() }))

/**
 * Native audit 2026-09-26: context, provider, model, reasoning, agents,
 * skills, Goal, Schedule, readiness and key hints stacked around the input
 * took about a quarter of a small window. Routine settings now share one
 * compact row under the input; context details open on request; only
 * active work gets inline status.
 */

// Radix opens on pointerdown, not click.
function open(testId: string) {
  fireEvent.pointerDown(
    screen.getByTestId(testId),
    new PointerEvent('pointerdown', { bubbles: true, button: 0 }),
  )
}

function openSkillsRow() {
  open('composer-tools-menu')
  const row = screen.getByTestId('composer-skills-pill')
  row.focus()
  fireEvent.keyDown(row, { key: 'ArrowRight' })
}

function renderBar(props: Partial<Parameters<typeof ChatComposerBar>[0]> = {}) {
  const onOpenGoal = vi.fn()
  const onOpenSchedule = vi.fn()
  render(
    <ChatComposerBar
      deck={<span data-testid="deck">model</span>}
      skillsLabel="rhizome-vault"
      onOpenGoal={onOpenGoal}
      onOpenSchedule={onOpenSchedule}
      stats={{}}
      {...props}
    />,
  )
  return { onOpenGoal, onOpenSchedule }
}

describe('ChatComposerBar', () => {
  it('is one row holding the deck and a Tools menu', () => {
    renderBar()
    const bar = screen.getByTestId('chat-composer-bar')
    expect(bar).toContainElement(screen.getByTestId('deck'))
    expect(bar).toContainElement(screen.getByTestId('composer-tools-menu'))
    expect(screen.queryByTestId('prime-goal-trigger')).not.toBeInTheDocument()
  })

  it('puts Goal, Schedule and the skill inside Tools', () => {
    const { onOpenGoal } = renderBar()
    open('composer-tools-menu')
    expect(screen.getByTestId('composer-skills-pill')).toHaveTextContent('rhizome-vault')
    expect(screen.getByTestId('prime-schedule-trigger')).toBeInTheDocument()
    expect(trackComposerPillOpened).toHaveBeenCalledWith('tools')
    fireEvent.click(screen.getByTestId('prime-goal-trigger'))
    expect(onOpenGoal).toHaveBeenCalledTimes(1)
  })

  it('lists skill names and keeps each description on hover', async () => {
    const onPickSkill = vi.fn()
    renderBar({
      skills: [{ slash: 'rhizome-vault', description: 'Vault tools' }],
      onPickSkill,
    })
    openSkillsRow()
    const row = screen.getByTestId('composer-skill-rhizome-vault')
    expect(row).toHaveTextContent('/rhizome-vault')
    expect(row).not.toHaveTextContent('Vault tools')
    expect(screen.getByTestId('composer-skills-menu')).toHaveStyle({ maxHeight: '22rem' })
    fireEvent.focus(row)
    expect(await screen.findByTestId('composer-skill-tip-rhizome-vault')).toHaveTextContent('Vault tools')
    fireEvent.click(row)
    expect(onPickSkill).toHaveBeenCalledWith('rhizome-vault')
  })

  it('says when this session reported no skills', () => {
    renderBar({ skills: [] })
    openSkillsRow()
    expect(screen.getByTestId('composer-skills-empty')).toHaveTextContent('No skills reported for this session')
  })

  it('says nothing about status while idle', () => {
    renderBar()
    expect(screen.queryByTestId('chat-composer-foot')).not.toBeInTheDocument()
    expect(screen.getByTestId('chat-composer-bar')).not.toHaveTextContent('Idle')
  })

  it('names the running tool while a turn works', () => {
    renderBar({ working: true, lastToolName: 'get_note' })
    expect(screen.getByTestId('chat-composer-foot')).toHaveTextContent('Working · last tool get_note')
  })

  it('hides the context control until Prime reports usage', () => {
    renderBar()
    expect(screen.queryByTestId('prime-context-button')).not.toBeInTheDocument()
  })

  it('shows context as a percent and reveals the meter on request', () => {
    renderBar({ stats: { contextTokens: 2_000, contextWindow: 200_000 } })
    const button = screen.getByTestId('prime-context-button')
    expect(button).toHaveTextContent('1%')
    expect(button).toHaveAttribute('data-pressure', 'ok')
    expect(screen.queryByTestId('prime-context-meter')).not.toBeInTheDocument()
    // Radix Popover opens on click.
    fireEvent.click(button)
    expect(screen.getByTestId('prime-context-meter')).toHaveTextContent('2.0k / 200.0k')
  })

  it('flags context pressure on the compact control', () => {
    renderBar({ stats: { contextTokens: 190_000, contextWindow: 200_000 } })
    expect(screen.getByTestId('prime-context-button')).toHaveAttribute('data-pressure', 'high')
  })
})

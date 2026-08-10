import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { ResearchPanel } from './ResearchPanel'
import { createAiAgentAvailability, createCheckingAiAgentsStatus, createMissingAiAgentsStatus, type AiAgentsStatus } from '../lib/aiAgents'
import { agentTargetId, modelTargetId, type AiModelProvider } from '../lib/aiTargets'
import type { Settings } from '../types'

const mockOpenExternalUrl = vi.fn()
vi.mock('../utils/url', () => ({
  openExternalUrl: (...args: unknown[]) => mockOpenExternalUrl(...args),
}))

function statusWithPrime(overrides: Partial<AiAgentsStatus['prime']>): AiAgentsStatus {
  return { ...createMissingAiAgentsStatus(), prime: { ...createAiAgentAvailability('missing'), ...overrides } }
}

const BASE_SETTINGS: Settings = {
  auto_pull_interval_minutes: null,
  telemetry_consent: null,
  crash_reporting_enabled: null,
  analytics_enabled: null,
  anonymous_id: null,
  release_channel: null,
}

const anthropicProvider: AiModelProvider = {
  id: 'anthropic-test',
  name: 'My Anthropic',
  kind: 'anthropic',
  models: [
    {
      id: 'claude-sonnet',
      display_name: 'Claude Sonnet',
      capabilities: { streaming: true, tools: true, vision: true, json_mode: true, reasoning: false },
    },
  ],
}

const mockInvokeFn = vi.fn()
const mockDialogOpen = vi.fn()
const mockTrackEvent = vi.fn()

// Incrementing job IDs — a constant stub would make the panel's UUID and the
// hook's UUID accidentally identical, masking id-mismatch bugs (bug_001:
// Cancel silently targeted a job the backend never ran). Counter resets per
// test so ids stay deterministic within each test.
let uuidCounter = 0
vi.stubGlobal('crypto', {
  randomUUID: () => `test-job-id-${String(uuidCounter++).padStart(4, '0')}`,
})

vi.mock('@tauri-apps/api/core', () => ({
  invoke: (...args: unknown[]) => mockInvokeFn(...args),
}))

vi.mock('@tauri-apps/plugin-dialog', () => ({
  open: (...args: unknown[]) => mockDialogOpen(...args),
}))

// Track completion handlers for rhizome jobs so tests can fire them.
let progressHandler: ((event: { payload: { line: string } }) => void) | null = null
let jobCompleteHandler: ((event: { payload: { output: string } }) => void) | null = null
vi.mock('@tauri-apps/api/event', () => ({
  listen: (name: string, handler: (event: { payload: { line: string } }) => void) => {
    if (name === 'rhizome-progress') progressHandler = handler
    if (name.startsWith('rhizome-job-complete-')) jobCompleteHandler = handler as (event: { payload: { output: string } }) => void
    return Promise.resolve(() => { /* cleanup no-op */ })
  },
}))

vi.mock('../lib/telemetry', () => ({
  trackEvent: (...args: unknown[]) => mockTrackEvent(...args),
}))

const libraryItems = [
  {
    id: 'my-repo.md',
    path: 'sources/repos/my-repo.md',
    title: 'my repo',
    description: 'A wiki',
    type: 'wiki',
    tag: 'Repo Wiki',
    date: 1700000000,
  },
  {
    id: 'other-doc.md',
    path: 'sources/documents/other-doc.md',
    title: 'other doc',
    description: 'A document',
    type: 'source',
    tag: 'Document',
    date: 1600000000,
  },
]

const historyEvents = [{ timestamp: '2026-07-01T12:00:00', type: 'import', source: 'x' }]

describe('ResearchPanel', () => {
  const onClose = vi.fn()
  const onOpenNote = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    uuidCounter = 0
    progressHandler = null
    jobCompleteHandler = null
    mockInvokeFn.mockImplementation((command: string, payload?: Record<string, unknown>) => {
      if (command === 'start_rhizome_job') {
        // Fire the completion event to simulate a successful job.
        setTimeout(() => {
          jobCompleteHandler?.({ payload: { output: '{}' } } as never)
        }, 0)
        return Promise.resolve(null)
      }
      if (command === 'rhizome_read_events' || (payload as { name?: string })?.name === 'rhizome_read_events') {
        return Promise.resolve(JSON.stringify(historyEvents))
      }
      if ((payload as { name?: string })?.name === 'rhizome_scan_library') {
        return Promise.resolve(JSON.stringify(libraryItems))
      }
      return Promise.resolve('{}')
    })
  })

  it('opens the note at its vault-relative path and closes the panel when a library item is clicked', async () => {
    render(
      <ResearchPanel open={true} onClose={onClose} vaultPath="/vault" onOpenNote={onOpenNote} />
    )

    fireEvent.mouseDown(screen.getByRole('tab', { name: /library/i }), { button: 0, ctrlKey: false })

    const item = await screen.findByText('my repo')
    fireEvent.click(item)

    expect(onOpenNote).toHaveBeenCalledWith('sources/repos/my-repo.md')
    expect(onClose).toHaveBeenCalled()
  })

  it('keeps every tab enabled without the Python CLI toolkit — no availability check is made', async () => {
    render(
      <ResearchPanel open={true} onClose={onClose} vaultPath="/vault" onOpenNote={onOpenNote} />
    )

    fireEvent.change(screen.getByPlaceholderText(/github url, owner\/repo, or local path/i), {
      target: { value: 'owner/repo' },
    })
    expect(screen.getByRole('button', { name: /^generate/i })).toBeEnabled()
    expect(mockInvokeFn).not.toHaveBeenCalledWith('rhizome_check_availability')

    fireEvent.mouseDown(screen.getByRole('tab', { name: /import/i }), { button: 0, ctrlKey: false })
    fireEvent.change(screen.getByPlaceholderText(/pdf path, web url, youtube url, or text file/i), {
      target: { value: 'https://example.com/doc' },
    })
    expect(screen.getByRole('button', { name: /^import/i })).toBeEnabled()

    fireEvent.mouseDown(screen.getByRole('tab', { name: /distill/i }), { button: 0, ctrlKey: false })
    fireEvent.change(screen.getByPlaceholderText(/paste research output/i), {
      target: { value: 'some text to distill' },
    })
    expect(screen.getByRole('button', { name: /^distill/i })).toBeEnabled()

    fireEvent.mouseDown(screen.getByRole('tab', { name: /ask/i }), { button: 0, ctrlKey: false })
    fireEvent.change(screen.getByPlaceholderText(/what do you want to understand/i), {
      target: { value: 'what is X?' },
    })
    expect(screen.getByRole('button', { name: /^ask$/i })).toBeEnabled()
  })

  it('blocks Distill and shows install guidance when the resolved agent is not installed', async () => {
    render(
      <ResearchPanel
        open={true}
        onClose={onClose}
        vaultPath="/vault"
        onOpenNote={onOpenNote}
        aiAgentsStatus={statusWithPrime({ status: 'missing' })}
      />
    )

    fireEvent.mouseDown(screen.getByRole('tab', { name: /distill/i }), { button: 0, ctrlKey: false })
    fireEvent.change(screen.getByPlaceholderText(/paste research output/i), {
      target: { value: 'some text to distill' },
    })

    expect(screen.getByTestId('research-preflight-blocked')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^distill/i })).toBeDisabled()

    fireEvent.click(screen.getByRole('button', { name: /install/i }))
    expect(mockOpenExternalUrl).toHaveBeenCalledWith(expect.stringContaining('prime-agent'))
    expect(mockInvokeFn).not.toHaveBeenCalledWith('call_rhizome_tool', expect.objectContaining({ name: 'rhizome_distill' }))
  })

  it('disables write actions without an alert while the agent probe is still checking', async () => {
    render(
      <ResearchPanel
        open={true}
        onClose={onClose}
        vaultPath="/vault"
        onOpenNote={onOpenNote}
        aiAgentsStatus={createCheckingAiAgentsStatus()}
      />
    )

    fireEvent.change(screen.getByPlaceholderText(/github url, owner\/repo, or local path/i), {
      target: { value: 'owner/repo' },
    })

    expect(screen.getByRole('button', { name: /^generate/i })).toBeDisabled()
    expect(screen.getByTestId('research-preflight-checking')).toBeInTheDocument()
    expect(screen.queryByTestId('research-preflight-blocked')).not.toBeInTheDocument()
  })

  it('allows write actions once the resolved agent is confirmed installed', async () => {
    render(
      <ResearchPanel
        open={true}
        onClose={onClose}
        vaultPath="/vault"
        onOpenNote={onOpenNote}
        aiAgentsStatus={statusWithPrime({ status: 'installed', version: '1.0.0' })}
      />
    )

    fireEvent.change(screen.getByPlaceholderText(/github url, owner\/repo, or local path/i), {
      target: { value: 'owner/repo' },
    })

    expect(screen.getByRole('button', { name: /^generate/i })).toBeEnabled()
    expect(screen.queryByTestId('research-preflight-blocked')).not.toBeInTheDocument()
  })

  it('sends the selected depth when generating a repo wiki', async () => {
    render(
      <ResearchPanel open={true} onClose={onClose} vaultPath="/vault" onOpenNote={onOpenNote} />
    )

    fireEvent.change(screen.getByPlaceholderText(/github url, owner\/repo, or local path/i), {
      target: { value: 'owner/repo' },
    })
    fireEvent.click(screen.getByRole('button', { name: /^generate/i }))

    await waitFor(() => {
      expect(mockInvokeFn).toHaveBeenCalledWith('start_rhizome_job', expect.objectContaining({
        name: 'rhizome_repo_research',
        args: expect.objectContaining({ depth: 'regular' }),
      }))
    })
  })

  it('cancel button cancels the job the backend is actually running (bug_001 regression)', async () => {
    // No auto-completion here — the job must stay running so Cancel is
    // clickable. Capture the jobId each command receives.
    let startedJobId: string | null = null
    let cancelledJobId: string | null = null
    mockInvokeFn.mockImplementation((command: string, payload?: Record<string, unknown>) => {
      if (command === 'start_rhizome_job') {
        startedJobId = (payload as { jobId?: string })?.jobId ?? null
        return Promise.resolve(null)
      }
      if (command === 'cancel_rhizome_job') {
        cancelledJobId = (payload as { jobId?: string })?.jobId ?? null
        return Promise.resolve(true)
      }
      if ((payload as { name?: string })?.name === 'rhizome_scan_library') {
        return Promise.resolve(JSON.stringify(libraryItems))
      }
      return Promise.resolve('{}')
    })

    render(
      <ResearchPanel open={true} onClose={onClose} vaultPath="/vault" onOpenNote={onOpenNote} />
    )

    fireEvent.change(screen.getByPlaceholderText(/github url, owner\/repo, or local path/i), {
      target: { value: 'owner/repo' },
    })
    fireEvent.click(screen.getByRole('button', { name: /^generate/i }))

    await waitFor(() => expect(startedJobId).not.toBeNull())

    const cancelButton = await screen.findByRole('button', { name: /cancel/i })
    fireEvent.click(cancelButton)

    await waitFor(() => expect(cancelledJobId).not.toBeNull())
    // The id sent to cancel_rhizome_job must be the id the backend job was
    // started under — a mismatch means Cancel silently does nothing.
    expect(cancelledJobId).toBe(startedJobId)

    // Cancelling resolves the job promise, so the panel leaves running state.
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /^generate/i })).toBeInTheDocument()
    )
  })

  it('sends rhizome_* calls to agentMemoryVaultPath instead of the open editor vault when set', async () => {
    render(
      <ResearchPanel
        open={true}
        onClose={onClose}
        vaultPath="/vault"
        agentMemoryVaultPath="/rhizome-vault"
        onOpenNote={onOpenNote}
      />
    )

    fireEvent.mouseDown(screen.getByRole('tab', { name: /distill/i }), { button: 0, ctrlKey: false })
    fireEvent.change(screen.getByPlaceholderText(/paste research output/i), {
      target: { value: 'some text to distill' },
    })
    fireEvent.click(screen.getByRole('button', { name: /^distill/i }))

    await waitFor(() => {
      expect(mockInvokeFn).toHaveBeenCalledWith('start_rhizome_job', expect.objectContaining({
        name: 'rhizome_distill',
        args: expect.objectContaining({ vaultPath: '/rhizome-vault' }),
      }))
    })
  })

  it('falls back to the open editor vault when agentMemoryVaultPath is not set', async () => {
    render(
      <ResearchPanel open={true} onClose={onClose} vaultPath="/vault" onOpenNote={onOpenNote} />
    )

    fireEvent.mouseDown(screen.getByRole('tab', { name: /distill/i }), { button: 0, ctrlKey: false })
    fireEvent.change(screen.getByPlaceholderText(/paste research output/i), {
      target: { value: 'some text to distill' },
    })
    fireEvent.click(screen.getByRole('button', { name: /^distill/i }))

    await waitFor(() => {
      expect(mockInvokeFn).toHaveBeenCalledWith('start_rhizome_job', expect.objectContaining({
        name: 'rhizome_distill',
        args: expect.objectContaining({ vaultPath: '/vault' }),
      }))
    })
  })

  it('shows the destination vault name on the write-action buttons', async () => {
    render(
      <ResearchPanel
        open={true}
        onClose={onClose}
        vaultPath="/vault"
        agentMemoryVaultPath="/Users/x/Rhizome Vault"
        onOpenNote={onOpenNote}
      />
    )

    expect(screen.getByRole('button', { name: /^generate.*rhizome vault/i })).toBeInTheDocument()

    fireEvent.mouseDown(screen.getByRole('tab', { name: /import/i }), { button: 0, ctrlKey: false })
    expect(screen.getByRole('button', { name: /^import.*rhizome vault/i })).toBeInTheDocument()

    fireEvent.mouseDown(screen.getByRole('tab', { name: /distill/i }), { button: 0, ctrlKey: false })
    expect(screen.getByRole('button', { name: /^distill.*rhizome vault/i })).toBeInTheDocument()
  })

  it('confirms before sending when the destination is switched to a non-default vault, and only sends after confirming', async () => {
    render(
      <ResearchPanel
        open={true}
        onClose={onClose}
        vaultPath="/vault"
        agentMemoryVaultPath="/rhizome-vault"
        vaults={[
          { label: 'rhizome-vault', path: '/rhizome-vault' },
          { label: 'school-project', path: '/school-project' },
        ]}
        onOpenNote={onOpenNote}
      />
    )

    fireEvent.mouseDown(screen.getByRole('tab', { name: /distill/i }), { button: 0, ctrlKey: false })
    fireEvent.change(screen.getByPlaceholderText(/paste research output/i), {
      target: { value: 'some text to distill' },
    })

    fireEvent.click(screen.getByRole('combobox', { name: /destination/i }))
    fireEvent.click(screen.getByRole('option', { name: 'school-project' }))

    fireEvent.click(screen.getByRole('button', { name: /^distill/i }))

    expect(mockInvokeFn).not.toHaveBeenCalledWith('start_rhizome_job', expect.objectContaining({
      name: 'rhizome_distill',
    }))
    expect(screen.getByText(/send to a different vault/i)).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /^send$/i }))

    await waitFor(() => {
      expect(mockInvokeFn).toHaveBeenCalledWith('start_rhizome_job', expect.objectContaining({
        name: 'rhizome_distill',
        args: expect.objectContaining({ vaultPath: '/school-project' }),
      }))
    })
  })

  it('persists the current destination as the new default when "Set as default" is clicked', () => {
    const onSetDefaultDestination = vi.fn()
    render(
      <ResearchPanel
        open={true}
        onClose={onClose}
        vaultPath="/vault"
        agentMemoryVaultPath="/rhizome-vault"
        vaults={[
          { label: 'rhizome-vault', path: '/rhizome-vault' },
          { label: 'school-project', path: '/school-project' },
        ]}
        onSetDefaultDestination={onSetDefaultDestination}
        onOpenNote={onOpenNote}
      />
    )

    expect(screen.queryByRole('button', { name: /set as default/i })).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('combobox', { name: /destination/i }))
    fireEvent.click(screen.getByRole('option', { name: 'school-project' }))

    fireEvent.click(screen.getByRole('button', { name: /set as default/i }))

    expect(onSetDefaultDestination).toHaveBeenCalledWith('/school-project')
    expect(screen.queryByRole('button', { name: /set as default/i })).not.toBeInTheDocument()
    expect(mockTrackEvent).toHaveBeenCalledWith('research_destination_override', {})
    expect(mockTrackEvent).toHaveBeenCalledWith('research_destination_set_default', {})
  })

  it('does not confirm when the destination dropdown is switched back to the default vault', async () => {
    render(
      <ResearchPanel
        open={true}
        onClose={onClose}
        vaultPath="/vault"
        agentMemoryVaultPath="/rhizome-vault"
        vaults={[
          { label: 'rhizome-vault', path: '/rhizome-vault' },
          { label: 'school-project', path: '/school-project' },
        ]}
        onOpenNote={onOpenNote}
      />
    )

    fireEvent.mouseDown(screen.getByRole('tab', { name: /distill/i }), { button: 0, ctrlKey: false })
    fireEvent.change(screen.getByPlaceholderText(/paste research output/i), {
      target: { value: 'some text to distill' },
    })

    fireEvent.click(screen.getByRole('combobox', { name: /destination/i }))
    fireEvent.click(screen.getByRole('option', { name: 'school-project' }))
    fireEvent.click(screen.getByRole('combobox', { name: /destination/i }))
    fireEvent.click(screen.getByRole('option', { name: 'rhizome-vault' }))

    fireEvent.click(screen.getByRole('button', { name: /^distill/i }))

    await waitFor(() => {
      expect(mockInvokeFn).toHaveBeenCalledWith('start_rhizome_job', expect.objectContaining({
        name: 'rhizome_distill',
        args: expect.objectContaining({ vaultPath: '/rhizome-vault' }),
      }))
    })
    expect(screen.queryByText(/send to a different vault/i)).not.toBeInTheDocument()
  })

  it('omits the kind arg when distilling with the auto-detect option', async () => {
    render(
      <ResearchPanel open={true} onClose={onClose} vaultPath="/vault" onOpenNote={onOpenNote} />
    )

    fireEvent.mouseDown(screen.getByRole('tab', { name: /distill/i }), { button: 0, ctrlKey: false })
    fireEvent.change(screen.getByPlaceholderText(/paste research output/i), {
      target: { value: 'some text to distill' },
    })
    fireEvent.click(screen.getByRole('button', { name: /^distill/i }))

    await waitFor(() => {
      expect(mockInvokeFn).toHaveBeenCalledWith('start_rhizome_job', expect.objectContaining({
        name: 'rhizome_distill',
      }))
    })
    const distillCall = mockInvokeFn.mock.calls.find(
      ([, payload]) => (payload as { name?: string })?.name === 'rhizome_distill'
    )
    expect(distillCall?.[1].args.kind).toBeUndefined()
  })

  it('filters the library by search text', async () => {
    render(
      <ResearchPanel open={true} onClose={onClose} vaultPath="/vault" onOpenNote={onOpenNote} />
    )

    fireEvent.mouseDown(screen.getByRole('tab', { name: /library/i }), { button: 0, ctrlKey: false })
    await screen.findByText('my repo')
    expect(screen.getByText('other doc')).toBeInTheDocument()

    fireEvent.change(screen.getByPlaceholderText(/search library/i), { target: { value: 'my repo' } })

    expect(screen.getByText('my repo')).toBeInTheDocument()
    expect(screen.queryByText('other doc')).not.toBeInTheDocument()
  })

  it('auto-loads history when the History tab is opened, without clicking Refresh', async () => {
    render(
      <ResearchPanel open={true} onClose={onClose} vaultPath="/vault" onOpenNote={onOpenNote} />
    )

    fireEvent.mouseDown(screen.getByRole('tab', { name: /history/i }), { button: 0, ctrlKey: false })

    expect(await screen.findByText(/2026-07-01/)).toBeInTheDocument()
  })

  it('fills the repo input from the file picker when Local is clicked', async () => {
    mockDialogOpen.mockResolvedValue('/Users/me/projects/my-local-repo')

    render(
      <ResearchPanel open={true} onClose={onClose} vaultPath="/vault" onOpenNote={onOpenNote} />
    )

    fireEvent.click(screen.getByRole('button', { name: /local/i }))

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/github url, owner\/repo, or local path/i))
        .toHaveValue('/Users/me/projects/my-local-repo')
    })
  })

  it('tracks research_generate with safe metadata on successful generation', async () => {
    render(
      <ResearchPanel open={true} onClose={onClose} vaultPath="/vault" onOpenNote={onOpenNote} />
    )

    fireEvent.change(screen.getByPlaceholderText(/github url, owner\/repo, or local path/i), {
      target: { value: 'owner/repo' },
    })
    fireEvent.click(screen.getByRole('button', { name: /^generate/i }))

    await waitFor(() => {
      expect(mockTrackEvent).toHaveBeenCalledWith('research_generate', { mode: 'architecture', depth: 'regular', has_project: 0 })
    })
  })

  it('sends the project field when generating a repo wiki', async () => {
    render(
      <ResearchPanel open={true} onClose={onClose} vaultPath="/vault" onOpenNote={onOpenNote} />
    )

    fireEvent.change(screen.getByPlaceholderText(/github url, owner\/repo, or local path/i), {
      target: { value: 'owner/repo' },
    })
    fireEvent.change(screen.getByPlaceholderText(/optional project name/i), {
      target: { value: 'rhizome' },
    })
    fireEvent.click(screen.getByRole('button', { name: /^generate/i }))

    await waitFor(() => {
      expect(mockInvokeFn).toHaveBeenCalledWith('start_rhizome_job', expect.objectContaining({
        name: 'rhizome_repo_research',
        args: expect.objectContaining({ project: 'rhizome' }),
      }))
      expect(mockTrackEvent).toHaveBeenCalledWith('research_generate', { mode: 'architecture', depth: 'regular', has_project: 1 })
    })
  })

  it('auto-opens the newest artifact created by a successful generation', async () => {
    let generated = false
    const newItem = {
      id: 'fresh-wiki.md',
      path: 'sources/repos/fresh-wiki.md',
      title: 'fresh wiki',
      description: 'Just created',
      type: 'wiki',
      tag: 'Repo Wiki',
      date: 1800000000, // newer than every pre-existing item
    }
    mockInvokeFn.mockImplementation((command: string, payload?: Record<string, unknown>) => {
      if (command === 'start_rhizome_job') {
        generated = true
        setTimeout(() => {
          jobCompleteHandler?.({ payload: { output: '{}' } } as never)
        }, 0)
        return Promise.resolve(null)
      }
      if (command === 'call_rhizome_tool' && (payload as { name?: string })?.name === 'rhizome_scan_library') {
        return Promise.resolve(JSON.stringify(generated ? [...libraryItems, newItem] : libraryItems))
      }
      return Promise.resolve('{}')
    })

    render(
      <ResearchPanel open={true} onClose={onClose} vaultPath="/vault" onOpenNote={onOpenNote} />
    )

    fireEvent.change(screen.getByPlaceholderText(/github url, owner\/repo, or local path/i), {
      target: { value: 'owner/repo' },
    })
    fireEvent.click(screen.getByRole('button', { name: /^generate/i }))

    await waitFor(() => {
      expect(onOpenNote).toHaveBeenCalledWith('sources/repos/fresh-wiki.md')
    })
    expect(mockTrackEvent).toHaveBeenCalledWith('research_artifact_autoopen', { type: 'wiki' })
  })

  it('does not auto-open anything when generation produced no new artifact', async () => {
    render(
      <ResearchPanel open={true} onClose={onClose} vaultPath="/vault" onOpenNote={onOpenNote} />
    )

    fireEvent.change(screen.getByPlaceholderText(/github url, owner\/repo, or local path/i), {
      target: { value: 'owner/repo' },
    })
    fireEvent.click(screen.getByRole('button', { name: /^generate/i }))

    await waitFor(() => {
      expect(mockTrackEvent).toHaveBeenCalledWith('research_generate', { mode: 'architecture', depth: 'regular', has_project: 0 })
    })
    expect(onOpenNote).not.toHaveBeenCalled()
  })

  it('shows live rhizome-progress lines in the event log', async () => {
    render(
      <ResearchPanel open={true} onClose={onClose} vaultPath="/vault" onOpenNote={onOpenNote} />
    )

    await waitFor(() => expect(progressHandler).not.toBeNull())
    progressHandler?.({ payload: { line: 'Researching module graph…' } })

    expect(await screen.findByText(/Researching module graph…/)).toBeInTheDocument()
  })

  it('tracks research_import on successful import', async () => {
    render(
      <ResearchPanel open={true} onClose={onClose} vaultPath="/vault" onOpenNote={onOpenNote} />
    )

    fireEvent.mouseDown(screen.getByRole('tab', { name: /import/i }), { button: 0, ctrlKey: false })
    fireEvent.change(screen.getByPlaceholderText(/pdf path, web url/i), {
      target: { value: 'https://example.com' },
    })
    fireEvent.click(screen.getByRole('button', { name: /^import/i }))

    await waitFor(() => {
      expect(mockTrackEvent).toHaveBeenCalledWith('research_import', { has_project: 0 })
    })
  })

  it('tracks research_distill with the selected kind', async () => {
    render(
      <ResearchPanel open={true} onClose={onClose} vaultPath="/vault" onOpenNote={onOpenNote} />
    )

    fireEvent.mouseDown(screen.getByRole('tab', { name: /distill/i }), { button: 0, ctrlKey: false })
    fireEvent.change(screen.getByPlaceholderText(/paste research output/i), {
      target: { value: 'some text to distill' },
    })
    fireEvent.click(screen.getByRole('button', { name: /^distill/i }))

    await waitFor(() => {
      expect(mockTrackEvent).toHaveBeenCalledWith('research_distill', { kind: 'auto', engine: 'agent' })
    })
  })

  it('sends the resolved agent target id as `target` for Generate/Import/Distill', async () => {
    render(
      <ResearchPanel open={true} onClose={onClose} vaultPath="/vault" onOpenNote={onOpenNote} />
    )

    fireEvent.change(screen.getByPlaceholderText(/github url, owner\/repo, or local path/i), {
      target: { value: 'owner/repo' },
    })
    fireEvent.click(screen.getByRole('button', { name: /^generate/i }))

    await waitFor(() => {
      expect(mockInvokeFn).toHaveBeenCalledWith('start_rhizome_job', expect.objectContaining({
        name: 'rhizome_repo_research',
        args: expect.objectContaining({ target: agentTargetId('prime') }),
      }))
    })

    fireEvent.mouseDown(screen.getByRole('tab', { name: /distill/i }), { button: 0, ctrlKey: false })
    fireEvent.change(screen.getByPlaceholderText(/paste research output/i), {
      target: { value: 'some text to distill' },
    })
    fireEvent.click(screen.getByRole('button', { name: /^distill/i }))

    await waitFor(() => {
      expect(mockInvokeFn).toHaveBeenCalledWith('start_rhizome_job', expect.objectContaining({
        name: 'rhizome_distill',
        args: expect.objectContaining({ target: agentTargetId('prime') }),
      }))
    })
  })

  it('offers a "Run with your API key" fallback only when the agent is blocked and a model is configured', async () => {
    const { rerender } = render(
      <ResearchPanel
        open={true}
        onClose={onClose}
        vaultPath="/vault"
        onOpenNote={onOpenNote}
        aiAgentsStatus={statusWithPrime({ status: 'missing' })}
        settings={{ ...BASE_SETTINGS, ai_model_providers: [] }}
      />
    )
    // Agent blocked, no model configured → no fallback offered.
    expect(screen.queryByRole('button', { name: /run with/i })).not.toBeInTheDocument()

    rerender(
      <ResearchPanel
        open={true}
        onClose={onClose}
        vaultPath="/vault"
        onOpenNote={onOpenNote}
        aiAgentsStatus={statusWithPrime({ status: 'missing' })}
        settings={{ ...BASE_SETTINGS, ai_model_providers: [anthropicProvider] }}
      />
    )
    // Agent blocked, model configured → fallback offered.
    expect(await screen.findByRole('button', { name: /run with claude sonnet/i })).toBeInTheDocument()

    rerender(
      <ResearchPanel
        open={true}
        onClose={onClose}
        vaultPath="/vault"
        onOpenNote={onOpenNote}
        aiAgentsStatus={statusWithPrime({ status: 'installed', version: '1.0.0' })}
        settings={{ ...BASE_SETTINGS, ai_model_providers: [anthropicProvider] }}
      />
    )
    // Agent ready, model configured → no fallback needed.
    expect(screen.queryByRole('button', { name: /run with/i })).not.toBeInTheDocument()
  })

  it('flips Distill/Import to ready after choosing the API-key fallback while Generate stays blocked', async () => {
    render(
      <ResearchPanel
        open={true}
        onClose={onClose}
        vaultPath="/vault"
        onOpenNote={onOpenNote}
        aiAgentsStatus={statusWithPrime({ status: 'missing' })}
        settings={{ ...BASE_SETTINGS, ai_model_providers: [anthropicProvider] }}
      />
    )

    fireEvent.mouseDown(screen.getByRole('tab', { name: /distill/i }), { button: 0, ctrlKey: false })
    fireEvent.change(screen.getByPlaceholderText(/paste research output/i), {
      target: { value: 'some text to distill' },
    })
    expect(screen.getByRole('button', { name: /^distill/i })).toBeDisabled()

    fireEvent.click(await screen.findByRole('button', { name: /run with claude sonnet/i }))

    expect(screen.getByRole('button', { name: /^distill/i })).toBeEnabled()

    fireEvent.mouseDown(screen.getByRole('tab', { name: /import/i }), { button: 0, ctrlKey: false })
    fireEvent.change(screen.getByPlaceholderText(/pdf path, web url/i), {
      target: { value: 'https://example.com/doc' },
    })
    expect(screen.getByRole('button', { name: /^import/i })).toBeEnabled()

    fireEvent.mouseDown(screen.getByRole('tab', { name: /generate/i }), { button: 0, ctrlKey: false })
    fireEvent.change(screen.getByPlaceholderText(/github url, owner\/repo, or local path/i), {
      target: { value: 'owner/repo' },
    })
    expect(screen.getByRole('button', { name: /^generate/i })).toBeDisabled()
  })

  it('sends the api-model target id and reports its provider engine when running Distill via the fallback', async () => {
    render(
      <ResearchPanel
        open={true}
        onClose={onClose}
        vaultPath="/vault"
        onOpenNote={onOpenNote}
        aiAgentsStatus={statusWithPrime({ status: 'missing' })}
        settings={{ ...BASE_SETTINGS, ai_model_providers: [anthropicProvider] }}
      />
    )

    fireEvent.mouseDown(screen.getByRole('tab', { name: /distill/i }), { button: 0, ctrlKey: false })
    fireEvent.change(screen.getByPlaceholderText(/paste research output/i), {
      target: { value: 'some text to distill' },
    })
    fireEvent.click(await screen.findByRole('button', { name: /run with claude sonnet/i }))
    fireEvent.click(screen.getByRole('button', { name: /^distill/i }))

    await waitFor(() => {
      expect(mockInvokeFn).toHaveBeenCalledWith('start_rhizome_job', expect.objectContaining({
        name: 'rhizome_distill',
        args: expect.objectContaining({ target: modelTargetId('anthropic-test', 'claude-sonnet') }),
      }))
      expect(mockTrackEvent).toHaveBeenCalledWith('research_distill', { kind: 'auto', engine: 'anthropic' })
    })
  })

  it('tracks research_ask with depth and scoped metadata', async () => {
    render(
      <ResearchPanel open={true} onClose={onClose} vaultPath="/vault" onOpenNote={onOpenNote} />
    )

    fireEvent.mouseDown(screen.getByRole('tab', { name: /^ask$/i }), { button: 0, ctrlKey: false })
    fireEvent.change(screen.getByPlaceholderText(/what do you want to understand/i), {
      target: { value: 'how does auth work?' },
    })
    fireEvent.click(screen.getByRole('button', { name: /^ask$/i }))

    await waitFor(() => {
      expect(mockTrackEvent).toHaveBeenCalledWith('research_ask', { depth: 'regular', scoped: 0 })
    })
  })

  it('renders search results and opens the note when one is clicked', async () => {
    mockInvokeFn.mockImplementation((command: string, payload?: { name?: string }) => {
      if (payload?.name === 'rhizome_search') {
        return Promise.resolve(JSON.stringify([
          { path: 'notes/auth.md', title: 'Auth flow', snippet: 'Explains the login sequence.' },
        ]))
      }
      return Promise.resolve(JSON.stringify(libraryItems))
    })

    render(
      <ResearchPanel open={true} onClose={onClose} vaultPath="/vault" onOpenNote={onOpenNote} />
    )

    fireEvent.mouseDown(screen.getByRole('tab', { name: /^ask$/i }), { button: 0, ctrlKey: false })
    fireEvent.change(screen.getByPlaceholderText(/what do you want to understand/i), {
      target: { value: 'how does auth work?' },
    })
    fireEvent.click(screen.getByRole('button', { name: /^ask$/i }))

    const resultTitle = await screen.findByText('Auth flow')
    expect(screen.getByText('Explains the login sequence.')).toBeInTheDocument()

    fireEvent.click(resultTitle)
    expect(onOpenNote).toHaveBeenCalledWith('notes/auth.md')
    expect(onClose).toHaveBeenCalled()
  })

  it('renders results from the real rhizome-search JSON shape ({page, score})', async () => {
    // Fixture captured from `rhizome-search <vault> "note" -k 3 --format json` v2026-07
    mockInvokeFn.mockImplementation((command: string, payload?: { name?: string }) => {
      if (payload?.name === 'rhizome_search') {
        return Promise.resolve(JSON.stringify([
          { page: 'note-on-clear-prose.md', score: 0.6274 },
          { page: 'type/note.md', score: 0.5919 },
        ]))
      }
      return Promise.resolve(JSON.stringify(libraryItems))
    })

    render(
      <ResearchPanel open={true} onClose={onClose} vaultPath="/vault" onOpenNote={onOpenNote} />
    )

    fireEvent.mouseDown(screen.getByRole('tab', { name: /^ask$/i }), { button: 0, ctrlKey: false })
    fireEvent.change(screen.getByPlaceholderText(/what do you want to understand/i), {
      target: { value: 'clear prose' },
    })
    fireEvent.click(screen.getByRole('button', { name: /^ask$/i }))

    const resultTitle = await screen.findByText('note-on-clear-prose.md')
    fireEvent.click(resultTitle)
    expect(onOpenNote).toHaveBeenCalledWith('note-on-clear-prose.md')
  })

  it('shows a no-results message when the search returns nothing', async () => {
    mockInvokeFn.mockImplementation((command: string, payload?: { name?: string }) => {
      if (payload?.name === 'rhizome_search') {
        return Promise.resolve(JSON.stringify([]))
      }
      return Promise.resolve(JSON.stringify(libraryItems))
    })

    render(
      <ResearchPanel open={true} onClose={onClose} vaultPath="/vault" onOpenNote={onOpenNote} />
    )

    fireEvent.mouseDown(screen.getByRole('tab', { name: /^ask$/i }), { button: 0, ctrlKey: false })
    fireEvent.change(screen.getByPlaceholderText(/what do you want to understand/i), {
      target: { value: 'anything' },
    })
    fireEvent.click(screen.getByRole('button', { name: /^ask$/i }))

    expect(await screen.findByText(/no results found/i)).toBeInTheDocument()
  })

  it('degrades to a no-results state when the search response is not valid JSON', async () => {
    mockInvokeFn.mockImplementation((command: string, payload?: { name?: string }) => {
      if (payload?.name === 'rhizome_search') {
        return Promise.resolve('not json at all')
      }
      return Promise.resolve(JSON.stringify(libraryItems))
    })

    render(
      <ResearchPanel open={true} onClose={onClose} vaultPath="/vault" onOpenNote={onOpenNote} />
    )

    fireEvent.mouseDown(screen.getByRole('tab', { name: /^ask$/i }), { button: 0, ctrlKey: false })
    fireEvent.change(screen.getByPlaceholderText(/what do you want to understand/i), {
      target: { value: 'anything' },
    })
    fireEvent.click(screen.getByRole('button', { name: /^ask$/i }))

    expect(await screen.findByText(/no results found/i)).toBeInTheDocument()
  })

  it('tracks research_library_open with the item type', async () => {
    render(
      <ResearchPanel open={true} onClose={onClose} vaultPath="/vault" onOpenNote={onOpenNote} />
    )

    fireEvent.mouseDown(screen.getByRole('tab', { name: /library/i }), { button: 0, ctrlKey: false })
    const item = await screen.findByText('my repo')
    fireEvent.click(item)

    expect(mockTrackEvent).toHaveBeenCalledWith('research_library_open', { type: 'wiki' })
  })
})

import { describe, expect, it, vi } from 'vitest'
import { triggerCommitEntryAction } from './commitEntryAction'

describe('triggerCommitEntryAction', () => {
  it('runs the automatic checkpoint when AutoGit is enabled', () => {
    const openCommitDialog = vi.fn().mockResolvedValue(undefined)
    const runAutomaticCheckpoint = vi.fn().mockResolvedValue(true)

    triggerCommitEntryAction({
      autoGitEnabled: true,
      openCommitDialog,
      runAutomaticCheckpoint,
    })

    expect(runAutomaticCheckpoint).toHaveBeenCalledWith({ savePendingBeforeCommit: true })
    expect(openCommitDialog).not.toHaveBeenCalled()
  })

  it('opens the manual commit dialog when AutoGit is disabled', () => {
    const openCommitDialog = vi.fn().mockResolvedValue(undefined)
    const runAutomaticCheckpoint = vi.fn().mockResolvedValue(true)

    triggerCommitEntryAction({
      autoGitEnabled: false,
      openCommitDialog,
      runAutomaticCheckpoint,
    })

    expect(openCommitDialog).toHaveBeenCalledTimes(1)
    expect(runAutomaticCheckpoint).not.toHaveBeenCalled()
  })
})

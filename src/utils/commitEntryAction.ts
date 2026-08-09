type RunAutomaticCheckpoint = (options?: { savePendingBeforeCommit?: boolean }) => Promise<boolean>
type OpenCommitDialog = () => Promise<void>

interface CommitEntryActionConfig {
  autoGitEnabled: boolean
  openCommitDialog: OpenCommitDialog
  runAutomaticCheckpoint: RunAutomaticCheckpoint
}

export function triggerCommitEntryAction({
  autoGitEnabled,
  openCommitDialog,
  runAutomaticCheckpoint,
}: CommitEntryActionConfig): void {
  if (autoGitEnabled) {
    void runAutomaticCheckpoint({ savePendingBeforeCommit: true })
    return
  }

  void openCommitDialog()
}

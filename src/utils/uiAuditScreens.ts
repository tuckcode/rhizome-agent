/**
 * Screens the UI audit walks, and the rule that a missing opener is a
 * failure. The old spec skipped the click when `count()` was 0 and then
 * audited Chat again, so a gone control still passed (#122).
 *
 * Research opens from the command-rail Views group. Changes and History
 * live there too; the Notes sidebar keeps Inbox / All notes / Archive.
 */

export type UiAuditScreen = {
  name: string
  /** Control that must exist before we open this screen. */
  openerTestId?: string
  /** `rhizome:notes-chrome` detail. Same event the status-bar control fires. */
  chrome?: 'research'
  /** Proof we left the previous screen. */
  destinationTestId: string
}

export const UI_AUDIT_SCREENS: readonly UiAuditScreen[] = [
  { name: 'chat', destinationTestId: 'chat-center' },
  {
    name: 'research',
    openerTestId: 'command-rail-research',
    chrome: 'research',
    destinationTestId: 'research-destination',
  },
]

export function requireAuditOpener(found: boolean, screenName: string): void {
  if (found) return
  throw new Error(
    `UI audit cannot find the control that opens "${screenName}". ` +
      'Do not skip the screen and audit whatever is showing. ' +
      'Update the screen list, or restore the control.',
  )
}

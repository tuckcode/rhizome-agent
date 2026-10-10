/**
 * Screens the UI audit walks, and the rule that a missing opener is a
 * failure. The old spec skipped the click when `count()` was 0 and then
 * audited Chat again, so a gone control still passed (#122).
 *
 * Changes is not here. It was removed from the command rail on purpose
 * (`command-rail-changes` leftover). The Notes sidebar still has a Changes
 * filter; that is not a top-level screen. Do not put a rail button back.
 */

export type UiAuditScreen = {
  name: string
  /** Control that must exist before we open this screen. */
  openerTestId?: string
  /** Command-palette name. Prefer this over a hit-test click. */
  command?: string
  /** Proof we left the previous screen. */
  destinationTestId: string
}

export const UI_AUDIT_SCREENS: readonly UiAuditScreen[] = [
  { name: 'chat', destinationTestId: 'chat-center' },
  {
    name: 'research',
    openerTestId: 'status-research',
    command: 'Open Research',
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

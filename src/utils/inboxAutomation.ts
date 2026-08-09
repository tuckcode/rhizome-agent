/**
 * Inbox automation default: ON when unset.
 * Explicit `false` stays off; `true`/`null`/`undefined` count as enabled so
 * brand-new vaults distill drops into raw/inbox without a Settings trip.
 */
export function isInboxAutomationEnabled(
  value: boolean | null | undefined,
): boolean {
  return value !== false
}

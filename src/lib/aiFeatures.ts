/**
 * Whether the AI surfaces are available. Always true.
 *
 * There used to be a Settings switch behind this — "Enable Rhizome AI
 * features" — inherited from Rhizome Desktop, where AI was one feature among
 * a note editor, a wiki, and a graph. In Rhizome Agent the AI *is* the
 * product: `CONTEXT.md` defines the app as a shell over Prime plus a memory
 * loop. A switch that turns off the product has no case for existing, and
 * Atticus removed it on 2026-08-29.
 *
 * This still reads as a function, and still returns `true` unconditionally
 * rather than being deleted, for one reason: `ai_features_enabled: false` may
 * already be stored in someone's settings file. Deleting the check would
 * leave them with the app switched off and no control to switch it back on.
 * Ignoring the stored value un-strands them.
 *
 * The 96 call sites that branch on this are now branching on a constant.
 * Removing them is a mechanical follow-up, deliberately not done in the same
 * change as the user-visible fix.
 */
export function areAiFeaturesEnabled(): boolean {
  return true
}

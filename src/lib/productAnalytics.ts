import type { AiAgentId } from './aiAgents'
import type { AiAgentPermissionMode } from './aiAgentPermissionMode'
import { trackEvent } from './telemetry'
import type { AllNotesFileVisibility } from '../utils/allNotesFileVisibility'
import type { DateDisplayFormat } from '../utils/dateDisplay'
import type { FilePreviewKind } from '../utils/filePreview'
import type { NoteWidthMode } from '../types'
import type { PrimeSessionAge } from './primeSessionMeta'
import type { ThemeMode } from './themeMode'

type TrackedPreviewKind = FilePreviewKind | 'unsupported'
type FilePreviewAction = 'copy_deep_link' | 'copy_path' | 'open_external' | 'reveal'
type AgentBlockedReason = 'agent_unavailable' | 'missing_vault'
type AiWorkspaceMode = 'docked' | 'side' | 'window'
type AiWorkspaceTitleSource = 'generated' | 'manual'
type NotePdfExportFailureReason = 'export_unavailable' | 'export_error'
type NotePdfExportSource = 'breadcrumb' | 'app_command' | 'note_list_context_menu'
type AnalyticsBoolean = boolean
type AiAgentResponseText = string
type AiAgentToolCount = number
type AiAgentResponseTextFlag = 'had_text' | 'had_partial_response'
type SheetFormulaFunctionName = string
type RailDestination = 'chat' | 'notes' | 'graph' | 'mycelium' | 'research' | 'changes'
type StatusBarPill = 'vault' | 'agents'

const ALL_NOTES_VISIBILITY_CATEGORIES: ReadonlyArray<keyof AllNotesFileVisibility> = [
  'pdfs',
  'images',
  'unsupported',
]

function trackedPreviewKind(previewKind: FilePreviewKind | null): TrackedPreviewKind {
  return previewKind ?? 'unsupported'
}

function numericFlag(value: AnalyticsBoolean): number {
  return value ? 1 : 0
}

function aiAgentResponsePayload(
  agent: AiAgentId,
  response: AiAgentResponseText,
  toolCount: AiAgentToolCount,
  textFlag: AiAgentResponseTextFlag,
) {
  return {
    agent,
    [textFlag]: numericFlag(response.trim().length > 0),
    tool_count: toolCount,
  }
}

export function trackFilePreviewOpened(previewKind: FilePreviewKind | null): void {
  trackEvent('file_preview_opened', {
    preview_kind: trackedPreviewKind(previewKind),
  })
}

export function trackFilePreviewAction(action: FilePreviewAction, previewKind: FilePreviewKind | null): void {
  trackEvent('file_preview_action', {
    action,
    preview_kind: trackedPreviewKind(previewKind),
  })
}

export function trackFilePreviewFailed(previewKind: FilePreviewKind): void {
  trackEvent('file_preview_failed', { preview_kind: previewKind })
}

/**
 * A running-session row was opened from the menu-bar roster (#13).
 *
 * The point of the roster is discovery — whether anyone actually uses the menu
 * bar to get back to work, or only ever opens it to capture. No session id,
 * title, path, or summary: those carry note and prompt content.
 *
 * `working` and the subagent count are numbers, not booleans — `trackEvent`
 * takes `Record<string, string | number>` and a raw boolean gets through
 * `npx tsc --noEmit` only to fail the stricter pre-push build (see e518b0c).
 */
/**
 * The reasoning level was changed from the strip control (#9).
 *
 * The level id is a fixed, non-identifying enum from Prime's own list, so it
 * is safe to record as-is; it tells us whether anyone actually moves off the
 * default, which is the whole question behind putting the control on the strip.
 */
export function trackPrimeThinkingLevelChanged(level: string): void {
  trackEvent('prime_thinking_level_changed', { level })
}

/**
 * A scheduled prompt was paused, resumed, or cancelled from the band (#14).
 *
 * Both fields are fixed enums from Prime's own vocabulary — no prompt text,
 * no job id, no session id. The prompt of a heartbeat is user content.
 */
export function trackPrimeScheduledWorkAction(
  action: 'pause' | 'resume' | 'cancel',
  source: string,
): void {
  trackEvent('prime_scheduled_work_action', { action, source })
}

export function trackMenuBarSessionOpened(options: {
  working: boolean
  subagentCount: number
  visibleCount: number
}): void {
  trackEvent('menu_bar_session_opened', {
    working: options.working ? 1 : 0,
    subagent_count: options.subagentCount,
    visible_count: options.visibleCount,
  })
}

export function trackNotePdfExportStarted(source: NotePdfExportSource): void {
  trackEvent('note_pdf_export_started', { source })
}

export function trackNotePdfExportFailed(
  source: NotePdfExportSource,
  reason: NotePdfExportFailureReason,
): void {
  trackEvent('note_pdf_export_failed', { reason, source })
}

export function trackAllNotesVisibilityChanged(
  previous: AllNotesFileVisibility,
  next: AllNotesFileVisibility,
): void {
  for (const category of ALL_NOTES_VISIBILITY_CATEGORIES) {
    const previousValue = Reflect.get(previous, category) as boolean
    const nextValue = Reflect.get(next, category) as boolean
    if (previousValue === nextValue) continue
    trackEvent('all_notes_visibility_changed', {
      category,
      enabled: numericFlag(nextValue),
    })
  }
}

export function trackAiFeaturesEnabledChanged(enabled: AnalyticsBoolean): void {
  trackEvent('ai_features_visibility_changed', {
    enabled: numericFlag(enabled),
  })
}

export function trackGitFeaturesEnabledChanged(enabled: AnalyticsBoolean): void {
  trackEvent('git_features_visibility_changed', {
    enabled: numericFlag(enabled),
  })
}

export function trackDefaultNoteWidthChanged(mode: NoteWidthMode): void {
  trackEvent('note_width_default_changed', { mode })
}

export function trackDateDisplayFormatChanged(format: DateDisplayFormat): void {
  trackEvent('date_display_format_changed', { format })
}

export function trackSidebarTypePluralizationChanged(enabled: AnalyticsBoolean): void {
  trackEvent('sidebar_type_pluralization_changed', {
    enabled: numericFlag(enabled),
  })
}

export function trackThemeModeChanged(mode: ThemeMode): void {
  trackEvent('theme_mode_changed', { mode })
}

export function trackColorThemeChanged(theme: string): void {
  trackEvent('color_theme_changed', { theme })
}

export function trackAccentColorChanged(accent: string): void {
  trackEvent('accent_color_changed', { accent })
}

export function trackInlineImageLightboxOpened(): void {
  trackEvent('inline_image_lightbox_opened')
}

export function trackDatePropertyDirectEntrySaved(): void {
  trackEvent('date_property_direct_entry_saved', { source: 'properties_panel' })
}

export function trackSheetEditorOpened(params: {
  columnCount: number
  hasMetadata: boolean
  rowCount: number
}): void {
  trackEvent('sheet_editor_opened', {
    column_count: params.columnCount,
    has_metadata: numericFlag(params.hasMetadata),
    row_count: params.rowCount,
  })
}

export function trackSheetFormulaAutocompleteUsed(functionName: SheetFormulaFunctionName): void {
  trackEvent('sheet_formula_autocomplete_used', { function_name: functionName })
}

export function trackAiAgentMessageBlocked(agent: AiAgentId, reason: AgentBlockedReason): void {
  trackEvent('ai_agent_message_blocked', { agent, reason })
}

export function trackAiAgentMessageSent(params: {
  agent: AiAgentId
  permissionMode: AiAgentPermissionMode
  hasContext: boolean
  referenceCount: number
  historyMessageCount: number
}): void {
  trackEvent('ai_agent_message_sent', {
    agent: params.agent,
    permission_mode: params.permissionMode,
    has_context: numericFlag(params.hasContext),
    reference_count: params.referenceCount,
    history_message_count: params.historyMessageCount,
  })
}

export function trackAiAgentResponseCompleted(
  agent: AiAgentId,
  response: AiAgentResponseText,
  toolCount: AiAgentToolCount,
  skipped: AnalyticsBoolean,
): void {
  if (skipped) return
  trackEvent('ai_agent_response_completed', aiAgentResponsePayload(agent, response, toolCount, 'had_text'))
}

export function trackAiAgentResponseFailed(
  agent: AiAgentId,
  response: AiAgentResponseText,
  toolCount: AiAgentToolCount,
): void {
  trackEvent('ai_agent_response_failed', {
    ...aiAgentResponsePayload(agent, response, toolCount, 'had_partial_response'),
    error_kind: 'stream_error',
  })
}

export function trackAiAgentResponseStopped(
  agent: AiAgentId,
  response: AiAgentResponseText,
  toolCount: AiAgentToolCount,
): void {
  trackEvent('ai_agent_response_stopped', aiAgentResponsePayload(agent, response, toolCount, 'had_partial_response'))
}

export function trackAiAgentPermissionModeChanged(agent: AiAgentId, permissionMode: AiAgentPermissionMode): void {
  trackEvent('ai_agent_permission_mode_changed', {
    agent,
    permission_mode: permissionMode,
  })
}

export function trackAiWorkspaceSidebarToggled(collapsed: AnalyticsBoolean, mode: AiWorkspaceMode): void {
  trackEvent('ai_workspace_sidebar_toggled', {
    collapsed: numericFlag(collapsed),
    mode,
  })
}

export function trackAiWorkspaceChatTitled(source: AiWorkspaceTitleSource): void {
  trackEvent('ai_workspace_chat_titled', { source })
}

export function trackRailDestinationClicked(destination: RailDestination): void {
  trackEvent('rail_destination_clicked', { destination })
}

export function trackStatusBarPillOpened(pill: StatusBarPill): void {
  trackEvent('statusbar_pill_opened', { pill })
}

/**
 * The user copied their MCP bridge token, i.e. started pairing a browser
 * extension. No properties — the token itself is a secret and the event is
 * only here to tell us whether anyone ever finds this affordance.
 */
export function trackBridgeTokenCopied(): void {
  trackEvent('bridge_token_copied')
}

/**
 * The wiki-graph key was expanded or collapsed. Tells us whether the
 * legend is something people actually want open, or noise they dismiss.
 */
export function trackGraphLegendToggled(state: 'opened' | 'closed'): void {
  trackEvent('graph_legend_toggled', { state })
}

/**
 * The Prime session list was opened. Tells us whether anyone finds it — the
 * whole reason the list exists is that past conversations were unreachable.
 * `session_count` is a size bucket, never a path or title: what the user
 * talked about is theirs.
 */
export function trackPrimeSessionListOpened(sessionCount: number): void {
  trackEvent('prime_session_list_opened', {
    session_count: sessionCountBucket(sessionCount),
  })
}

/**
 * A past session was opened from the list. `age` says how old it was, which
 * tells us whether people reach for yesterday's work or last month's.
 */
export function trackPrimeSessionOpened(age: PrimeSessionAge): void {
  trackEvent('prime_session_opened', { age })
}

/**
 * A session was filed out of the list, or put back.
 *
 * Whether people curate this list at all is the question #30 left open: if
 * they do, the list stays short on its own and never needs virtualizing. No
 * id, no title, no path — only which way the switch went.
 */
export function trackPrimeSessionArchived(archived: boolean): void {
  trackEvent('prime_session_archived', { archived: archived ? 'yes' : 'no' })
}

/** Coarse buckets — an exact count of someone's sessions is not our business. */
function sessionCountBucket(count: number): '0' | '1-5' | '6-20' | '21-50' | '50+' {
  if (count <= 0) return '0'
  if (count <= 5) return '1-5'
  if (count <= 20) return '6-20'
  if (count <= 50) return '21-50'
  return '50+'
}

/**
 * The user switched Prime's model from the composer. Provider only — the model
 * id is fine to record, but provider is what answers the question this exists
 * for: which of their own connections people actually run on.
 */
export function trackPrimeModelChanged(provider: string): void {
  trackEvent('prime_model_changed', { provider })
}

/** A `/` menu command ran. Slash name only — never the prompt body. */
export function trackPrimeCommandRun(command: string, kind: 'skill' | 'instant'): void {
  trackEvent('prime_command_run', { command, kind })
}

/**
 * A celebration was requested. `shown` says whether it actually fired, and
 * `refusal` says what stopped it — which is the interesting half: a stream of
 * `cooldown` refusals means two sources keep noticing the same milestone, and
 * a stream of `disabled` means people turn this off.
 */
export function trackCelebration({
  reason,
  shown,
  refusal,
}: {
  reason: string
  shown: boolean
  refusal?: string
}): void {
  trackEvent('celebration_requested', {
    reason,
    shown: shown ? 'yes' : 'no',
    refusal: refusal ?? 'none',
  })
}

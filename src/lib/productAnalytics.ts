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
type RailDestination = 'chat' | 'inbox' | 'graph' | 'mycelium' | 'research' | 'changes'
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
 * The reasoning level was changed from the composer (#9 / #35).
 *
 * The level id is a fixed, non-identifying enum from Prime's own list, so it
 * is safe to record as-is. `source` says whether it came from the model menu
 * or the one-click toggle — whether anyone uses the toggle is the question.
 */
export function trackPrimeThinkingLevelChanged(
  level: string,
  source: 'menu' | 'toggle' = 'menu',
): void {
  trackEvent('prime_thinking_level_changed', { level, source })
}

/**
 * A composer control strip pill was opened (#38). Which pill, never the
 * vault path, skill name, or model id — those are user content.
 */
export function trackComposerPillOpened(
  pill: 'agent' | 'model' | 'vault' | 'skills',
): void {
  trackEvent('composer_pill_opened', { pill })
}

/**
 * A user-authored research format was saved (#37).
 *
 * Only the resulting count. The title and the instruction are user content —
 * an instruction can name a private repo, a client, or a colleague — and the
 * question this event exists to answer is whether anyone writes custom
 * formats at all, which a count answers on its own.
 */
export function trackResearchFormatSaved(totalFormats: number): void {
  trackEvent('research_format_saved', { totalFormats })
}

/**
 * A credential-shaped token was stopped before leaving the machine (#29).
 *
 * Count and enums only — never the token, never the surrounding note. `source`
 * is which write path noticed it; `action` is whether we stripped it and
 * continued (unattended distill) or refused (the user is present).
 */
export function trackVaultCredentialsHandled(
  source: 'auto_distill' | 'promote' | 'research_distill' | 'menu_bar_distill',
  action: 'redact' | 'refuse',
  count: number,
): void {
  trackEvent('vault_credentials_handled', { source, action, count })
}

/**
 * A message was sent to a turn that was already running (#41).
 *
 * The kind only — never the message, which is user content. Atticus, asked
 * whether people steer or queue, answered "i do both", so the split is the
 * whole question this event exists to measure: a surface that serves one and
 * tolerates the other would be the wrong design.
 */
export function trackPrimeTurnMessage(kind: 'steer' | 'followUp'): void {
  trackEvent('prime_turn_message', { kind })
}

/** Cleared Prime's steer/follow-up queue from Chat. No message text. */
export function trackPrimeQueueCleared(): void {
  trackEvent('prime_queue_cleared')
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

/** Stopped one live RLM child from Chat. No child id — that is Prime's. */
export function trackPrimeRlmChildStopped(): void {
  trackEvent('prime_rlm_child_stopped')
}

/** Continued from a fork inside the current conversation (#17). No entry text. */
export function trackPrimeSessionTreeNavigated(): void {
  trackEvent('prime_session_tree_navigated')
}

/** Created a heartbeat or cron job from Chat. No prompt text. */
export function trackPrimeScheduledWorkCreated(source: 'heartbeat' | 'cron'): void {
  trackEvent('prime_scheduled_work_created', { source })
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

/**
 * Someone typed in the session list filter (#34).
 *
 * Whether people reach for search answers whether curation is enough.
 * `match_count` is a size bucket, never the query — the query is theirs.
 */
export function trackPrimeSessionListFiltered(matchCount: number): void {
  trackEvent('prime_session_list_filtered', {
    match_count: sessionCountBucket(matchCount),
  })
}

/**
 * A session was given a name from the list (#31).
 *
 * Whether people rename at all answers whether the create-time label is
 * enough. No title, no path — the name is theirs.
 */
export function trackPrimeSessionRenamed(): void {
  trackEvent('prime_session_renamed')
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

/**
 * The chat model menu's curated allow-list changed (#45).
 *
 * Counts only. The question this answers is whether people curate at all and
 * how far down they cut — 501 models is the complaint the feature exists for,
 * so "curated to 6 of 501" is the signal. Which models they picked is a
 * per-user preference, and shipping 501 ids per event would bury it anyway.
 */
export function trackPrimeModelAllowListChanged(selected: number, available: number): void {
  trackEvent('prime_model_allow_list_changed', { selected, available })
}

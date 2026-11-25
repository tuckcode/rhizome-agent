import { Terminal } from '@phosphor-icons/react'
import { Button } from './ui/button'
import { SettingsGroup, SettingsRow, SettingsSwitchRow } from './SettingsControls'
import {
  CLAUDE_CODE_LABEL,
  CLAUDE_CODE_SETTINGS_NOTES,
  CLAUDE_CODE_SWITCH_LABEL,
  claudeCodeStatusLine,
  trackClaudeCodeEngineToggled,
  useClaudeCodeEngineState,
} from '../lib/claudeCodeEngine'

interface ClaudeCodeEngineSettingsSectionProps {
  enabled: boolean
  onEnabledChange: (value: boolean) => void
}

/**
 * ADR-0191 step 6: the off-by-default switch and a status line.
 *
 * Status comes from `claude --version` and `claude auth status --json` only.
 * There is no sign-in button: a signed-out user gets terminal text.
 */
export function ClaudeCodeEngineSettingsSection({
  enabled,
  onEnabledChange,
}: ClaudeCodeEngineSettingsSectionProps) {
  const { state, refresh } = useClaudeCodeEngineState(enabled)

  return (
    <div className="flex flex-col gap-2" data-testid="settings-claude-code-engine">
      <div className="flex items-center gap-1.5 text-sm font-medium text-foreground">
        <Terminal size={14} aria-hidden="true" />
        <span>{CLAUDE_CODE_LABEL}</span>
      </div>
      <SettingsGroup>
        <SettingsSwitchRow
          label={CLAUDE_CODE_SWITCH_LABEL}
          description="Off by default. When on, the model picker offers Claude Code for new chats. A chat keeps the engine it started with."
          checked={enabled}
          onChange={(value) => {
            trackClaudeCodeEngineToggled(value)
            onEnabledChange(value)
          }}
          testId="settings-claude-code-engine-enabled"
        />
        {enabled ? (
          <SettingsRow
            label="Status"
            description={claudeCodeStatusLine(state)}
            testId="settings-claude-code-engine-status"
          >
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={state.kind === 'checking'}
              onClick={refresh}
              data-testid="settings-claude-code-engine-check"
            >
              Check again
            </Button>
          </SettingsRow>
        ) : null}
      </SettingsGroup>
      <ul
        className="list-disc space-y-1 pl-5 text-xs leading-5 text-muted-foreground"
        data-testid="settings-claude-code-engine-notes"
      >
        {CLAUDE_CODE_SETTINGS_NOTES.map((note) => (
          <li key={note}>{note}</li>
        ))}
      </ul>
    </div>
  )
}

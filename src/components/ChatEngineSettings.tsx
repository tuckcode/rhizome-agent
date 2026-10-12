import { SettingsSwitchRow } from './SettingsControls'
import type { ChatEngine } from '../lib/chatEngine'

/** The only engine control. The composer does not get one. */
export function ChatEngineSettings({
  engine,
  onChange,
}: {
  engine: ChatEngine
  onChange: (engine: ChatEngine) => void
}) {
  const native = engine === 'native'
  return (
    <SettingsSwitchRow
      label="Chat engine"
      description="New chats use Prime unless you turn this on for Rhizome's engine. Prime chats fall back to Rhizome only after we know Prime is not installed, and an open chat stays on the engine it started on."
      checked={native}
      onChange={(checked) => onChange(checked ? 'native' : 'prime')}
      testId="settings-chat-engine"
    />
  )
}

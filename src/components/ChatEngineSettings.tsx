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
      description="On: new chats use Rhizome's engine. Off: new chats use Prime, and they switch to Rhizome's engine if Prime isn't installed. An open chat stays on the engine it started with."
      checked={native}
      onChange={(checked) => onChange(checked ? 'native' : 'prime')}
      testId="settings-chat-engine"
    />
  )
}

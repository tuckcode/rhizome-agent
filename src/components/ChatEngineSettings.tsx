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
      description={
        native
          ? 'New chats use Rhizome’s own engine. Prime stays available until you turn this on.'
          : 'Prime Agent runs Chat. Turn this on to send new chats through Rhizome’s own engine.'
      }
      checked={native}
      onChange={(checked) => onChange(checked ? 'native' : 'prime')}
      testId="settings-chat-engine"
    />
  )
}

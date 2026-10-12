import { SettingsSwitchRow } from './SettingsControls'
import type { ChatEngine } from '../lib/chatEngine'
import { translate, type AppLocale } from '../lib/i18n'

/** The only engine control. The composer does not get one. */
export function ChatEngineSettings({
  engine,
  onChange,
  locale = 'en',
}: {
  engine: ChatEngine
  onChange: (engine: ChatEngine) => void
  locale?: AppLocale
}) {
  const native = engine === 'native'
  return (
    <SettingsSwitchRow
      label="Chat engine"
      description={translate(locale, 'settings.chatEngine.description')}
      checked={native}
      onChange={(checked) => onChange(checked ? 'native' : 'prime')}
      testId="settings-chat-engine"
    />
  )
}

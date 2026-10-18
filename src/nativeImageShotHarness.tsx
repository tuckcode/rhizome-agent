import { useRef } from 'react'
import { AiMessage } from './components/AiMessage'
import { AiPanelComposer } from './components/AiPanelChrome'
import type { ComposerAttachment } from './lib/composerAttachments'

const PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGNg2OIGAAGyAPse0xNEAAAAAElFTkSuQmCC'

const attachment = (name: string): ComposerAttachment => ({
  id: name,
  data: PNG,
  mimeType: 'image/png',
  name,
  byteSize: 70,
})

type Shot = 'text-only' | 'unknown' | 'too-large' | 'too-many' | 'wrong-type' | 'sent'

function readShot(): { shot: Shot; theme: 'graphite' | 'earth-light' } {
  const params = new URLSearchParams(window.location.hash.split('?')[1] ?? '')
  const shot = (params.get('shot') ?? 'text-only') as Shot
  const theme = params.get('theme') === 'earth-light' ? 'earth-light' : 'graphite'
  return { shot, theme }
}

function applyTheme(theme: 'graphite' | 'earth-light') {
  const root = document.documentElement
  if (theme === 'earth-light') {
    root.setAttribute('data-theme', 'light')
    root.classList.remove('dark')
    root.setAttribute('data-color-theme', 'rhizome')
  } else {
    root.setAttribute('data-theme', 'dark')
    root.classList.add('dark')
    root.removeAttribute('data-color-theme')
  }
}

export function NativeImageShotHarness() {
  const { shot, theme } = readShot()
  applyTheme(theme)
  const inputRef = useRef<HTMLDivElement>(null)
  const many = [attachment('one.png'), attachment('two.png'), attachment('three.png'), attachment('four.png')]
  const notice = shot === 'too-large'
    ? "huge.png wasn't attached. Images must be 5 MB or smaller."
    : shot === 'too-many'
      ? 'Only the first 4 images were attached.'
      : shot === 'wrong-type'
        ? "diagram.bmp wasn't attached. Use a PNG, JPEG, GIF or WebP image."
        : null
  const attachments = shot === 'too-many'
    ? many
    : shot === 'text-only' || shot === 'unknown'
      ? [attachment('screenshot.png')]
      : []

  return (
    <div className="min-h-screen bg-background p-6 text-foreground" data-testid="native-image-shot">
      {shot === 'sent' ? (
        <div className="mb-4">
          <AiMessage
            userMessage="what is this"
            actions={[]}
            response="A small green square."
            images={[{ type: 'image', data: PNG, mimeType: 'image/png' }]}
          />
        </div>
      ) : null}
      <AiPanelComposer
        agentLabel="Rhizome"
        agentReadiness="ready"
        entries={[]}
        input={shot === 'sent' ? '' : 'what is this'}
        inputRef={inputRef}
        isActive={false}
        onChange={() => {}}
        onSend={() => {}}
        onStop={() => {}}
        attachments={attachments}
        attachmentNotice={notice}
        vision={shot === 'text-only' ? 'no' : shot === 'unknown' ? 'unknown' : 'yes'}
        modelLabel={shot === 'text-only' ? 'gpt-3.5-turbo' : shot === 'unknown' ? 'llava' : 'gpt-4o'}
      />
    </div>
  )
}

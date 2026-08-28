import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { AiPanelComposer } from './AiPanelChrome'
import type { ComposerAttachment } from '../lib/composerAttachments'

/**
 * Image attachments in the chat composer.
 *
 * Prime has accepted images all along (`docs/rpc.md`: `prompt`, `steer` and
 * `follow_up` each take an `images` array). The composer refused the paste
 * itself, so "only text is supported" was Rhizome's own limitation.
 */

const attachment = (over: Partial<ComposerAttachment> = {}): ComposerAttachment => ({
  id: 'a1',
  data: 'QUJD',
  mimeType: 'image/png',
  name: 'screenshot.png',
  byteSize: 3,
  ...over,
})

function renderComposer(props: Partial<Parameters<typeof AiPanelComposer>[0]> = {}) {
  const onSend = vi.fn()
  const onAttachImages = vi.fn()
  const onRemoveAttachment = vi.fn()
  render(
    <AiPanelComposer
      agentLabel="Prime Agent"
      agentReadiness="ready"
      entries={[]}
      input=""
      inputRef={{ current: null }}
      isActive={false}
      locale="en"
      onChange={vi.fn()}
      onSend={onSend}
      onStop={vi.fn()}
      attachments={[]}
      onAttachImages={onAttachImages}
      onRemoveAttachment={onRemoveAttachment}
      {...props}
    />,
  )
  return { onSend, onAttachImages, onRemoveAttachment }
}

describe('AiPanelComposer attachments', () => {
  it('shows nothing when there is nothing attached', () => {
    renderComposer()
    expect(screen.queryByTestId('composer-attachments')).not.toBeInTheDocument()
  })

  it('lists an attached image by name so it is obvious what will be sent', () => {
    renderComposer({ attachments: [attachment()] })
    expect(screen.getByTestId('composer-attachments')).toBeInTheDocument()
    expect(screen.getByText('screenshot.png')).toBeInTheDocument()
  })

  it('removes one attachment without touching the message', () => {
    const { onRemoveAttachment } = renderComposer({ attachments: [attachment()] })
    fireEvent.click(screen.getByTestId('composer-attachment-remove-a1'))
    expect(onRemoveAttachment).toHaveBeenCalledWith('a1')
  })

  /**
   * The whole point of pasting a screenshot is to ask about it, and often the
   * question is in the image. An attachment alone must be sendable.
   */
  it('can send an image with no text at all', async () => {
    const { onSend } = renderComposer({ attachments: [attachment()], input: '' })
    const send = screen.getByTestId('agent-send')
    expect(send).not.toBeDisabled()
    fireEvent.click(send)
    await waitFor(() => expect(onSend).toHaveBeenCalled())
  })

  it('still refuses to send an empty message with nothing attached', () => {
    renderComposer({ attachments: [], input: '   ' })
    expect(screen.getByTestId('agent-send')).toBeDisabled()
  })

  it('hands pasted image files to the owner rather than swallowing them', () => {
    const { onAttachImages } = renderComposer()
    const png = new File([new Uint8Array(4)], 'shot.png', { type: 'image/png' })
    const editor = screen.getByTestId('agent-input')

    fireEvent.paste(editor, {
      clipboardData: {
        files: Object.assign([png], { item: () => png }),
        items: [{ kind: 'file', type: 'image/png' }],
        getData: () => '',
      },
    })

    expect(onAttachImages).toHaveBeenCalledTimes(1)
    expect(onAttachImages.mock.calls[0][0].map((f: File) => f.name)).toEqual(['shot.png'])
  })
})

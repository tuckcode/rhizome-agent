import { describe, expect, it } from 'vitest'
import {
  mediaBlockPropsForPreviewRuntime,
  schema,
} from './editorSchema'

describe('editor schema media blocks', () => {
  it('keeps embedded audio and video blocks available in the editor schema', () => {
    expect(schema.blockSpecs.audio.config.type).toBe('audio')
    expect(schema.blockSpecs.video.config.type).toBe('video')
  })

  it('turns embedded media previews into file-name fallbacks for unsafe runtimes', () => {
    const props = {
      block: {
        id: 'media-block',
        props: {
          name: 'demo.mp4',
          showPreview: true,
          url: 'asset://localhost/demo.mp4',
        },
      },
    }

    const fallbackProps = mediaBlockPropsForPreviewRuntime(props, true)

    expect(fallbackProps).not.toBe(props)
    expect(fallbackProps.block.props.showPreview).toBe(false)
    expect(props.block.props.showPreview).toBe(true)
    expect(mediaBlockPropsForPreviewRuntime(props, false)).toBe(props)
  })
})

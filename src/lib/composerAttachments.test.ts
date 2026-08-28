import { describe, expect, it } from 'vitest'
import {
  MAX_IMAGES_PER_MESSAGE,
  MAX_IMAGE_BYTES,
  imageFilesFromTransfer,
  isSupportedImageType,
  readImageAttachment,
  toPrimeImages,
  type ComposerAttachment,
} from './composerAttachments'

function file(name: string, type: string, bytes = 8): File {
  return new File([new Uint8Array(bytes)], name, { type })
}

function transfer(files: File[]): DataTransfer {
  // jsdom's DataTransfer cannot be populated, so this is the shape the
  // handlers actually read off a paste or drop event.
  return {
    files: Object.assign(files, { item: (i: number) => files[i] ?? null }),
    items: files.map((f) => ({ kind: 'file', type: f.type })),
  } as unknown as DataTransfer
}

describe('isSupportedImageType', () => {
  it('accepts the formats every vision model takes', () => {
    for (const type of ['image/png', 'image/jpeg', 'image/gif', 'image/webp']) {
      expect(isSupportedImageType(type)).toBe(true)
    }
  })

  /** A PDF or a .mov pasted into chat is not an image, however hopeful. */
  it('rejects anything else, including other files', () => {
    expect(isSupportedImageType('application/pdf')).toBe(false)
    expect(isSupportedImageType('image/tiff')).toBe(false)
    expect(isSupportedImageType('')).toBe(false)
  })
})

describe('imageFilesFromTransfer', () => {
  it('picks the images out of a mixed paste', () => {
    const png = file('a.png', 'image/png')
    const found = imageFilesFromTransfer(transfer([png, file('b.pdf', 'application/pdf')]))
    expect(found.map((f) => f.name)).toEqual(['a.png'])
  })

  it('is empty for a text-only paste, so plain text keeps its fast path', () => {
    expect(imageFilesFromTransfer(transfer([]))).toEqual([])
  })
})

describe('readImageAttachment', () => {
  it('reads a file into the base64 payload Prime asks for', async () => {
    const result = await readImageAttachment(file('shot.png', 'image/png', 4))
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.attachment.mimeType).toBe('image/png')
    expect(result.attachment.name).toBe('shot.png')
    expect(result.attachment.byteSize).toBe(4)
    // Base64 only — the `data:` prefix is a browser artifact and Prime
    // rejects it.
    expect(result.attachment.data).not.toContain('data:')
    expect(result.attachment.data.length).toBeGreaterThan(0)
  })

  it('refuses an unsupported type with a reason rather than silently dropping it', async () => {
    const result = await readImageAttachment(file('doc.pdf', 'application/pdf'))
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.reason).toBe('unsupported_type')
  })

  /**
   * The daemon protocol is newline-delimited JSON over a socket, so one
   * oversized paste is a stall for the whole session, not just a slow message.
   */
  it('refuses an image past the size cap', async () => {
    const result = await readImageAttachment(file('huge.png', 'image/png', MAX_IMAGE_BYTES + 1))
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.reason).toBe('too_large')
  })
})

describe('toPrimeImages', () => {
  const attachment = (over: Partial<ComposerAttachment> = {}): ComposerAttachment => ({
    id: 'a1',
    data: 'QUJD',
    mimeType: 'image/png',
    name: 'a.png',
    byteSize: 3,
    ...over,
  })

  it('emits exactly the ImageContent shape from Prime rpc.md', () => {
    expect(toPrimeImages([attachment()])).toEqual([
      { type: 'image', data: 'QUJD', mimeType: 'image/png' },
    ])
  })

  /** No `images` key at all rather than an empty array — a text-only turn
   *  must look byte-identical to what we sent before this feature. */
  it('is null for no attachments so a text turn is unchanged on the wire', () => {
    expect(toPrimeImages([])).toBeNull()
  })

  it('never sends more than the per-message cap', () => {
    const many = Array.from({ length: MAX_IMAGES_PER_MESSAGE + 3 }, (_, i) =>
      attachment({ id: `a${i}` }),
    )
    expect(toPrimeImages(many)).toHaveLength(MAX_IMAGES_PER_MESSAGE)
  })
})

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { handleEditorFileBlockClick } from './editorAttachmentActions'
import { openExternalUrl, openLocalFile } from '../utils/url'

vi.mock('../utils/url', () => ({
  normalizeExternalUrl: vi.fn((url: string) => (
    url.startsWith('http://') || url.startsWith('https://') ? url : null
  )),
  openExternalUrl: vi.fn().mockResolvedValue(undefined),
  openLocalFile: vi.fn().mockResolvedValue(undefined),
}))

const mockOpenExternalUrl = vi.mocked(openExternalUrl)
const mockOpenLocalFile = vi.mocked(openLocalFile)

function fileBlockClickTarget(blockId = 'file-block', actionTarget?: HTMLElement) {
  const blockContainer = document.createElement('div')
  blockContainer.setAttribute('data-node-type', 'blockContainer')
  blockContainer.dataset.id = blockId

  const fileBlock = document.createElement('div')
  fileBlock.setAttribute('data-file-block', '')

  const fileName = actionTarget ?? document.createElement('span')
  if (!actionTarget) {
    fileName.className = 'bn-file-name-with-icon'
    fileName.textContent = 'report.pdf'
  }

  fileBlock.appendChild(fileName)
  blockContainer.appendChild(fileBlock)
  return fileName
}

function clickRequest(target: HTMLElement) {
  return {
    target,
    preventDefault: vi.fn(),
    stopPropagation: vi.fn(),
  }
}

describe('handleEditorFileBlockClick', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it.each([
    {
      blockId: 'file-block',
      blockType: 'file',
      url: 'asset://localhost/%2Fvault%2Fattachments%2Freport.pdf',
      expectedPath: '/vault/attachments/report.pdf',
    },
    {
      blockId: 'image-block',
      blockType: 'image',
      url: 'asset://localhost/%2Fvault%2Fattachments%2Fphoto.png',
      expectedPath: '/vault/attachments/photo.png',
    },
  ])('opens $blockType block names through the active vault path', ({
    blockId,
    blockType,
    expectedPath,
    url,
  }) => {
    const event = clickRequest(fileBlockClickTarget(blockId))
    const editor = {
      getBlock: vi.fn(() => ({
        type: blockType,
        props: { url },
      })),
    }

    expect(handleEditorFileBlockClick({
      event: event as never,
      editor,
      vaultPath: '/vault',
    })).toBe(true)

    expect(event.preventDefault).toHaveBeenCalledTimes(1)
    expect(event.stopPropagation).toHaveBeenCalledTimes(1)
    expect(mockOpenLocalFile).toHaveBeenCalledWith(expectedPath, '/vault')
    expect(mockOpenExternalUrl).not.toHaveBeenCalled()
  })

  it('opens nested relative attachment download anchors through the active vault path', () => {
    const downloadLink = document.createElement('a')
    downloadLink.setAttribute('href', 'attachments/Areas/Work/project/A.docx')
    downloadLink.setAttribute('download', '')
    downloadLink.textContent = 'Download file'
    const event = clickRequest(fileBlockClickTarget('nested-file-block', downloadLink))
    const editor = {
      getBlock: vi.fn(() => ({
        type: 'file',
        props: { url: 'attachments/Areas/Work/project/A.docx' },
      })),
    }

    expect(handleEditorFileBlockClick({
      event: event as never,
      editor,
      vaultPath: '/vault',
    })).toBe(true)

    expect(event.preventDefault).toHaveBeenCalledTimes(1)
    expect(event.stopPropagation).toHaveBeenCalledTimes(1)
    expect(mockOpenLocalFile).toHaveBeenCalledWith(
      '/vault/attachments/Areas/Work/project/A.docx',
      '/vault',
    )
    expect(mockOpenExternalUrl).not.toHaveBeenCalled()
  })

  it('consumes stale file block clicks without opening or crashing', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const event = clickRequest(fileBlockClickTarget('stale-file-block'))
    const editor = {
      getBlock: vi.fn(() => {
        throw new Error('Block with ID stale-file-block not found')
      }),
    }

    expect(() => {
      expect(handleEditorFileBlockClick({
        event: event as never,
        editor,
        vaultPath: '/vault',
      })).toBe(true)
    }).not.toThrow()

    expect(event.preventDefault).toHaveBeenCalledTimes(1)
    expect(event.stopPropagation).toHaveBeenCalledTimes(1)
    expect(warn).toHaveBeenCalledWith(
      '[file] Ignored stale file block click:',
      expect.any(Error),
    )
    expect(mockOpenLocalFile).not.toHaveBeenCalled()
    expect(mockOpenExternalUrl).not.toHaveBeenCalled()
    warn.mockRestore()
  })

  it('ignores clicks outside file block actions', () => {
    const target = document.createElement('div')
    const event = clickRequest(target)

    expect(handleEditorFileBlockClick({
      event: event as never,
      editor: { getBlock: vi.fn() },
      vaultPath: '/vault',
    })).toBe(false)

    expect(event.preventDefault).not.toHaveBeenCalled()
    expect(event.stopPropagation).not.toHaveBeenCalled()
    expect(mockOpenLocalFile).not.toHaveBeenCalled()
    expect(mockOpenExternalUrl).not.toHaveBeenCalled()
  })
})

export function isBlankEditorDocument(blocks: unknown[]): boolean {
  if (blocks.length !== 1) return false
  const [block] = blocks as Array<{ type?: string; content?: unknown[] }>
  return (block?.type === 'paragraph' || block?.type === 'heading') && (!block.content || block.content.length === 0)
}

export function editorDocumentSignature(blocks: unknown[]): string {
  return JSON.stringify(blocks.map(blockSignature))
}

function blockSignature(block: unknown): unknown {
  if (!isRecord(block)) return null
  return {
    type: block.type,
    props: block.props,
    content: inlineContentSignature(block.content),
    children: Array.isArray(block.children) ? block.children.map(blockSignature) : [],
  }
}

function inlineContentSignature(content: unknown): unknown[] {
  if (!Array.isArray(content)) return []
  return content.map((item) => {
    if (!isRecord(item)) return item
    return {
      type: item.type,
      text: item.text,
      content: inlineContentSignature(item.content),
    }
  })
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

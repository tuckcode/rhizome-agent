import { EditorContentLayout } from './editor-content/EditorContentLayout'
import { useEditorContentModel, type EditorContentProps } from './editor-content/useEditorContentModel'

export function EditorContent(props: EditorContentProps) {
  const model = useEditorContentModel(props)
  return <EditorContentLayout {...model} />
}

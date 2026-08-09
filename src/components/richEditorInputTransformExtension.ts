import { createArrowLigatureInputTransform } from './arrowLigaturesExtension'
import { createMarkdownHighlightInputTransform } from './markdownHighlightInputExtension'
import { createMathInputTransform } from './mathInputExtension'
import { createRichEditorInputTransformExtension } from './richEditorInputTransform'

export const createRichEditorMarkdownInputTransformExtension = createRichEditorInputTransformExtension({
  createTransforms: () => [
    createArrowLigatureInputTransform(),
    createMarkdownHighlightInputTransform(),
    createMathInputTransform(),
  ],
  key: 'richEditorMarkdownInputTransform',
})

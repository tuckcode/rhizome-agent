import assert from 'node:assert/strict'
import test from 'node:test'

import { normalizeDocPath, sectionForFile, stripHtmlComments } from './build-agent-docs.mjs'

test('normalizes Windows doc paths before section grouping', () => {
  const docPath = normalizeDocPath('concepts\\ai.md')

  assert.equal(docPath, 'concepts/ai.md')
  assert.equal(sectionForFile(docPath), 'concepts')
})

test('strips nested and overlapping HTML comments until none remain', () => {
  const input = [
    'Keep before',
    '<!-- simple -->',
    '<!-- outer <!-- nested --> leftover -->',
    '<!<!-- -->-->',
    'Keep after',
  ].join('\n')

  const stripped = stripHtmlComments(input)

  assert.equal(stripped.includes('<!--'), false)
  assert.equal(stripped.includes('simple'), false)
  assert.equal(stripped.includes('nested'), false)
  assert.match(stripped, /Keep before/)
  assert.match(stripped, /Keep after/)
})

import assert from 'node:assert/strict'
import test from 'node:test'

import { normalizeDocPath, sectionForFile } from './build-agent-docs.mjs'

test('normalizes Windows doc paths before section grouping', () => {
  const docPath = normalizeDocPath('concepts\\ai.md')

  assert.equal(docPath, 'concepts/ai.md')
  assert.equal(sectionForFile(docPath), 'concepts')
})

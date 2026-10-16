import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'

import { checkPagesArtifact, contained } from './check-pages-artifact.mjs'

test('contained rejects paths that leave the artifact root', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'pages-artifact-'))
  try {
    assert.equal(contained(root, 'docs', 'index.html'), path.resolve(root, 'docs', 'index.html'))
    assert.equal(contained(root, 'docs', '..', '..', 'etc', 'passwd'), null)
  } finally {
    fs.rmSync(root, { recursive: true, force: true })
  }
})

test('checkPagesArtifact reports a missing landing page', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'pages-artifact-'))
  try {
    const { errors } = checkPagesArtifact(root)
    assert.ok(errors.includes('missing index.html'))
    assert.ok(errors.includes('missing docs/index.html'))
  } finally {
    fs.rmSync(root, { recursive: true, force: true })
  }
})

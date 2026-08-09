import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'

import { buildReleaseHistoryPage } from '../src/utils/releaseHistoryPage'

function getArg(flag: string): string {
  const index = process.argv.indexOf(flag)
  const value = index >= 0 ? process.argv[index + 1] : null

  if (!value) {
    throw new Error(`Missing required argument: ${flag}`)
  }

  return value
}

function readReleasePayload(filePath: string): unknown {
  try {
    return JSON.parse(readFileSync(filePath, 'utf8'))
  } catch {
    return []
  }
}

const releasesJsonPath = resolve(getArg('--releases-json'))
const outputFilePath = resolve(getArg('--output-file'))
const releasesPayload = readReleasePayload(releasesJsonPath)
const html = buildReleaseHistoryPage(releasesPayload)

mkdirSync(dirname(outputFilePath), { recursive: true })
writeFileSync(outputFilePath, html)

console.log(`Release history page written to ${outputFilePath}`)

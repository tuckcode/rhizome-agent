#!/usr/bin/env node
// Checks the composed GitHub Pages artifact: landing page at the root,
// Starlight at /docs, with asset and page URLs under /rhizome-agent/docs/.
import fs from 'node:fs'
import path from 'node:path'

const DOCS_BASE = '/rhizome-agent/docs'
const root = process.argv[2]
if (!root) {
  console.error('usage: node website/check-pages-artifact.mjs <artifact-dir>')
  process.exit(2)
}

const errors = []

function exists(rel) {
  return fs.existsSync(path.join(root, rel))
}

function mustExist(rel) {
  if (!exists(rel)) errors.push(`missing ${rel}`)
}

mustExist('index.html')
mustExist('assets/icon.png')
mustExist('assets/hero.png')
mustExist('.nojekyll')
mustExist('docs/index.html')

const landing = fs.readFileSync(path.join(root, 'index.html'), 'utf8')
if (!/\bhref="docs\/"/.test(landing)) {
  errors.push('landing page has no relative href="docs/" link')
}
if (landing.includes('/_astro/')) {
  errors.push('landing page unexpectedly contains Starlight /_astro/ assets')
}

function resolveRootRelative(fromFile, url) {
  const bare = url.split('#')[0].split('?')[0]
  if (!bare || bare.startsWith('/') || /^[a-z][a-z0-9+.-]*:/i.test(bare)) return null
  const dest = path.join(path.dirname(fromFile), bare)
  if (fs.existsSync(dest) && fs.statSync(dest).isFile()) return dest
  if (fs.existsSync(path.join(dest, 'index.html'))) return path.join(dest, 'index.html')
  return false
}

for (const match of landing.matchAll(/(?:href|src)="([^"]+)"/g)) {
  const url = match[1]
  const resolved = resolveRootRelative(path.join(root, 'index.html'), url)
  if (resolved === false) errors.push(`index.html: broken ${url}`)
}

function resolveDocsUrl(url) {
  const bare = url.split('#')[0].split('?')[0]
  if (bare !== DOCS_BASE && !bare.startsWith(`${DOCS_BASE}/`)) return null
  const rest = bare === DOCS_BASE || bare === `${DOCS_BASE}/`
    ? ''
    : bare.slice(`${DOCS_BASE}/`.length)
  const dest = path.join(root, 'docs', rest)
  if (fs.existsSync(dest) && fs.statSync(dest).isFile()) return dest
  if (fs.existsSync(path.join(dest, 'index.html'))) return path.join(dest, 'index.html')
  const html = dest.endsWith('.html') ? dest : `${dest.replace(/\/$/, '')}.html`
  if (fs.existsSync(html)) return html
  return false
}

function walkHtml(dir, fn) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, ent.name)
    if (ent.isDirectory()) walkHtml(full, fn)
    else if (ent.name.endsWith('.html')) fn(full)
  }
}

let astroAssetHits = 0
let pageLinkHits = 0

walkHtml(path.join(root, 'docs'), (file) => {
  const rel = path.relative(root, file)
  const html = fs.readFileSync(file, 'utf8')
  for (const match of html.matchAll(/(?:href|src)="([^"]+)"/g)) {
    const url = match[1]
    if (
      url.startsWith('http:') ||
      url.startsWith('https:') ||
      url.startsWith('mailto:') ||
      url.startsWith('data:') ||
      url.startsWith('#')
    ) {
      continue
    }
    if (url.startsWith('/_astro/') || url === '/favicon.png' || url.startsWith('/favicon.')) {
      errors.push(`${rel}: asset missing base path: ${url}`)
      continue
    }
    const resolved = resolveDocsUrl(url)
    if (resolved === null) continue
    if (url.includes('/_astro/')) astroAssetHits += 1
    else pageLinkHits += 1
    if (resolved === false) errors.push(`${rel}: broken ${url}`)
  }
})

if (astroAssetHits === 0) {
  errors.push('no /rhizome-agent/docs/_astro/ assets found in docs HTML')
}
if (pageLinkHits === 0) {
  errors.push('no /rhizome-agent/docs/ page links found in docs HTML')
}

if (errors.length > 0) {
  console.error('Pages artifact check failed:')
  for (const err of errors) console.error(`  - ${err}`)
  process.exit(1)
}

console.log(
  `Pages artifact OK: landing at /, Starlight at /docs, ${astroAssetHits} asset URL(s) and ${pageLinkHits} page URL(s) under ${DOCS_BASE}/`,
)

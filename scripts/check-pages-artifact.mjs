#!/usr/bin/env node
// Checks the composed GitHub Pages artifact: landing page at the root,
// Starlight at /docs, with asset and page URLs under /rhizome-agent/docs/.
import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

const DOCS_BASE = '/rhizome-agent/docs'

export function contained(root, ...parts) {
  const base = path.resolve(root)
  const joined = path.join(base, ...parts)
  const fullPath = path.normalize(joined)
  const prefix = base.endsWith(path.sep) ? base : `${base}${path.sep}`
  if (fullPath !== base && !fullPath.startsWith(prefix)) return null
  return fullPath
}

function skipExternal(url) {
  return (
    url.startsWith('http:') ||
    url.startsWith('https:') ||
    url.startsWith('mailto:') ||
    url.startsWith('data:') ||
    url.startsWith('#')
  )
}

function fileOrIndex(fullPath) {
  if (!fullPath) return false
  if (fs.existsSync(fullPath) && fs.statSync(fullPath).isFile()) return fullPath
  const index = contained(fullPath, 'index.html')
  if (index && fs.existsSync(index)) return index
  if (fullPath.endsWith('.html') && fs.existsSync(fullPath)) return fullPath
  const asHtml = `${fullPath.replace(/\/$/, '')}.html`
  if (asHtml.startsWith(path.dirname(fullPath)) && fs.existsSync(asHtml)) return asHtml
  return false
}

function resolveRootRelative(root, fromFile, url) {
  const bare = url.split('#')[0].split('?')[0]
  if (!bare || bare.startsWith('/') || /^[a-z][a-z0-9+.-]*:/i.test(bare)) return null
  const fromDir = path.dirname(fromFile)
  const dest = contained(fromDir, bare)
  if (!dest) return false
  if (!contained(root, path.relative(root, dest))) return false
  return fileOrIndex(dest)
}

function resolveDocsUrl(root, url) {
  const bare = url.split('#')[0].split('?')[0]
  if (bare !== DOCS_BASE && !bare.startsWith(`${DOCS_BASE}/`)) return null
  const rest =
    bare === DOCS_BASE || bare === `${DOCS_BASE}/` ? '' : bare.slice(`${DOCS_BASE}/`.length)
  const dest = rest ? contained(root, 'docs', rest) : contained(root, 'docs')
  if (!dest) return false
  return fileOrIndex(dest)
}

function walkHtml(root, dir, fn) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = contained(dir, ent.name)
    if (!full || !contained(root, path.relative(root, full))) continue
    if (ent.isDirectory()) walkHtml(root, full, fn)
    else if (ent.name.endsWith('.html')) fn(full)
  }
}

function mustExist(root, errors, rel) {
  const full = contained(root, rel)
  if (!full || !fs.existsSync(full)) errors.push(`missing ${rel}`)
}

function missingBasePath(url) {
  return url.startsWith('/_astro/') || url === '/favicon.png' || url.startsWith('/favicon.')
}

export function checkPagesArtifact(root) {
  const errors = []
  mustExist(root, errors, 'index.html')
  mustExist(root, errors, 'assets/icon.png')
  mustExist(root, errors, 'assets/hero.png')
  mustExist(root, errors, '.nojekyll')
  mustExist(root, errors, 'docs/index.html')

  const landingPath = contained(root, 'index.html')
  const landing =
    landingPath && fs.existsSync(landingPath) ? fs.readFileSync(landingPath, 'utf8') : ''
  if (landing && !/\bhref="docs\/"/.test(landing)) {
    errors.push('landing page has no relative href="docs/" link')
  }
  if (landing.includes('/_astro/')) {
    errors.push('landing page unexpectedly contains Starlight /_astro/ assets')
  }

  if (landingPath) {
    for (const match of landing.matchAll(/(?:href|src)="([^"]+)"/g)) {
      const resolved = resolveRootRelative(root, landingPath, match[1])
      if (resolved === false) errors.push(`index.html: broken ${match[1]}`)
    }
  }

  let astroAssetHits = 0
  let pageLinkHits = 0
  const docsDir = contained(root, 'docs')
  if (docsDir && fs.existsSync(docsDir)) {
    walkHtml(root, docsDir, (file) => {
      const rel = path.relative(root, file)
      const html = fs.readFileSync(file, 'utf8')
      for (const match of html.matchAll(/(?:href|src)="([^"]+)"/g)) {
        const url = match[1]
        if (skipExternal(url)) continue
        if (missingBasePath(url)) {
          errors.push(`${rel}: asset missing base path: ${url}`)
          continue
        }
        const resolved = resolveDocsUrl(root, url)
        if (resolved === null) continue
        if (url.includes('/_astro/')) astroAssetHits += 1
        else pageLinkHits += 1
        if (resolved === false) errors.push(`${rel}: broken ${url}`)
      }
    })
  }

  if (astroAssetHits === 0) {
    errors.push('no /rhizome-agent/docs/_astro/ assets found in docs HTML')
  }
  if (pageLinkHits === 0) {
    errors.push('no /rhizome-agent/docs/ page links found in docs HTML')
  }

  return { errors, astroAssetHits, pageLinkHits }
}

function main() {
  const root = process.argv[2]
  if (!root) {
    console.error('usage: node scripts/check-pages-artifact.mjs <artifact-dir>')
    process.exit(2)
  }
  const artifactRoot = path.resolve(root)
  const { errors, astroAssetHits, pageLinkHits } = checkPagesArtifact(artifactRoot)
  if (errors.length > 0) {
    console.error('Pages artifact check failed:')
    for (const err of errors) console.error(`  - ${err}`)
    process.exit(1)
  }
  console.log(
    `Pages artifact OK: landing at /, Starlight at /docs, ${astroAssetHits} asset URL(s) and ${pageLinkHits} page URL(s) under ${DOCS_BASE}/`,
  )
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main()
}

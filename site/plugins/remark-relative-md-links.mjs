// Rewrites file-relative Markdown links (`../concepts/ai.md#tools`) into
// Starlight routes (`/rhizome-agent/docs/concepts/ai/#tools`).
//
// Source pages keep `.md` links so they also work on GitHub and in the
// in-app agent-docs bundle that scripts/build-agent-docs.mjs generates.
import path from 'node:path'

const DOCS_DIR = path.join('src', 'content', 'docs')

function visit(node, fn) {
  fn(node)
  if (node.children) for (const child of node.children) visit(child, fn)
}

function slugFor(docPath) {
  const withoutExt = docPath.replace(/\.mdx?$/, '')
  if (withoutExt === 'index') return ''
  return withoutExt.replace(/\/index$/, '').toLowerCase() + '/'
}

export default function remarkRelativeMdLinks({ base = '/' } = {}) {
  const prefix = base.endsWith('/') ? base : `${base}/`
  return (tree, file) => {
    const filePath = file.path ?? file.history?.[0]
    if (!filePath) return
    const marker = filePath.lastIndexOf(DOCS_DIR)
    if (marker === -1) return
    const docsRoot = filePath.slice(0, marker + DOCS_DIR.length)
    const fromDir = path.dirname(path.relative(docsRoot, filePath))

    visit(tree, (node) => {
      if (node.type !== 'link' && node.type !== 'definition') return
      const url = node.url
      if (!url || /^[a-z][a-z0-9+.-]*:/i.test(url) || url.startsWith('/') || url.startsWith('#')) return
      const [target, hash] = url.split('#')
      if (!/\.mdx?$/.test(target)) return
      const resolved = path.posix.normalize(path.posix.join(fromDir.split(path.sep).join('/'), target))
      if (resolved.startsWith('..')) return
      node.url = `${prefix}${slugFor(resolved)}${hash ? `#${hash}` : ''}`
    })
  }
}

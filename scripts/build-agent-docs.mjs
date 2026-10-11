import { access, mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

const repoRoot = path.resolve(import.meta.dirname, '..')
// Starlight source pages. The site build (site/) and this bundle read the same files.
const siteRoot = path.join(repoRoot, 'site', 'src', 'content', 'docs')
const outputRoot = path.join(repoRoot, 'src-tauri', 'resources', 'agent-docs')

const sectionOrder = ['start', 'concepts', 'guides', 'reference', 'troubleshooting']
const ignoredDirs = new Set(['node_modules', '.DS_Store'])

function titleFromSlug(slug) {
  return slug
    .replace(/[-_]+/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
}

function stripFrontmatter(markdown) {
  return markdown.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/, '')
}

/** Reads flat `key: value` lines from YAML frontmatter. Enough for title and description. */
export function readFrontmatter(markdown) {
  const match = markdown.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n/)
  const fields = {}
  if (!match) return fields
  for (const line of match[1].split(/\r?\n/)) {
    const field = line.match(/^([A-Za-z_][\w-]*):\s*(.*)$/)
    if (!field) continue
    let value = field[2].trim()
    if (value.startsWith('"') && value.endsWith('"')) {
      try { value = JSON.parse(value) } catch { value = value.slice(1, -1) }
    } else if (value.startsWith("'") && value.endsWith("'")) {
      value = value.slice(1, -1).replaceAll("''", "'")
    }
    fields[field[1]] = value
  }
  return fields
}

/** Maintainer notes (`<!-- … -->`) stay in the source and the website HTML, not in the agent bundle. */
export function stripHtmlComments(markdown) {
  return markdown.replace(/<!--[\s\S]*?-->\n?/g, '')
}

function firstHeading(markdown, fallback) {
  const match = markdown.match(/^#\s+(.+)$/m)
  return match?.[1]?.trim() || fallback
}

export function normalizeDocPath(relativePath) {
  return relativePath.replaceAll(path.win32.sep, '/')
}

export function sectionForFile(relativePath) {
  const [firstPart] = relativePath.split('/')
  if (firstPart === 'index.md') return 'home'
  return firstPart.replace(/\.md$/, '')
}

async function listMarkdownFiles(dir, base = dir) {
  const entries = await readdir(dir, { withFileTypes: true })
  const files = []

  for (const entry of entries) {
    if (ignoredDirs.has(entry.name)) continue

    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      files.push(...await listMarkdownFiles(fullPath, base))
    } else if (entry.isFile() && /\.mdx?$/.test(entry.name)) {
      files.push(normalizeDocPath(path.relative(base, fullPath)))
    }
  }

  return files
}

function sortDocs(files) {
  return files.sort((a, b) => {
    const sectionDiff = sectionOrder.indexOf(sectionForFile(a)) - sectionOrder.indexOf(sectionForFile(b))
    if (sectionDiff !== 0) return sectionDiff
    return a.localeCompare(b)
  })
}

function docUrl(relativePath) {
  const withoutExt = relativePath.replace(/(^|\/)index\.mdx?$/, '$1').replace(/\.mdx?$/, '')
  return `/${withoutExt}`.replace(/\/$/, '/') || '/'
}

function formatDoc(doc) {
  return `# ${doc.title}\n\nSource: ${doc.path}\nURL: ${doc.url}\n\n${doc.content}`
}

function groupDocsBySection(docs) {
  const bySection = new Map()

  for (const doc of docs) {
    const docsInSection = bySection.get(doc.section) ?? []
    docsInSection.push(doc)
    bySection.set(doc.section, docsInSection)
  }

  return bySection
}

function buildIndex(docs) {
  const bySection = groupDocsBySection(docs)
  const lines = [
    '# Rhizome docs',
    '',
    'These docs describe Rhizome: the agent, its memory vault, and the views around them.',
    '',
    'Start here, then use `rg` over this folder for specific Rhizome concepts and workflows.',
    '',
    'When users ask how to improve a knowledge base, structure notes, choose types, model relationships, or make a vault easier for humans and agents to use, treat Portent as Rhizome\'s default best-practice model. Read `pages/guides/structure-with-portent.md` and combine it with the Rhizome concepts for types, relationships, properties, Inbox, archive, and custom views.',
    '',
  ]

  for (const section of ['home', ...sectionOrder]) {
    const docsInSection = bySection.get(section)
    if (!docsInSection?.length) continue

    lines.push(`## ${titleFromSlug(section)}`, '')
    for (const doc of docsInSection) {
      lines.push(`- [${doc.title}](pages/${doc.path})${doc.description ? `: ${doc.description}` : ''}`)
    }
    lines.push('')
  }

  lines.push('## Generated files', '')
  lines.push('- `all.md`: all public docs concatenated for fast full-context reads.')
  lines.push('- `search-index.json`: title, heading, section, path, and URL metadata for quick routing.')
  lines.push('- `<section>.md`: one compact bundle per docs section.')
  lines.push('- `pages/`: one generated Markdown file per public docs page.')
  lines.push('')

  return lines.join('\n')
}

function buildAgentInstructions() {
  return `# AGENTS.md: Rhizome docs bundle

These are Rhizome's product docs. Read them before you answer a question about how Rhizome works, or before you assume how it behaves. Rhizome changes fast, so when a page and the app disagree, trust the app and say so.

## Lookup

1. Read the active vault's \`AGENTS.md\` for that vault's conventions. Vault conventions win for content; these docs win for product behavior.
2. Open \`index.md\` here for the map.
3. Search this folder with \`rg\` and open the page that matches the question.

## Where answers live

- **Engines, models, keys, tools, permission modes:** \`pages/concepts/ai.md\`, \`pages/guides/configure-ai-models.md\`
- **Free tier (auto) and provider fallback:** \`pages/concepts/free-models-and-routing.md\`
- **Saving to the vault, recall, Claude Code import:** \`pages/concepts/vault-as-memory.md\`, \`pages/guides/import-a-session.md\`
- **Sessions, resuming and saved chats:** \`pages/guides/sessions.md\`
- **Where a Prime run went, which files it touched:** \`pages/concepts/mycelium.md\`
- **Install, first launch, opening a vault, preview limits:** \`pages/start/\`, \`pages/reference/platforms-and-updates.md\`
- **Chat fails or a provider won't connect:** \`pages/troubleshooting/chat-doesnt-answer.md\` and the rest of \`pages/troubleshooting/\`
- **Shortcuts:** \`pages/reference/keyboard-shortcuts.md\`
- **Structuring a vault (types, relationships, Inbox, views):** \`pages/concepts/\` and \`pages/guides/\`; the default structure is Portent, in \`pages/guides/structure-with-portent.md\`

## When you write to the vault

Save what the user asked to keep. Keep secrets out of notes: vault notes are committed and can be pushed.
`
}

function searchIndexFor(doc) {
  const headings = [...doc.content.matchAll(/^#{2,3}\s+(.+)$/gm)].map((match) => match[1].trim())
  return {
    title: doc.title,
    description: doc.description,
    path: `pages/${doc.path}`,
    url: doc.url,
    section: doc.section,
    headings,
  }
}

async function main() {
  try {
    await access(siteRoot)
  } catch {
    console.log('site/src/content/docs is not present; leaving existing src-tauri/resources/agent-docs unchanged')
    return
  }

  const files = sortDocs(await listMarkdownFiles(siteRoot))
  const docs = []

  for (const relativePath of files) {
    const raw = await readFile(path.join(siteRoot, relativePath), 'utf8')
    const frontmatter = readFrontmatter(raw)
    const content = stripHtmlComments(stripFrontmatter(raw)).trim()
    const fallbackTitle = titleFromSlug(path.basename(relativePath).replace(/\.mdx?$/, ''))
    docs.push({
      content,
      description: frontmatter.description ?? '',
      path: relativePath.replace(/\.mdx$/, '.md'),
      section: sectionForFile(relativePath),
      title: frontmatter.title || firstHeading(content, fallbackTitle),
      url: docUrl(relativePath),
    })
  }

  await rm(outputRoot, { force: true, recursive: true })
  await mkdir(outputRoot, { recursive: true })

  await writeFile(path.join(outputRoot, 'AGENTS.md'), buildAgentInstructions())
  await writeFile(path.join(outputRoot, 'index.md'), buildIndex(docs))
  await writeFile(path.join(outputRoot, 'all.md'), docs.map(formatDoc).join('\n\n---\n\n'))
  await writeFile(path.join(outputRoot, 'search-index.json'), `${JSON.stringify(docs.map(searchIndexFor), null, 2)}\n`)

  for (const doc of docs) {
    const outputPath = path.join(outputRoot, 'pages', doc.path)
    await mkdir(path.dirname(outputPath), { recursive: true })
    await writeFile(outputPath, formatDoc(doc))
  }

  const bySection = groupDocsBySection(docs)
  for (const [section, docsInSection] of bySection) {
    await writeFile(
      path.join(outputRoot, `${section}.md`),
      docsInSection.map(formatDoc).join('\n\n---\n\n'),
    )
  }

  console.log(`Generated ${docs.length} agent docs in ${path.relative(repoRoot, outputRoot)}`)
}

const entrypointUrl = process.argv[1] ? pathToFileURL(process.argv[1]).href : ''

if (import.meta.url === entrypointUrl) {
  main().catch((error) => {
    console.error(error)
    process.exit(1)
  })
}

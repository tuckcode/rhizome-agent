// @ts-check
import { defineConfig } from 'astro/config'
import starlight from '@astrojs/starlight'
import { unified } from '@astrojs/markdown-remark'
import starlightLinksValidator from 'starlight-links-validator'
import remarkRelativeMdLinks from './plugins/remark-relative-md-links.mjs'

// Published under the landing page at https://tuckcode.github.io/rhizome-agent/docs/
const base = '/rhizome-agent/docs'

export default defineConfig({
  site: 'https://tuckcode.github.io',
  base,
  trailingSlash: 'always',
  markdown: {
    // Starlight's own remark plugins need the unified processor (Astro 7 defaults to Sätteri).
    processor: unified({ remarkPlugins: [[remarkRelativeMdLinks, { base }]] }),
  },
  integrations: [
    starlight({
      title: 'Rhizome',
      description: 'Docs for Rhizome, a desktop app for an AI agent whose memory is a folder of Markdown notes you own.',
      favicon: '/favicon.png',
      social: [
        { icon: 'github', label: 'GitHub', href: 'https://github.com/tuckcode/rhizome-agent' },
      ],
      editLink: {
        baseUrl: 'https://github.com/tuckcode/rhizome-agent/edit/main/site/',
      },
      lastUpdated: false,
      customCss: ['./src/styles/earth.css'],
      plugins: [starlightLinksValidator({ errorOnRelativeLinks: false })],
      sidebar: [
        {
          label: 'Start',
          items: [
            'start/why-rhizome',
            'start/install',
            'start/first-launch',
            'start/open-or-create-vault',
            'guides/coming-from-other-harnesses',
          ],
        },
        {
          label: 'What makes Rhizome different',
          items: [
            'concepts/vault-as-memory',
            'concepts/mycelium',
            'concepts/wiki-graph',
            'concepts/free-models-and-routing',
            'concepts/ai',
          ],
        },
        {
          label: 'Work with the agent',
          items: [
            'guides/use-ai-panel',
            'guides/sessions',
            'guides/configure-ai-models',
            'guides/import-a-session',
          ],
        },
        {
          label: 'Your vault',
          items: [
            'concepts/vaults',
            'concepts/notes',
            'concepts/editor',
            'concepts/files-and-media',
            'concepts/types',
            'concepts/properties',
            'concepts/relationships',
            'concepts/inbox',
            'concepts/spreadsheets',
            'concepts/git',
          ],
        },
        {
          label: 'How-to',
          items: [
            'guides/capture-a-note',
            'guides/organize-inbox',
            'guides/create-types',
            'guides/build-custom-views',
            'guides/use-spreadsheets',
            'guides/commit-and-push',
            'guides/connect-a-git-remote',
            'guides/structure-with-portent',
            'guides/manage-display-preferences',
            'guides/use-command-palette',
          ],
        },
        {
          label: 'Reference',
          items: [
            'reference/keyboard-shortcuts',
            'reference/frontmatter-fields',
            'reference/view-filters',
            'reference/file-layout',
            'reference/spreadsheet-format',
            'reference/spreadsheet-functions',
            'reference/platforms-and-updates',
            'reference/credits',
            'reference/contribute',
          ],
        },
        {
          label: 'Troubleshooting',
          items: [
            'troubleshooting/chat-doesnt-answer',
            'troubleshooting/ai-agent-not-found',
            'troubleshooting/model-provider-connection',
            'troubleshooting/vault-not-loading',
            'troubleshooting/git-auth',
            'troubleshooting/sync-conflicts',
          ],
        },
      ],
    }),
  ],
})

import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores([
    'dist',
    'coverage',
    'src-tauri/resources/mcp-server/',
    'src-tauri/target/',
    'src-tauri/gen/',
    'tools/',
    // Untracked plugin-marketplace scaffold (my-marketplace/). Not part of
    // the app source tree; an unrelated lint error there must not gate
    // every commit of the tracked frontend. Mirrors the `tools/` precedent.
    'my-marketplace/',
    // Playwright's output. It is build product, never source — and it is
    // *deleted and recreated* at the start of a run, so a lint walking the
    // tree while the smoke lane starts crashes on a directory that vanished
    // mid-glob. That became reachable when the pre-push gates started running
    // their lanes concurrently (C37); it was always wrong to lint it.
    'test-results/',
    'playwright-report/',
    'blob-report/',
    // Nested worktrees (.claude/worktrees/<name>/) are separate checkouts
    // with their own src-tauri/gen/ etc. — the anchored ignores above don't
    // reach inside them, so a project-wide `eslint .` from the main tree
    // would otherwise lint whatever generated/build artifacts happen to
    // exist in a sibling worktree at the time.
    '.claude/worktrees/',
    // Cursor / Agent isolation worktrees at repo-root `.worktrees/<name>/`
    // (same nested-checkout lint hazard as `.claude/worktrees/`).
    '.worktrees/',
    // Same hazard, different location: worktrees also land at
    // `rhizome-agent/<branch-name>/` — a full second checkout nested inside
    // this one. `.gitignore` keeps it out of commits but eslint walks it
    // anyway, and it broke a push on generated `src-tauri/gen/apple/assets/`
    // files that are not this tree's source at all.
    'rhizome-agent/',
    // Starlight build product. `cd site && npm run build` writes generated
    // `.d.ts` under site/.astro/; those files are gitignored, but eslint
    // walks them anyway and fails the frontend lane after a local docs
    // build. Same class as playwright-report/ and src-tauri/gen/.
    'site/.astro/',
    'site/dist/',
    'site/node_modules/',
  ]),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
  },
])

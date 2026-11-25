import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

const designTokenRule = {
  meta: {
    schema: [],
    messages: {
      textSize: 'Use a text size token from src/index.css.',
      fontSize: 'Use a text size token instead of a static fontSize.',
      color: 'Use a color token from src/index.css.',
    },
  },
  create(context) {
    const isComponent = /[\\/]src[\\/]components[\\/]/.test(context.filename)
      || context.filename.endsWith('.tsx')
    const pixelTextClass = /(?:^|[\s:'"`!])text-\[(?:length:)?(?:\d+(?:\.\d+)?|\.\d+)px\]/
    const rawColor = /(?:^|[\s[(:,_])#(?:[\da-f]{8}|[\da-f]{6}|[\da-f]{4}|[\da-f]{3})(?=$|[\s\]),/!_])|\b(?:rgba?|hsla?)\(/i

    function checkString(node, value) {
      if (pixelTextClass.test(value)) context.report({ node, messageId: 'textSize' })
      if (isComponent && rawColor.test(value)) context.report({ node, messageId: 'color' })
    }

    return {
      Literal(node) {
        if (typeof node.value === 'string') checkString(node, node.value)
      },
      TemplateElement(node) {
        checkString(node, node.value.raw)
      },
      Property(node) {
        const name = node.key.type === 'Identifier' && !node.computed ? node.key.name : node.key.value
        if (name !== 'fontSize' && name !== 'font-size') return

        const value = node.value
        const isStaticSize = value.type === 'Literal'
          ? typeof value.value === 'number' || (typeof value.value === 'string' && !value.value.includes('var('))
          : value.type === 'TemplateLiteral' && value.expressions.length === 0 && !value.quasis[0].value.raw.includes('var(')
        if (isStaticSize) context.report({ node, messageId: 'fontSize' })
      },
    }
  },
}

// Remove a file from this list after its type and color tokens are migrated.
const legacyDesignTokenFiles = [
  'src/components/AddPropertyForm.tsx',
  'src/components/AgentActivityBand.tsx',
  'src/components/AiActionCard.tsx',
  'src/components/AiMessage.tsx',
  'src/components/AiPanelChrome.tsx',
  'src/components/AiWorkspace.tsx',
  'src/components/AiWorkspaceChrome.tsx',
  'src/components/AiWorkspaceSideHeader.tsx',
  'src/components/AiWorkspaceSidebar.tsx',
  'src/components/ArchivedNoteBanner.tsx',
  'src/components/AskChatExcerptMenu.tsx',
  'src/components/BashResultCard.tsx',
  'src/components/BulkActionBar.tsx',
  'src/components/ChatCommandMenu.tsx',
  'src/components/ChatComposerBar.tsx',
  'src/components/ChatComposerDeck.tsx',
  'src/components/ChatComposerFoot.tsx',
  'src/components/ChatNotePane.tsx',
  'src/components/ChatPreflightBanner.tsx',
  'src/components/ColorInput.tsx',
  'src/components/CommandPalette.tsx',
  'src/components/CommandPaletteAiMode.tsx',
  'src/components/CommandRail.tsx',
  'src/components/CommitDialog.tsx',
  'src/components/ConflictNoteBanner.tsx',
  'src/components/ConflictResolverModal.tsx',
  'src/components/ConnectedProvidersSummary.tsx',
  'src/components/DeleteProgressNotice.tsx',
  'src/components/DiffView.tsx',
  'src/components/EditableValue.tsx',
  'src/components/Editor.tsx',
  'src/components/FilePreview.tsx',
  'src/components/FilterBuilder.tsx',
  'src/components/FocusedPaneTabs.tsx',
  'src/components/FormatSelector.tsx',
  'src/components/GitRepositorySelect.tsx',
  'src/components/GitRequiredModal.tsx',
  'src/components/IconEditableValue.tsx',
  'src/components/InlineWikilinkParts.tsx',
  'src/components/KeyboardShortcutsDialog.tsx',
  'src/components/LinuxMenuButton.tsx',
  'src/components/LocalAgentCards.tsx',
  'src/components/MacOSTitlebar.tsx',
  'src/components/MenuBarCompanionApp.tsx',
  'src/components/MyceliumView.tsx',
  'src/components/NameVaultDialog.tsx',
  'src/components/NativeChatModelPicker.tsx',
  'src/components/NoteItem.tsx',
  'src/components/NoteSearchList.tsx',
  'src/components/PrimeContextMeter.tsx',
  'src/components/PrimeGoalDialog.tsx',
  'src/components/PrimeQueueItemActions.tsx',
  'src/components/PrimeSessionList.tsx',
  'src/components/PrimeSessionSubhead.tsx',
  'src/components/PropertyValueCells.tsx',
  'src/components/PulseView.tsx',
  'src/components/QuickOpenPalette.tsx',
  'src/components/RenameDetectedBanner.tsx',
  'src/components/ResearchPanel.tsx',
  'src/components/RhizomeFormatModal.tsx',
  'src/components/RlmFamilyBand.tsx',
  'src/components/ScheduledWorkPopover.tsx',
  'src/components/SearchPanel.tsx',
  'src/components/SessionActivityHistory.tsx',
  'src/components/SessionBranchBand.tsx',
  'src/components/SessionTranscriptSearchResults.tsx',
  'src/components/SettingsControls.tsx',
  'src/components/SettingsFooter.tsx',
  'src/components/SettingsPanel.tsx',
  'src/components/SidebarParts.tsx',
  'src/components/SortDropdown.tsx',
  'src/components/StatusBar.tsx',
  'src/components/StatusDropdown.tsx',
  'src/components/TableOfContentsPanel.tsx',
  'src/components/TagsDropdown.tsx',
  'src/components/TelemetryConsentDialog.tsx',
  'src/components/Toast.tsx',
  'src/components/ToolApprovalCard.tsx',
  'src/components/TypeCustomizePopover.tsx',
  'src/components/TypeSelector.tsx',
  'src/components/UpdateBanner.tsx',
  'src/components/VersionUpdateIndicator.tsx',
  'src/components/VisibleCommand.tsx',
  'src/components/WelcomeScreen.tsx',
  'src/components/WorkspaceInitialsBadge.tsx',
  'src/components/WorkspaceSelector.tsx',
  'src/components/WorkspaceSettingsRows.tsx',
  'src/components/editor-content/EditorContentLayout.tsx',
  'src/components/filter-builder/DateValueInput.tsx',
  'src/components/folder-tree/FolderItemRow.tsx',
  'src/components/folder-tree/FolderNameInput.tsx',
  'src/components/graph/ForceGraph3DCanvas.tsx',
  'src/components/graph/GraphControls.tsx',
  'src/components/graph/GraphLegend.tsx',
  'src/components/graph/edgeColorResolver.ts',
  'src/components/graph/typeColorResolver.ts',
  'src/components/inspector/BacklinksPanel.tsx',
  'src/components/inspector/GitHistoryPanel.tsx',
  'src/components/inspector/InspectorChrome.tsx',
  'src/components/inspector/InstancesPanel.tsx',
  'src/components/inspector/LinkButton.tsx',
  'src/components/inspector/NoteInfoPanel.tsx',
  'src/components/inspector/RelationshipsPanel.tsx',
  'src/components/note-item/ChangeNoteContent.tsx',
  'src/components/note-item/PropertyChips.tsx',
  'src/components/note-list/FilterPills.tsx',
  'src/components/note-list/ListPropertiesPopover.tsx',
  'src/components/note-list/NoteListHeader.tsx',
  'src/components/note-list/TrashWarningBanner.tsx',
  'src/components/project-tree/ProjectEntryRow.tsx',
  'src/components/propertyChipStyles.ts',
  'src/components/propertyPanelLayout.ts',
  'src/components/rhizomeBlockReorder.ts',
  'src/components/rhizomeCollapsedSections.ts',
  'src/components/sidebar/FavoritesSection.tsx',
  'src/components/sidebar/SidebarGroupHeader.tsx',
  'src/components/sidebar/SidebarViewActions.tsx',
  'src/components/sidebar/SidebarViewItem.tsx',
  'src/components/status-bar/AgentActivityList.tsx',
  'src/components/status-bar/AgentsPill.tsx',
  'src/components/status-bar/StatusBarBadges.tsx',
  'src/components/status-bar/StatusBarSections.tsx',
  'src/components/status-bar/VaultMenu.tsx',
  'src/components/ui/action-tooltip.tsx',
  'src/extensions/markdownHighlight.ts',
  'src/hooks/useCodeMirror.ts',
  'src/main.tsx',
]

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
    // Screenshot harness for the provider-settings PR. It is a Vite page,
    // not an app module, and react-refresh rejects a file that exports nothing.
    'docs/screenshots/',
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
  {
    files: ['src/**/*.{js,jsx,ts,tsx}'],
    ignores: [
      '**/*.{test,spec,testUtils}.{js,jsx,ts,tsx}',
      '**/__tests__/**',
      ...legacyDesignTokenFiles,
    ],
    plugins: { rhizome: { rules: { 'design-tokens': designTokenRule } } },
    rules: { 'rhizome/design-tokens': 'error' },
  },
])

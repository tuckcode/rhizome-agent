# Display and themes

Source: guides/manage-display-preferences.md
URL: /guides/manage-display-preferences

Display settings live with the app on this computer, unless a setting is stored in a note or the vault on purpose.

## Theme

Rhizome starts in **Earth dark**. Change it in Settings → Appearance:

- **Color theme.** **Rhizome** is the Earth theme. It follows the **Theme** setting below it: Light (Earth light), Dark (Earth dark) or **Match system**, which follows your computer's light or dark setting. **Loam** is an optional warm dark skin. The other themes (Nord, Dracula, Solarized and more) are fixed skins with their own light or dark look.
- **Accent color.** Sets the colour of actions, links and highlights on the Rhizome theme. Fixed themes use their own accent.

You can also switch with **Use Light Mode**, **Use Dark Mode** and **Match System** in the command palette.

## Note width

Set the default rich-editor width in Settings:

- **Normal** for focused writing.
- **Wide** for tables, diagrams, dense notes, and generated documents.

A single note can override the default from the editor toolbar. That override is stored as `_width` in the note's frontmatter.

## Sidebar labels

**Pluralize type names in sidebar** shows "Projects" for the Project type. Turn it off to show type names as written, or set `_sidebar_label` on a type document.

## What shows in All Notes

**All Notes visibility** chooses whether PDFs, images, and other non-Markdown files appear in All Notes. Folder browsing still shows them in their folders. **Toggle Gitignored Files Visibility** in the command palette shows or hides files Git ignores.

## Closing the window

The red window button quits Rhizome. Turn on **Keep in taskbar** in Settings → Appearance to hide the window instead, so you can reopen it from the Dock or taskbar.

## Language

Settings → Appearance → **Display language**. **System** follows macOS when that language is supported. Missing translations fall back to English.
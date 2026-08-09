# Grok-Wiki UI Patterns — Rhizome Desktop Reference

Observed from the running Grok-Wiki macOS app on 2026-06-30.

## 1. Navigation

### Sidebar (⌘1-⌘5)
- Clean vertical nav with **icon + label + keyboard shortcut** for each item
- Active item has a lighter background highlight
- "Coming soon" items grayed out with no shortcut
- **Recent items section** below main nav (recent wikis, tasks, etc.)
- Search bar at top with ⌘K shortcut
- Footer: Send feedback link + "+ New" button with ⌘N
- No hamburger menus or nested navigation — everything is one level deep

### Tabs
- Each feature opens as a **tab** at the top of the content area
- Active tab has close (X) button, lighter background
- "+" button to open new tab
- Tabs persist across navigation

### Implementation for Rhizome Desktop:
Tolaria already has a sidebar and tab system. We can repurpose the existing `Sidebar.tsx` and tab infrastructure. The main changes:
- Add keyboard shortcuts (⌘1-⌘5, ⌘K, ⌘N) — Tolaria may already support these
- Add "Coming soon" state for disabled nav items
- Add recent items section in sidebar

## 2. Feature Pages (Hero Pattern)

Each feature (Wiki, Ask, Tasks, Terminal) has:
- A **large hero card** with a warm, dimly lit background image
- Small all-caps label (WIKI, ASK, TASKS, TERMINAL)
- Large serif heading
- Descriptive subtext
- Feature-specific action buttons

### Implementation for Rhizome Desktop:
- Replace generic hero images with vault/agent-themed visuals
- Keep the serif heading + descriptive subtext pattern
- Make the hero area collapsible after first use

## 3. Wiki Generation Page

### Input area:
- Large text input: "GitHub URL, owner/repo, or local path"
- "+ Add" button + "Local" folder button
- **Configuration row** below input:
  - Runtime dropdown (Grok CLI / Codex / Claude)
  - Max pages slider with tick marks + "Auto ≤ N" label
  - Format dropdown (First 30 Minutes, Technical, etc.)
  - Languages dropdown
- Toggle: Agent mode / Manual mode

### Library section:
- Search bar with filter/sort
- **Card grid** showing generated wikis:
  - Wiki cover image/icon with page count badge
  - Title
  - Description (1-2 sentences)
  - Tags (Technical, etc.)
  - Update date
  - Source file count

### Implementation for Rhizome Desktop:
- Add repo input with + Add button
- Add mode selector dropdown
- Add library grid view for generated repos/sources
- Add search/filter for library items

## 4. Ask Page

### Source input:
- Large prompt input: "What do you want to understand?"
- Source input: "GitHub URL, owner/repo, or local path" with + Add and Local
- Runtime selector + image attach button
- **"Grill Me" toggle** for deep/critical analysis mode
- **"/" tip** for Compound Engineering lenses

### Analysis lenses (pill buttons):
First row: Ideas, Root Cause, Plan, Map, Digest, Breakdown, Master
Second row: Compare, Brainstorm, Architecture, Concepts

### Implementation for Rhizome Desktop:
- Add large prompt input
- Add source input row
- Add research mode pills (Architecture, Hidden Lessons, Reusable Patterns, etc.)
- Add mode toggle for depth (Fast / Regular / Deep)

## 5. Tasks Page

### Task creation:
- Large input: "Describe the work. The first line becomes the title."
- Repo selector field
- Runtime dropdown
- Submit button
- Empty state: "No tasks yet" with descriptive subtext

## 6. Terminal Page

### Terminal config:
- Project selector (local path or GitHub URL)
- Runtime dropdown
- Model dropdown
- "Open a shell or agent terminal" placeholder
- New terminal / Open agent buttons

## 7. Visual Design Constants

### Colors:
- Background: near-black (#0d0e17 or similar)
- Text: white/cream for primary, light gray (#8a8a8a) for secondary
- Active state: lighter gray background
- Accent: white elements, green for "Detected" status
- Warm amber tones in hero images

### Typography:
- Feature labels: small all-caps, light gray
- Headings: large serif, cream/white
- Body: sans-serif, white/light gray
- UI labels: consistent sans-serif

### Spacing:
- Generous padding on cards and sections
- Rounded corners on everything (8-12px)
- Cards have subtle borders/backgrounds
- Configuration fields in horizontal rows

### Interactive elements:
- Search bar: prominent with ⌘K
- Dropdowns: clean with icon + label + value + chevron
- Toggle switches: pill-shaped
- Sliders: minimal, with tick marks
- Status indicators: green checkmark for "Detected"
- Empty states: centered text with icons

## 8. Keyboard Shortcuts (macOS)

| Shortcut | Action |
|----------|--------|
| ⌘1 | Projects |
| ⌘2 | Wiki |
| ⌘3 | Ask |
| ⌘4 | Docs |
| ⌘5 | Tasks |
| ⌘K | Search |
| ⌘N | New (wiki/task) |

## 9. Implementation Priority for Rhizome Desktop

1. **Hero cards** for each feature page — easy win, big visual impact
2. **Configuration row** for wiki generation (runtime, pages, mode, language)
3. **Library grid** for generated content
4. **Keyboard shortcuts** for sidebar navigation
5. **Research mode pills** for the Ask feature
6. **Empty states** for feature pages
7. **Tab-based navigation** (Tolaria already supports this)
8. **Status indicators** for agent/runtime status

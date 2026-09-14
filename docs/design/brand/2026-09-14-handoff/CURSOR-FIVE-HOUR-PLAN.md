# Five-hour design work queue

**Owner:** Cursor coordinator. **Design owner:** Astra, planning and design only.
This queue uses the remaining window in the active Cursor plan. It does not allocate five additional hours.
W7 security and W4 reliability retain priority. Run safe design work alongside those lanes only when paths are independent.

## Priority and time boxes

| Order | Slice | Cursor owner | Maximum effort | Done when |
|---|---|---|---|---|
| D0 | Reconcile current work and reserve validation time | Grok | 15 minutes | Current revision, occupied paths, remaining time, and selected slices are recorded. |
| D1 | Finish the approved brand adoption | Composer for files/docs, Grok for visual choices | 35 minutes | README and About use the exact organic banner without cropped copy. Existing controls work. Gallery preserves every asset. |
| D2 | Improve Chat readability and control consistency | Grok | 65 minutes | A small evidenced set of spacing, contrast, wrapping, or focus defects is corrected. Chat behavior stays intact. |
| D3 | Make existing status and recovery legible | Existing W4 owner / Grok | 45 minutes | Existing runtime states remain distinguishable in text and layout. No new state is inferred from color, timers, or image animation. |
| D4 | Place supporting artwork and improve memory provenance presentation | Grok for UX, Composer for docs | 35 minutes | Dither and ASCII have real documentation placements. Existing provenance remains readable and opens the correct source. |
| D5 | Prepare a Dock direction and website handoff | Grok | 35 minutes | A source-based icon comparison and website composition spec are reviewable. No unselected identity or native installation occurs. |
| D6 | Validate, integrate, and report | Cursor owners + coordinator | Final 45 minutes | Required checks pass or exact blockers are recorded. Owned changes form reviewable commits. Delivery state is explicit. |

The caps total 275 minutes. Keep the remaining 25 minutes of a full window for interruptions and integration.
At package receipt, subtract elapsed time. Skip D5 first, then optional D4 work. Never shorten D6 to admit more design.
Within a slice, stop when the acceptance criteria pass. Do not spend its unused allocation creating extra work.
If existing reliability/security work needs the time, reduce D2–D5 before reducing that work.

## D0 — establish the real baseline

Inspect `git status --short`, current HEAD, and commits ahead of origin. Read the current Cursor five-hour plan.
Record active ownership before modifying a shared component or token file.
The banner integration appeared in `e64a283` at handoff inspection. Verify it before touching README or About.
Capture the present Chat, Notes, About, and model-picker surfaces with synthetic content when practical.
Browser fixtures demonstrate layout only. Native evidence must identify the actual build.

**Stop:** an occupied path blocks that slice, not the whole queue. Continue independent docs or assets.

## D1 — primary artwork and archive

Review the existing About image at the app's supported minimum width and a normal desktop width.
Keep its 1774:887 aspect ratio. Keep Contribute and Docs reachable with normal scrolling and keyboard focus.
Use the original for provenance. Derive an optimized app asset only if measured cost warrants it and copy stays clear.
Preserve intrinsic dimensions. Do not decode all seven artworks on startup.
Keep the existing README lead image. Link the design gallery once.
Copy or reconcile supporting assets by exact file name and checksum. Preserve Cursor's newer documentation.

**Stop:** do not replace the favorite with dither, ASCII, or the archive alternative. Do not add a theme-wide wallpaper.

## D2 — restrained frontend polish

Use the targets and existing component map in `FRONTEND-DESIGN.md`.
Choose at most three observed defects: tiny consequential text, weak model-provider contrast, clipped controls, inconsistent spacing, or lost focus indication.
Keep existing themes, user font preferences, and established shell geometry.
Verify long model names, long session titles, a Notes split, and a long code response.

**Stop:** new navigation, rail policy, or a full token migration requires a later design slice. Do not refactor the shell to adjust spacing.

## D3 — truthful status and recovery

Coordinate with the current W4 owner. Reuse the current state contract.
Check queued, running, stopped/interrupted, failed, and transport-unknown cases only where the implementation supports them.
Use the specification's copy rules. Preserve useful failure details while excluding secrets.
Changing state semantics belongs to W4 and needs behavior tests. A design-only owner may improve presentation after coordination.

**Stop:** a missing event or ambiguous state is a W4 finding. Do not solve it with a fabricated success label.

## D4 — supporting visuals and memory continuity

Place the dither banner on the internal design/developer documentation page. Place real ASCII beside the terminal-oriented usage example there.
Keep the ASCII PNG available as artwork. Do not inject branding into machine-readable CLI output.
Review existing `From your vault` provenance before proposing a new component. Improve truncation, source-link clarity, or focus only when defective.
Read `MEMORY-DIRECTION.md` for the longer-term concept. Keep unimplemented claims out of production labels and marketing.

**Stop:** new provenance fields, state persistence, consolidation, or import routes remain separate product work.

## D5 — reviewable next steps, no forced redesign

Use Signal as Astra's continuity recommendation. Preserve one core plus five asymmetric satellites.
Compare the actual vector and small app mark with ADR-0157. Record conflicts without rewriting the old ADR as though a new decision existed.
A review-only vector study may refine spacing and legibility. Show it at 16, 24, 32, 64, and 128 pixels.
Keep generated Dock raster artwork as a reference. It has an ivory background and is not an icon master.
Prepare the website arrangement from the gallery rules. If no website lives in this repo, deliver a spec instead of creating a new site project.

**Stop:** no Dock installation, platform icon replacement, website deployment, or unselected Rootwork/Thread adoption.

## D6 — evidence and delivery

Run repository-required checks appropriate to the changes. Use existing interaction tests for visual-only edits.
For behavior changes, cover the actual regression and follow repository testing rules. Avoid new tests that merely assert CSS classes.
Check light/dark surfaces, the supported narrow width, keyboard focus, mouse paths, and reduced motion where changed.
Verify the README and gallery links from the actual repository location.
Use named paths and path-limited commits under the repository rules. Preserve other owners' index entries and dirty files.
Push only through the established passing gates. Record a blocked push without bypassing hooks.
Record native QA as unverified if no matching native build was exercised. Never substitute a mock-ready screen for a live Prime check.

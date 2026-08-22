/**
 * `window` globals the mock-Tauri layer and Playwright overrides write to.
 *
 * Ambient by necessity — nothing imports this file, TypeScript picks it up
 * from the project include (the same shape, and the same knip false positive,
 * as `rhizomeTestBridge.ts`; both are listed in `knip.json`'s `ignore`).
 *
 * Lived inside `App.tsx` until 2026-08-21. That worked only because every
 * TypeScript project that mattered happened to include `App.tsx`, which stopped
 * being true when test files got a project of their own: `mock-tauri/index.ts`
 * could no longer see the globals it sets. A global augmentation belongs with
 * the other global augmentations, not inside the component that first needed it.
 */

declare global {
  interface Window {
    __mockContent?: Record<string, string>
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- mock handler map for Playwright test overrides
    __mockHandlers?: Record<string, (args: any) => any>
  }
}

export {}

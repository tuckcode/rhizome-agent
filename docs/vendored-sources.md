# Vendored sources

**Origin:** Cursor Grok 4.6 · 2026-10-09 · convention from [ADR-0180](adr/0180-rhizome-is-its-own-harness.md)

Index of code copied into this tree from another project. Library
dependencies stay in `package.json` / `Cargo.toml` and are not listed
here.

Rhizome is AGPL-3.0. Copy only after a licence check. Permissive
licences (MIT, BSD, Apache-2.0) may be copied. Incompatible licences
stay an idea to rebuild.

Each copied file also carries a header comment (or a directory README)
with the same source, pin, and licence.

| Path | Source | Pin (commit or version) | Licence | Copied |
|---|---|---|---|---|
| `src-tauri/src/rhizome_routing/free_catalog.json` | OmniRoute `open-sse/config/freeModelCatalog.data.ts` and `open-sse/config/providers/registry/<id>/index.ts` (rows for the ADR-0182 v1 providers, curated 2026-09-12) | `fc5e2bccd4f70fecf5aab94dfb8136c74ab5a21b` | MIT | 2026-10-10 |
| `src-tauri/src/rhizome_routing/health.rs` | OmniRoute `docs/architecture/RESILIENCE_GUIDE.md` (rules only, rebuilt in Rust) | `fc5e2bccd4f70fecf5aab94dfb8136c74ab5a21b` | MIT | 2026-10-10 |

When a later session updates a copied piece, change the pin and the date
in this row. Diff against the recorded commit first.

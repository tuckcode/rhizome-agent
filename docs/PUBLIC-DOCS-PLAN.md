# Public Docs Plan (Rhizome Desktop)

Phase 1 information architecture for **public Rhizome Desktop** documentation. Public-facing source lives in `site/`; the `docs/` directory remains contributor, architecture, and agent context.

## Audiences

| Audience | Needs | Primary location |
|---|---|---|
| New users | Install, first launch, layout, starter vault | `site/start/` |
| Active users | Workflows: organize, Git sync, views, AI, Research | `site/guides/` |
| Power users | File layout, frontmatter, filters, channels, shortcuts, platforms | `site/reference/` |
| Contributors and agents | Architecture, abstractions, ADRs, dev workflow | `docs/`, `AGENTS.md` |

## Hosting shape

GitHub Pages (or equivalent) should reserve the root for public docs and mount release assets underneath:

```text
/                  public docs home
/releases/         release history
/download/         latest stable download redirect
/stable/latest.json
/alpha/latest.json
```

## Current coverage notes

The `site/` tree still contains some historical pages written for an earlier product name. Before any public launch, rewrite user-facing copy to **Rhizome Desktop** and drop third-party product marketing links that don't apply to this repo.

Topics the public site should cover when ready:

- Installers (macOS / Windows / Linux) and release channels
- Vault basics, wikilinks, projects, Unassigned
- Git sync
- AI agents + direct models
- Research panel (Generate / Import / Distill / Ask / History)
- Inbox automation
- MCP / external agent setup
- Wiki Graph
- Themes, shortcuts, localization
- Menu-bar companion (when past skeleton)

Every user-visible app change should answer:

```text
Public docs impact:
- updated: <pages>
- not needed because: <reason>
```

# Credits and licences

Source: reference/credits.md
URL: /reference/credits

Rhizome is free software under AGPL-3.0-or-later. It builds on the projects below. Copied or ported code is also listed in the repository's `THIRD_PARTY_NOTICES` and `docs/vendored-sources.md`.

| Project | Licence | What Rhizome uses |
|---|---|---|
| [Tolaria](https://github.com/refactoringhq/tolaria) by Luca Rossi | AGPL-3.0 | Rhizome is a modified version of Tolaria: the vault, editor and note model |
| [Mindwalk](https://github.com/cosmtrek/mindwalk) © 2026 Ricko Yu | MIT | The map engine behind [Mycelium](../concepts/mycelium.md). You install it separately; Rhizome calls it |
| [OmniRoute](https://github.com/diegosouzapw/OmniRoute) © 2026 diegosouzapw | MIT | [Free tier (auto)](../concepts/free-models-and-routing.md): the provider catalog data and cooldown rules are ported from it |
| [freellmapi](https://github.com/tashfeenahmed/freellmapi) | MIT | Free tier (auto): used as an edge-case checklist for retries and failover. No code or hosted catalog is copied |
| [Portent](https://portent.md) | See the project | The default work types for new vaults. See [Structure a vault with Portent](../guides/structure-with-portent.md) |
| [IronCalc](https://github.com/ironcalc/IronCalc) | MIT or Apache-2.0 | Spreadsheet engine for sheet notes |
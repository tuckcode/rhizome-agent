//! Seed a Prime project skill so the agent can call Rhizome vault tools.
//!
//! Prime's documented MCP integrations are HTTP-first; stdio servers are not
//! fully wired through the host kernel path. The reliable injection for v0 is a
//! project skill under `<vault>/.prime/agent/skills/rhizome-vault/` that shells
//! to `mcp-server/cli-call.mjs` with VAULT_PATH set.

use std::path::{Path, PathBuf};

const SKILL_DIR_NAME: &str = "rhizome-vault";

#[derive(Debug, Clone)]
pub(crate) struct VaultSkillSeed {
    pub skill_dir: PathBuf,
    pub cli_call_path: PathBuf,
    pub vault_path: String,
}

/// Write/update the rhizome-vault skill for this vault cwd. Idempotent.
pub(crate) fn seed_vault_skill(vault_cwd: &Path) -> Result<VaultSkillSeed, String> {
    let vault_path = vault_cwd
        .canonicalize()
        .unwrap_or_else(|_| vault_cwd.to_path_buf());
    let vault_path_str = vault_path.to_string_lossy().into_owned();

    if !looks_like_vault(&vault_path) {
        return Err(format!(
            "cwd is not a Rhizome vault (missing notes/wiki markers): {}",
            vault_path.display()
        ));
    }

    let cli_call_path = resolve_cli_call_path()?;
    let skill_root = vault_path
        .join(".prime")
        .join("agent")
        .join("skills")
        .join(SKILL_DIR_NAME);
    std::fs::create_dir_all(&skill_root).map_err(|error| {
        format!(
            "Failed to create Prime skill dir {}: {error}",
            skill_root.display()
        )
    })?;

    let skill_md = skill_markdown(&cli_call_path, &vault_path_str);
    let skill_path = skill_root.join("SKILL.md");
    write_if_changed(&skill_path, &skill_md)?;

    // Optional: declare stdio MCP server for future Prime kernel support.
    // Harmless if ignored today; path is correct when stdio becomes live.
    let settings_path = vault_path
        .join(".prime")
        .join("agent")
        .join("settings.json");
    write_mcp_stdio_settings(&settings_path, &cli_call_path, &vault_path_str)?;

    Ok(VaultSkillSeed {
        skill_dir: skill_root,
        cli_call_path,
        vault_path: vault_path_str,
    })
}

fn looks_like_vault(path: &Path) -> bool {
    if !path.is_dir() {
        return false;
    }
    // The home directory is never a vault, whatever markers it happens to
    // hold. Chat without a vault is supported, and `normalize_cwd("")` hands
    // Prime $HOME as its working directory — reasonable for Prime, but
    // `$HOME/.prime/agent/settings.json` *is* Prime's own global config, so
    // seeding there rewrites another tool's global state and scopes the vault
    // MCP server to the user's whole home directory. The marker heuristic
    // below cannot catch this: a stray `CLAUDE.md` or a `.rhizome` directory
    // in $HOME is enough to satisfy it. #46.
    if dirs::home_dir().is_some_and(|home| {
        let home = home.canonicalize().unwrap_or(home);
        let path = path.canonicalize().unwrap_or_else(|_| path.to_path_buf());
        home == path
    }) {
        return false;
    }
    if path.join(".obsidian").is_dir()
        || path.join("AGENTS.md").is_file()
        || path.join("wiki").is_dir()
        || path.join(".rhizome").is_dir()
        || path.join("entities").is_dir()
        || path.join("concepts").is_dir()
    {
        return true;
    }
    // Demo vaults / plain markdown trees
    std::fs::read_dir(path)
        .map(|entries| {
            entries.filter_map(Result::ok).any(|entry| {
                entry
                    .path()
                    .extension()
                    .is_some_and(|ext| ext.eq_ignore_ascii_case("md"))
            })
        })
        .unwrap_or(false)
}

fn resolve_cli_call_path() -> Result<PathBuf, String> {
    let mcp_index = crate::mcp::mcp_server_index_js_path_string()?;
    let mcp_dir = Path::new(&mcp_index)
        .parent()
        .ok_or_else(|| "MCP server path has no parent directory".to_string())?;
    let cli = mcp_dir.join("cli-call.mjs");
    if !cli.is_file() {
        return Err(format!(
            "Rhizome MCP cli-call.mjs not found next to index.js at {}",
            cli.display()
        ));
    }
    Ok(cli.canonicalize().unwrap_or(cli))
}

fn skill_markdown(cli_call: &Path, vault_path: &str) -> String {
    let cli = cli_call.display();
    // r## so embedded "# Idea" / .md" examples do not terminate the raw string.
    format!(
        r##"---
name: rhizome-vault
description: Call Rhizome vault tools (search, read, create note, open note) for the attached vault via the local MCP one-shot CLI. Prefer these tools over raw filesystem walks of the vault.
---

# Rhizome vault tools

Default toolkit for this vault. Prefer these over IPython/`find` crawls of Obsidian or vault paths. Install more Prime skills when you need broader tooling — there is no separate Safe/Power product mode.

The active vault root is:

```
{vault_path}
```

Call tools with the one-shot CLI (always set VAULT_PATH):

```bash
VAULT_PATH={vault_path_q} node {cli_q} <toolName> '<jsonArgs>'
```

## Tools

| Tool | Args example | Purpose |
|------|----------------|---------|
| `search_notes` | `{{"query":"hermes"}}` | Full-text search |
| `get_vault_context` | `{{}}` | Types, note count, folders |
| `get_note` | `{{"path":"wiki/foo.md"}}` | Read one note |
| `list_vaults` | `{{}}` | Active vault roots |
| `create_note` | `{{"path":"inbox/idea.md","content":"# Idea\n\n..."}}` | Create a new markdown note (no overwrite) |
| `open_note` | `{{"path":"inbox/idea.md"}}` | Open note in Rhizome UI |
| `refresh_vault` | `{{}}` | Rescan so new files appear |
| `show_confetti` | `{{"message":"Migration landed"}}` | Celebrate a hard-won milestone |

## Celebrate (sparingly)

`show_confetti` throws a burst of confetti across the Rhizome window. Use it
for a **verified, hard-won milestone in substantial work** — a long migration
finished, a stubborn bug finally reproduced and fixed, a release shipped. At
most once per milestone, and never for routine work: not for saving a note,
answering a question, or finishing a turn.

The optional `message` is a one-line congratulation. Confetti with no message
is a complete answer.

The user may have celebrations switched off, or have asked their system for
reduced motion, and two celebrations close together are collapsed into one.
When that happens nothing is shown and the call still succeeds — that is
normal. Do not mention it, do not apologise for it, and do not try again.

## Promote (durable memory)

When the user wants to **keep** something from chat, write a vault note with `create_note`, then `open_note` (and `refresh_vault` if the list looks stale). Do **not** dual-write every turn. Good default path: `inbox/YYYYMMDD-short-slug.md` with YAML frontmatter + H1.

Example:

```bash
VAULT_PATH={vault_path_q} node {cli_q} create_note '{{"path":"inbox/20260809-example.md","content":"---\ntitle: Example\nis_a: Note\n---\n\n# Example\n\nBody here.\n"}}'
VAULT_PATH={vault_path_q} node {cli_q} open_note '{{"path":"inbox/20260809-example.md"}}'
```

## Rules

1. Prefer `search_notes` then `get_note` over guessing paths.
2. Paths are vault-relative unless absolute under the vault root.
3. Do not claim vault tools work if VAULT_PATH is missing or the CLI errors.
4. Prefer this skill for vault Q&A; do not roam the whole disk looking for notes.
5. Durable knowledge the user wants to keep → `create_note` (or the UI Save to vault control) — not only a chat summary.
"##,
        vault_path = vault_path,
        vault_path_q = shell_single_quote(vault_path),
        cli_q = shell_single_quote(&cli.to_string()),
    )
}

fn shell_single_quote(value: &str) -> String {
    format!("'{}'", value.replace('\'', "'\"'\"'"))
}

fn write_if_changed(path: &Path, contents: &str) -> Result<(), String> {
    if path.is_file() {
        if let Ok(existing) = std::fs::read_to_string(path) {
            if existing == contents {
                return Ok(());
            }
        }
    }
    std::fs::write(path, contents)
        .map_err(|error| format!("Failed to write {}: {error}", path.display()))
}

fn write_mcp_stdio_settings(
    settings_path: &Path,
    cli_call: &Path,
    vault_path: &str,
) -> Result<(), String> {
    // Prefer pointing at index.js stdio server (true MCP) for future kernel support.
    let index_js = cli_call
        .parent()
        .map(|p| p.join("index.js"))
        .filter(|p| p.is_file())
        .unwrap_or_else(|| cli_call.to_path_buf());

    let mut root = if settings_path.is_file() {
        let raw = std::fs::read_to_string(settings_path)
            .map_err(|error| format!("Failed to read {}: {error}", settings_path.display()))?;
        serde_json::from_str::<serde_json::Value>(&raw).unwrap_or_else(|_| serde_json::json!({}))
    } else {
        serde_json::json!({})
    };

    let obj = root
        .as_object_mut()
        .ok_or_else(|| "Prime settings.json root must be an object".to_string())?;

    let servers = obj
        .entry("mcpServers")
        .or_insert_with(|| serde_json::json!({}));
    let servers_obj = servers
        .as_object_mut()
        .ok_or_else(|| "mcpServers must be an object".to_string())?;

    // Array form also appears in some Prime schemas; settings.json uses object map
    // in docs. Write object form matching pi/codex style.
    servers_obj.insert(
        "rhizome".into(),
        serde_json::json!({
            "command": "node",
            "args": [index_js.to_string_lossy()],
            "env": {
                "VAULT_PATH": vault_path,
                "VAULT_PATHS": serde_json::to_string(&vec![vault_path]).unwrap_or_else(|_| format!("[\"{vault_path}\"]"))
            }
        }),
    );

    if let Some(parent) = settings_path.parent() {
        std::fs::create_dir_all(parent)
            .map_err(|error| format!("Failed to create {}: {error}", parent.display()))?;
    }

    let pretty = serde_json::to_string_pretty(&root)
        .map_err(|error| format!("Failed to serialize Prime settings: {error}"))?;
    write_if_changed(settings_path, &format!("{pretty}\n"))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn skill_markdown_lists_default_tools_and_promote() {
        let skill = skill_markdown(Path::new("/opt/rhizome/mcp-server/cli-call.mjs"), "/vault");
        assert!(skill.contains("search_notes"));
        assert!(skill.contains("get_note"));
        assert!(skill.contains("create_note"));
        assert!(skill.contains("Promote"));
        assert!(skill.contains("rhizome-vault"));
        assert!(skill.contains("/vault"));
        assert!(!skill.contains("Power User"));
        assert!(!skill.contains("Safe tools"));
    }

    #[test]
    fn empty_dir_is_not_vault() {
        let dir = tempfile::tempdir().unwrap();
        assert!(!looks_like_vault(dir.path()));
    }

    #[test]
    fn markdown_tree_is_vault() {
        let dir = tempfile::tempdir().unwrap();
        std::fs::write(dir.path().join("note.md"), "# hi\n").unwrap();
        assert!(looks_like_vault(dir.path()));
    }

    // #46. Chat without a vault is a supported flow, and `normalize_cwd("")`
    // hands Prime the home directory as its working directory. That is fine
    // for Prime — but $HOME is not a vault, and `$HOME/.prime/agent/
    // settings.json` *is* Prime's own global config. Seeding there rewrites
    // another tool's global state and scopes the vault MCP server to the
    // user's entire home directory. $HOME therefore is never a vault, however
    // many markers it happens to contain (this machine's has `.rhizome` and
    // five top-level .md files, so every heuristic below says yes).
    #[test]
    fn the_home_directory_is_never_a_vault() {
        let Some(home) = dirs::home_dir() else {
            return;
        };
        assert!(
            !looks_like_vault(&home),
            "$HOME must never be treated as a vault: seeding it would rewrite \
             Prime's global settings.json and scope vault tools to all of $HOME"
        );
    }

    #[test]
    fn seeding_the_home_directory_is_refused() {
        let Some(home) = dirs::home_dir() else {
            return;
        };
        assert!(seed_vault_skill(&home).is_err());
    }

    #[test]
    fn seed_writes_skill_when_mcp_cli_resolves() {
        // Only runs when repo mcp-server/cli-call.mjs is discoverable (dev tree).
        let Ok(cli) = resolve_cli_call_path() else {
            return;
        };
        let dir = tempfile::tempdir().unwrap();
        std::fs::write(dir.path().join("AGENTS.md"), "# vault\n").unwrap();
        let seed = seed_vault_skill(dir.path()).expect("seed");
        assert!(seed.skill_dir.join("SKILL.md").is_file());
        assert_eq!(seed.cli_call_path, cli);
        let settings = dir.path().join(".prime/agent/settings.json");
        assert!(settings.is_file());
        let raw = std::fs::read_to_string(settings).unwrap();
        assert!(raw.contains("rhizome"));
        assert!(raw.contains("VAULT_PATH"));
    }
}

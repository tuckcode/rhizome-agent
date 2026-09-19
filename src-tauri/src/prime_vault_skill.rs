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

    // Leftover from before this guard: a skill in Prime's *global* skills dir
    // told every session the vault was $HOME. The guard stops new writes;
    // this removes an already-poisoned copy on connect (#46).
    scrub_poisoned_global_home_vault_skill();

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
    if crate::commands::is_home_directory(path) {
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
    // Dev tree and packaged resources both ship `cli-call.mjs` next to index.js
    // (see scripts/bundle-mcp-server.mjs). Accept `cli-call.js` as a fallback.
    for name in ["cli-call.mjs", "cli-call.js"] {
        let cli = mcp_dir.join(name);
        if cli.is_file() {
            return Ok(cli.canonicalize().unwrap_or(cli));
        }
    }
    Err(format!(
        "Rhizome MCP cli-call not found next to index.js at {} (tried cli-call.mjs, cli-call.js)",
        mcp_dir.display()
    ))
}

/// The environment prefix the skill's shell examples carry.
///
/// `PATH` always (GUI-spawned Prime bash does not inherit a login shell);
/// `VAULT_PATH` always; `RHIZOME_TOOL_PATH` only when the sidecar is really
/// there. The graph tools shell out to that binary and fail closed without it —
/// an agent following this skill would get "Graph queries need the Rhizome
/// sidecar" on every graph question, because a bash tool inherits none of the
/// environment the app gives its own MCP server. Omitted rather than guessed
/// when it is missing, so a build without the sidecar says so instead of
/// silently routing through `index.js`'s deprecated Python fallback.
fn shell_env_prefix(vault_path: &str, rhizome_tool: Option<&Path>, node: Option<&Path>) -> String {
    let path = shell_path_assignment(node);
    let vault = format!("VAULT_PATH={}", shell_single_quote(vault_path));
    match rhizome_tool {
        Some(tool) => format!(
            "{path} {vault} RHIZOME_TOOL_PATH={}",
            shell_single_quote(&tool.display().to_string()),
        ),
        None => format!("{path} {vault}"),
    }
}

fn shell_path_assignment(node: Option<&Path>) -> String {
    let mut dirs: Vec<String> = Vec::new();
    if let Some(parent) = node.and_then(Path::parent) {
        let rendered = parent.display().to_string();
        if !rendered.is_empty() {
            dirs.push(rendered);
        }
    }
    dirs.push("$HOME/.local/bin".into());
    dirs.push("/opt/homebrew/bin".into());
    dirs.push("/usr/local/bin".into());
    format!("PATH={}:$PATH", dirs.join(":"))
}

fn node_command(node: Option<&Path>) -> String {
    match node {
        Some(path) => shell_single_quote(&path.display().to_string()),
        None => "node".into(),
    }
}

fn stdio_path_value(node: Option<&Path>) -> String {
    let sep = if cfg!(windows) { ";" } else { ":" };
    let mut dirs: Vec<String> = Vec::new();
    if let Some(parent) = node.and_then(Path::parent) {
        let rendered = parent.display().to_string();
        if !rendered.is_empty() {
            dirs.push(rendered);
        }
    }
    if let Some(home) = dirs::home_dir() {
        dirs.push(home.join(".local").join("bin").display().to_string());
    }
    dirs.push("/opt/homebrew/bin".into());
    dirs.push("/usr/local/bin".into());
    match std::env::var("PATH") {
        Ok(existing) if !existing.is_empty() => {
            format!("{}{sep}{existing}", dirs.join(sep))
        }
        _ => dirs.join(sep),
    }
}

/// Environment for the stdio MCP server declaration.
///
/// Same reasoning as [`shell_env_prefix`]: the sidecar path is included only
/// when the binary exists, so a build without it fails loudly rather than
/// pointing at nothing. `PATH` is always set so a GUI-spawned stdio server
/// still finds Node.
fn mcp_stdio_env(
    vault_path: &str,
    rhizome_tool: Option<&Path>,
    node: Option<&Path>,
) -> serde_json::Value {
    let mut env = serde_json::Map::new();
    env.insert("PATH".into(), serde_json::json!(stdio_path_value(node)));
    env.insert("VAULT_PATH".into(), serde_json::json!(vault_path));
    env.insert(
        "VAULT_PATHS".into(),
        serde_json::json!(serde_json::to_string(&vec![vault_path])
            .unwrap_or_else(|_| format!("[\"{vault_path}\"]"))),
    );
    if let Some(tool) = rhizome_tool {
        env.insert(
            "RHIZOME_TOOL_PATH".into(),
            serde_json::json!(tool.display().to_string()),
        );
    }
    serde_json::Value::Object(env)
}

fn skill_markdown(cli_call: &Path, vault_path: &str) -> String {
    skill_markdown_with_runtime(
        cli_call,
        vault_path,
        rhizome_tool_for_seed().as_deref(),
        node_for_seed().as_deref(),
    )
}

fn node_for_seed() -> Option<PathBuf> {
    crate::mcp::find_node().ok()
}

/// Sidecar path for skill/MCP seed: honor `RHIZOME_TOOL_PATH` when it points at
/// a real binary (manual reseed / agents), else the binary beside this process.
fn rhizome_tool_for_seed() -> Option<PathBuf> {
    std::env::var_os("RHIZOME_TOOL_PATH")
        .map(PathBuf::from)
        .filter(|path| path.is_file())
        .or_else(crate::mcp::rhizome_tool_path)
}

#[cfg(test)]
fn skill_markdown_with_tool(
    cli_call: &Path,
    vault_path: &str,
    rhizome_tool: Option<&Path>,
) -> String {
    skill_markdown_with_runtime(cli_call, vault_path, rhizome_tool, None)
}

fn skill_markdown_with_runtime(
    cli_call: &Path,
    vault_path: &str,
    rhizome_tool: Option<&Path>,
    node: Option<&Path>,
) -> String {
    let env_prefix = shell_env_prefix(vault_path, rhizome_tool, node);
    let node_cmd = node_command(node);
    // r## so embedded "# Idea" / .md" examples do not terminate the raw string.
    format!(
        r##"---
name: rhizome-vault
description: Search, read, and write notes in the attached Rhizome vault, and ask its wikilink graph what connects to what — a note's neighbours, the chain between two notes, orphans, and dead links. Reach for this before reading a pile of notes to find how something relates, and in place of find/grep over the vault.
---

# Rhizome vault tools

This skill is a **command-line tool**, not an importable Python module. Do not `import rhizome_vault` or `from rhizome_vault import …`. Run the `node … cli-call.mjs` commands below.

Default toolkit for this vault. Prefer these over IPython/`find` crawls of Obsidian or vault paths. Install more Prime skills when you need broader tooling — there is no separate Safe/Power product mode.

## How to work in this chat

Prime runs this turn. Answer like a short chat agent, not a lab notebook.

- **Answer in the chat first.** One short reply. Call tools only when the user asked, or when the vault is required to answer.
- **Do not use ipython to call vault tools.** The CLI below is the only vault API. IPython cannot import this toolkit.
- **Stdout is text.** Read it as text. Do not parse stdout with json.loads.
- **Stop after one environment error.** `FileNotFoundError`, `ModuleNotFoundError`, `JSONDecodeError`, or `node: command not found` means that approach failed. Switch to the CLI with the PATH prefix, or say what failed. Do not retry the same missing import or the same missing binary.
- **This vault is already attached.** Do not look for `agents/claude/vault-context.md` or a Claude start-chain. Those files are for Cursor/Claude Code, not this chat.

The active vault root is:

```
{vault_path}
```

Call tools with the one-shot CLI (keep the environment prefix — the graph tools need it):

```bash
{env_prefix} {node_cmd} {cli_q} <toolName> '<jsonArgs>'
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

## The graph

The vault is a graph: notes are nodes, wikilinks are edges. Ask it structural
questions instead of reading notes to infer the same answer.

| Tool | Args example | Answers |
|------|----------------|---------|
| `rhizome_graph_neighbors` | `{{"note":"bi-temporal-facts","depth":1}}` | What is this note connected to? |
| `rhizome_graph_path` | `{{"from":"rhizome","to":"persistent-wiki"}}` | How do these two relate, if at all? |
| `rhizome_graph_health` | `{{}}` | Size, orphan count, dead-link count, most-connected notes |
| `rhizome_graph_orphans` | `{{}}` | Which notes are unreachable by following links? |
| `rhizome_graph_dead_links` | `{{}}` | Which notes were linked to but never written? |

`note` resolves a vault path, a title, or a filename stem, so
`"bi-temporal-facts"` and `"concepts/bi-temporal-facts.md"` both work.

**Reach for the graph before reading.** Asked how one thing relates to another,
or what surrounds a topic, one `rhizome_graph_neighbors` call answers what
would otherwise take ten `get_note` calls — and it names the notes worth
opening, so the reads that follow are the right ones. `search_notes` finds
notes that *mention* a phrase; the graph finds notes that are actually *linked*,
which is the better signal for "what belongs with this".

Two of these answer questions nothing else can. `rhizome_graph_dead_links`
lists wikilink targets with no note behind them — each one a note somebody
meant to write, ordered by how many notes are waiting on it, which makes it a
worklist rather than a complaint. `rhizome_graph_orphans` lists notes nothing
links to and which link nowhere: real content that no path through the vault
will ever reach.

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
{env_prefix} {node_cmd} {cli_q} create_note '{{"path":"inbox/20260809-example.md","content":"---\ntitle: Example\nis_a: Note\n---\n\n# Example\n\nBody here.\n"}}'
{env_prefix} {node_cmd} {cli_q} open_note '{{"path":"inbox/20260809-example.md"}}'
```

## Rules

1. Prefer `search_notes` then `get_note` over guessing paths.
1. Relationship questions — how two notes connect, what surrounds a topic,
   what is missing — start at the graph, then read the notes it names.
2. Paths are vault-relative unless absolute under the vault root.
3. Do not claim vault tools work if VAULT_PATH is missing or the CLI errors.
4. Prefer this skill for vault Q&A; do not roam the whole disk looking for notes.
5. Durable knowledge the user wants to keep → `create_note` (or the UI Save to vault control) — not only a chat summary.
"##,
        vault_path = vault_path,
        env_prefix = env_prefix,
        node_cmd = node_cmd,
        cli_q = shell_single_quote(&cli_call.display().to_string()),
    )
}
fn shell_single_quote(value: &str) -> String {
    format!("'{}'", value.replace('\'', "'\"'\"'"))
}

fn is_prime_global_settings_path(path: &Path) -> bool {
    let Some(home) = dirs::home_dir() else {
        return false;
    };
    let global = home.join(".prime").join("agent").join("settings.json");
    match (path.canonicalize(), global.canonicalize()) {
        (Ok(left), Ok(right)) => left == right,
        _ => path == global,
    }
}

/// Prime's global skills live at `$HOME/.prime/agent/skills/`. A
/// Rhizome-generated `rhizome-vault` skill there is leftover from treating
/// $HOME as a vault (#46). Vault copies belong under
/// `<vault>/.prime/agent/skills/`. User-authored content with that folder
/// name is left in place.
pub(crate) fn scrub_poisoned_global_home_vault_skill() {
    if let Some(home) = dirs::home_dir() {
        if let Err(error) = scrub_global_rhizome_vault_skill_at(&home) {
            log::warn!("#46: {error}");
        }
    }
}

fn global_rhizome_vault_skill_dir(home: &Path) -> PathBuf {
    home.join(".prime")
        .join("agent")
        .join("skills")
        .join(SKILL_DIR_NAME)
}

fn skill_looks_like_rhizome_generated(skill_dir: &Path) -> bool {
    let skill_md = skill_dir.join("SKILL.md");
    let Ok(text) = std::fs::read_to_string(&skill_md) else {
        return false;
    };
    text.contains("cli-call.mjs") && text.contains("rhizome-vault")
}

fn scrub_global_rhizome_vault_skill_at(home: &Path) -> Result<bool, String> {
    let skill_dir = global_rhizome_vault_skill_dir(home);
    if !skill_dir.exists() {
        return Ok(false);
    }
    if !skill_looks_like_rhizome_generated(&skill_dir) {
        log::warn!(
            "#46: left global rhizome-vault skill in place; content is not identifiable as Rhizome-generated {}",
            skill_dir.display()
        );
        return Ok(false);
    }
    std::fs::remove_dir_all(&skill_dir).map_err(|error| {
        format!(
            "Failed to remove poisoned global rhizome-vault skill {}: {error}",
            skill_dir.display()
        )
    })?;
    log::warn!(
        "#46: removed rhizome-vault skill from Prime's global skills directory {}",
        skill_dir.display()
    );
    Ok(true)
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
    if is_prime_global_settings_path(settings_path) {
        return Err("Refusing to write vault MCP settings into Prime's global config (#46)".into());
    }
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

    let node = crate::mcp::find_node().ok();
    let command = node
        .as_ref()
        .map(|path| path.display().to_string())
        .unwrap_or_else(|| "node".into());

    // Array form also appears in some Prime schemas; settings.json uses object map
    // in docs. Write object form matching pi/codex style.
    servers_obj.insert(
        "rhizome".into(),
        serde_json::json!({
            "command": command,
            "args": [index_js.to_string_lossy()],
            "env": mcp_stdio_env(vault_path, rhizome_tool_for_seed().as_deref(), node.as_deref())
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

    /// An agent decides whether to open a skill from its description, before
    /// it reads a word of the body. A description naming only note CRUD gives
    /// it no reason to look here when asked how two things relate, so the
    /// graph stays unused however well the body documents it.
    #[test]
    fn the_description_advertises_relationship_questions() {
        let skill = skill_markdown(Path::new("/opt/rhizome/mcp-server/cli-call.mjs"), "/vault");
        let description = skill
            .lines()
            .find(|line| line.starts_with("description:"))
            .expect("a description line");

        assert!(description.contains("graph"));
        assert!(description.contains("connects"));
        assert!(description.contains("orphans"));
        assert!(description.contains("dead links"));
    }

    /// The graph tools shell out to `rhizome-tool` and fail closed without
    /// `RHIZOME_TOOL_PATH`. A bash tool inherits none of the environment the
    /// app gives its own MCP server, so unless the skill's own command carries
    /// the path, every graph question an agent asks returns "Graph queries need
    /// the Rhizome sidecar". Verified against the real CLI on 2026-09-05.
    #[test]
    fn skill_command_carries_the_sidecar_path_when_it_exists() {
        let skill = skill_markdown_with_tool(
            Path::new("/opt/rhizome/mcp-server/cli-call.mjs"),
            "/vault",
            Some(Path::new(
                "/Applications/Rhizome Agent.app/Contents/MacOS/rhizome-tool",
            )),
        );

        assert!(skill.contains("RHIZOME_TOOL_PATH="));
        assert!(skill.contains("/Contents/MacOS/rhizome-tool"));
        assert!(skill.contains("VAULT_PATH="));
    }

    /// Omitted rather than guessed: a build with no sidecar must let the tool
    /// report that it is missing, not hand `index.js` a path to nothing.
    #[test]
    fn skill_command_omits_the_sidecar_path_when_it_is_absent() {
        let skill = skill_markdown_with_tool(
            Path::new("/opt/rhizome/mcp-server/cli-call.mjs"),
            "/vault",
            None,
        );

        assert!(!skill.contains("RHIZOME_TOOL_PATH"));
        assert!(skill.contains("VAULT_PATH="));
    }

    #[test]
    fn stdio_settings_env_matches_the_same_rule() {
        let with_tool = mcp_stdio_env("/vault", Some(Path::new("/opt/rhizome-tool")), None);
        assert_eq!(with_tool["RHIZOME_TOOL_PATH"], "/opt/rhizome-tool");
        assert_eq!(with_tool["VAULT_PATH"], "/vault");
        assert!(with_tool["PATH"].as_str().unwrap().contains(".local"));

        let without = mcp_stdio_env("/vault", None, None);
        assert!(without.get("RHIZOME_TOOL_PATH").is_none());
        assert_eq!(without["VAULT_PATH"], "/vault");
        assert!(without["PATH"]
            .as_str()
            .unwrap()
            .contains("/opt/homebrew/bin"));
    }

    /// A path with a space is the normal case on macOS
    /// (`/Applications/Rhizome Agent.app/...`), so the shell example has to
    /// quote it or the agent's command splits mid-path.
    #[test]
    fn quotes_a_sidecar_path_containing_spaces() {
        let prefix = shell_env_prefix(
            "/vault",
            Some(Path::new(
                "/Applications/Rhizome Agent.app/Contents/MacOS/rhizome-tool",
            )),
            None,
        );

        assert!(prefix.contains("'/Applications/Rhizome Agent.app/Contents/MacOS/rhizome-tool'"));
    }

    #[test]
    fn skill_command_uses_the_resolved_node_binary_not_bare_node() {
        let skill = skill_markdown_with_runtime(
            Path::new("/opt/rhizome/mcp-server/cli-call.mjs"),
            "/vault",
            None,
            Some(Path::new("/opt/homebrew/bin/node")),
        );
        assert!(skill.contains("'/opt/homebrew/bin/node'"));
        assert!(!skill.contains(" node '/opt/rhizome/mcp-server/cli-call.mjs'"));
    }

    #[test]
    fn skill_command_puts_the_node_directory_on_path() {
        let skill = skill_markdown_with_runtime(
            Path::new("/opt/rhizome/mcp-server/cli-call.mjs"),
            "/vault",
            None,
            Some(Path::new("/opt/homebrew/bin/node")),
        );
        assert!(skill.contains("PATH="));
        assert!(skill.contains("/opt/homebrew/bin"));
        assert!(skill.contains("$HOME/.local/bin"));
    }

    #[test]
    fn skill_tells_the_agent_stdout_is_text_not_json() {
        let skill = skill_markdown(Path::new("/opt/rhizome/mcp-server/cli-call.mjs"), "/vault");
        assert!(skill.contains("Do not parse stdout with json.loads"));
    }

    #[test]
    fn skill_stops_after_one_environment_error() {
        let skill = skill_markdown(Path::new("/opt/rhizome/mcp-server/cli-call.mjs"), "/vault");
        assert!(skill.contains("FileNotFoundError"));
        assert!(skill.contains("Stop after one"));
    }

    #[test]
    fn skill_does_not_send_the_agent_to_claude_start_chain_files() {
        let skill = skill_markdown(Path::new("/opt/rhizome/mcp-server/cli-call.mjs"), "/vault");
        assert!(skill.contains("Do not look for `agents/claude/"));
    }

    #[test]
    fn skill_prefers_cli_over_ipython_for_vault_tools() {
        let skill = skill_markdown(Path::new("/opt/rhizome/mcp-server/cli-call.mjs"), "/vault");
        assert!(skill.contains("Do not use ipython to call vault tools"));
    }

    #[test]
    fn skill_answers_in_chat_before_more_tools() {
        let skill = skill_markdown(Path::new("/opt/rhizome/mcp-server/cli-call.mjs"), "/vault");
        assert!(skill.contains("Answer in the chat first"));
    }

    #[test]
    fn skill_markdown_lists_default_tools_and_promote() {
        let skill = skill_markdown(Path::new("/opt/rhizome/mcp-server/cli-call.mjs"), "/vault");
        assert!(skill.contains("search_notes"));
        assert!(skill.contains("get_note"));
        assert!(skill.contains("create_note"));
        // The graph tools shipped documented nowhere the agent reads, so it
        // never learned they existed — the reason the vault's own structure
        // went unused for a year of sessions.
        assert!(skill.contains("rhizome_graph_neighbors"));
        assert!(skill.contains("rhizome_graph_dead_links"));
        assert!(skill.contains("rhizome_graph_orphans"));
        assert!(skill.contains("rhizome_graph_path"));
        assert!(skill.contains("rhizome_graph_health"));
        assert!(skill.contains("Promote"));
        assert!(skill.contains("rhizome-vault"));
        assert!(skill.contains("/vault"));
        assert!(!skill.contains("Power User"));
        assert!(!skill.contains("Safe tools"));
        assert!(skill.contains("not an importable Python module"));
        assert!(skill.contains("cli-call.mjs"));
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
        let slashed = std::path::PathBuf::from(format!("{}/", home.display()));
        assert!(
            !looks_like_vault(&slashed),
            "HOME with a trailing slash is still HOME"
        );
    }

    #[test]
    fn seeding_the_home_directory_is_refused() {
        let Some(home) = dirs::home_dir() else {
            return;
        };
        assert!(seed_vault_skill(&home).is_err());
    }

    /// #46 leftover: lexical `$HOME` is already refused. A symlink that
    /// resolves to the same directory must not look like a vault either.
    /// `looks_like_vault` only compares paths — it does not scrub. Do not
    /// call `seed_vault_skill` on this link; that helper always scrubs the
    /// real global skill dir.
    #[cfg(unix)]
    #[test]
    fn a_symlink_to_the_home_directory_is_never_a_vault() {
        let Some(home) = dirs::home_dir() else {
            return;
        };
        let dir = tempfile::tempdir().unwrap();
        let link = dir.path().join("home-alias");
        if std::os::unix::fs::symlink(&home, &link).is_err() {
            return;
        }
        assert!(
            !looks_like_vault(&link),
            "a HOME symlink must not pass the vault marker check"
        );
    }

    #[test]
    fn a_rhizome_vault_skill_in_prime_global_skills_is_removed() {
        let home = tempfile::tempdir().unwrap();
        let skill_dir = global_rhizome_vault_skill_dir(home.path());
        std::fs::create_dir_all(&skill_dir).unwrap();
        std::fs::write(
            skill_dir.join("SKILL.md"),
            "The active vault root is:\n/Users/dtc\nUse `node …/cli-call.mjs`.\n# rhizome-vault\n",
        )
        .unwrap();
        let other = home
            .path()
            .join(".prime")
            .join("agent")
            .join("skills")
            .join("keep-me");
        std::fs::create_dir_all(&other).unwrap();

        assert!(scrub_global_rhizome_vault_skill_at(home.path()).unwrap());
        assert!(!skill_dir.exists());
        assert!(other.exists());
        assert!(!scrub_global_rhizome_vault_skill_at(home.path()).unwrap());
    }

    #[test]
    fn a_user_authored_global_skill_named_rhizome_vault_is_left_in_place() {
        let home = tempfile::tempdir().unwrap();
        let skill_dir = global_rhizome_vault_skill_dir(home.path());
        std::fs::create_dir_all(&skill_dir).unwrap();
        std::fs::write(skill_dir.join("SKILL.md"), "My personal notes skill.\n").unwrap();

        assert!(!scrub_global_rhizome_vault_skill_at(home.path()).unwrap());
        assert!(skill_dir.exists());
    }

    #[test]
    fn vault_mcp_settings_are_not_written_into_prime_global_config() {
        let Some(home) = dirs::home_dir() else {
            return;
        };
        let global = home.join(".prime").join("agent").join("settings.json");
        assert!(is_prime_global_settings_path(&global));
        let dir = tempfile::tempdir().unwrap();
        assert!(!is_prime_global_settings_path(
            &dir.path().join(".prime/agent/settings.json")
        ));
    }

    #[test]
    fn seed_honors_rhizome_tool_path_env_when_file_exists() {
        let dir = tempfile::tempdir().unwrap();
        let fake_tool = dir.path().join("rhizome-tool");
        std::fs::write(&fake_tool, b"x").unwrap();
        // SAFETY: test-only, serial within this module's env-sensitive cases.
        unsafe { std::env::set_var("RHIZOME_TOOL_PATH", &fake_tool) };
        let resolved = rhizome_tool_for_seed();
        unsafe { std::env::remove_var("RHIZOME_TOOL_PATH") };
        assert_eq!(resolved.as_deref(), Some(fake_tool.as_path()));
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

    /// Manual reseed for a real vault when the installed skill is stale.
    /// Example:
    /// `RHIZOME_RESEED_VAULT="$HOME/Documents/Rhizome Vault" \
    ///  RHIZOME_TOOL_PATH="/Applications/Rhizome Agent.app/Contents/MacOS/rhizome-tool" \
    ///  cargo test -p rhizome reseed_vault_skill_from_env -- --ignored --nocapture`
    #[test]
    #[ignore = "set RHIZOME_RESEED_VAULT (+ optional RHIZOME_TOOL_PATH) to rewrite a vault skill"]
    fn reseed_vault_skill_from_env() {
        let vault = std::env::var("RHIZOME_RESEED_VAULT")
            .expect("RHIZOME_RESEED_VAULT must point at a vault directory");
        let seed = seed_vault_skill(Path::new(&vault)).expect("seed");
        let skill_path = seed.skill_dir.join("SKILL.md");
        let md = std::fs::read_to_string(&skill_path).expect("read skill");
        println!("reseeded {}", skill_path.display());
        assert!(
            md.contains("rhizome_graph_neighbors"),
            "expected graph tools in skill body"
        );
        assert!(
            md.contains("RHIZOME_TOOL_PATH=") || std::env::var_os("RHIZOME_TOOL_PATH").is_none(),
            "expected sidecar path when RHIZOME_TOOL_PATH is set"
        );
    }
}

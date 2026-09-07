//! `rhizome-tool` — headless CLI sidecar for the remaining MCP research
//! verbs (ADR-0152, MCP bridge Phase 2). Wraps `rhizome_lib::rhizome_api`
//! so external agents can reach the same write path the in-app Research
//! panel uses, without shelling the Python toolkit.
//!
//! argv only, no shell strings (ADR-0152). Grok-wiki / wiki-generation
//! verbs (`grok-import`, `generate_wiki`) are out of scope and have no
//! subcommand.

use rhizome_lib::inbox_action::CaptureRequest;
use rhizome_lib::rhizome_api::{self, GraphQuery};
use std::path::PathBuf;

/// Trigger recorded when a caller does not name itself. Everything reaching
/// this binary is an external agent unless it says otherwise.
const DEFAULT_TRIGGER: &str = "agent";

#[derive(Debug, PartialEq)]
enum Command {
    Search {
        vault_path: PathBuf,
        query: String,
        limit: usize,
    },
    Distill {
        vault_path: PathBuf,
        text: String,
        project: Option<String>,
        kind: Option<String>,
    },
    ImportSource {
        vault_path: PathBuf,
        source: String,
        project: Option<String>,
    },
    RepoResearch {
        vault_path: PathBuf,
        repo: String,
        mode: String,
        depth: String,
        project: Option<String>,
    },
    Graph {
        vault_path: PathBuf,
    },
    /// Scoped graph questions for an agent — see `GraphQuery`.
    GraphQuery {
        vault_path: PathBuf,
        query: GraphQuery,
    },
    /// File a page with no agent call — the browser extension's "Save URL".
    SaveCapture {
        vault_path: PathBuf,
        capture: CaptureRequest,
        trigger: String,
    },
}

/// Pull `--flag value` out of the remaining argv, removing both entries.
fn take_flag(args: &mut Vec<String>, flag: &str) -> Option<String> {
    let idx = args.iter().position(|a| a == flag)?;
    if idx + 1 >= args.len() {
        return None;
    }
    args.remove(idx);
    Some(args.remove(idx))
}

fn parse_args(argv: &[String]) -> Result<Command, String> {
    let mut rest: Vec<String> = argv.to_vec();
    if rest.is_empty() {
        return Err("missing subcommand".to_string());
    }
    let subcommand = rest.remove(0);

    match subcommand.as_str() {
        "search" => {
            let limit = take_flag(&mut rest, "--limit")
                .map(|v| {
                    v.parse::<usize>()
                        .map_err(|_| "--limit must be a number".to_string())
                })
                .transpose()?
                .unwrap_or(10);
            if rest.len() != 2 {
                return Err("usage: search <vault_path> <query> [--limit N]".to_string());
            }
            Ok(Command::Search {
                vault_path: PathBuf::from(&rest[0]),
                query: rest[1].clone(),
                limit,
            })
        }
        "distill" => {
            let project = take_flag(&mut rest, "--project");
            let kind = take_flag(&mut rest, "--kind");
            let text_flag = take_flag(&mut rest, "--text");
            let from_flag = take_flag(&mut rest, "--from");
            if rest.len() != 1 {
                return Err(
                    "usage: distill <vault_path> [--text T | --from FILE] [--project P] [--kind K]"
                        .to_string(),
                );
            }
            let text = match (text_flag, from_flag) {
                (Some(t), None) => t,
                (None, Some(path)) => std::fs::read_to_string(&path)
                    .map_err(|e| format!("failed to read --from {path}: {e}"))?,
                (Some(_), Some(_)) => return Err("pass only one of --text or --from".to_string()),
                (None, None) => return Err("distill requires --text or --from".to_string()),
            };
            Ok(Command::Distill {
                vault_path: PathBuf::from(&rest[0]),
                text,
                project,
                kind,
            })
        }
        "import-source" => {
            let project = take_flag(&mut rest, "--project");
            if rest.len() != 2 {
                return Err("usage: import-source <vault_path> <source> [--project P]".to_string());
            }
            Ok(Command::ImportSource {
                vault_path: PathBuf::from(&rest[0]),
                source: rest[1].clone(),
                project,
            })
        }
        "repo-research" => {
            let mode = take_flag(&mut rest, "--mode").unwrap_or_else(|| "architecture".to_string());
            let depth = take_flag(&mut rest, "--depth").unwrap_or_else(|| "fast".to_string());
            let project = take_flag(&mut rest, "--project");
            if rest.len() != 2 {
                return Err(
                    "usage: repo-research <vault_path> <repo> [--mode M] [--depth D] [--project P]"
                        .to_string(),
                );
            }
            Ok(Command::RepoResearch {
                vault_path: PathBuf::from(&rest[0]),
                repo: rest[1].clone(),
                mode,
                depth,
                project,
            })
        }
        "graph" => {
            if rest.len() != 1 {
                return Err("usage: graph <vault_path>".to_string());
            }
            Ok(Command::Graph {
                vault_path: PathBuf::from(&rest[0]),
            })
        }
        "graph-query" => {
            let limit = take_flag(&mut rest, "--limit")
                .map(|v| {
                    v.parse::<usize>()
                        .map_err(|_| "--limit must be a number".to_string())
                })
                .transpose()?
                .unwrap_or(rhizome_api::GRAPH_QUERY_LIMIT);
            let depth = take_flag(&mut rest, "--depth")
                .map(|v| {
                    v.parse::<usize>()
                        .map_err(|_| "--depth must be a number".to_string())
                })
                .transpose()?
                .unwrap_or(1);
            const USAGE: &str = "usage: graph-query <vault_path> \
                 <health | orphans | dead-links | neighbors <note> | path <from> <to>> \
                 [--limit N] [--depth N]";
            if rest.len() < 2 {
                return Err(USAGE.to_string());
            }
            let vault_path = PathBuf::from(&rest[0]);
            let query = match (rest[1].as_str(), rest.len()) {
                ("health", 2) => GraphQuery::Health,
                ("orphans", 2) => GraphQuery::Orphans { limit },
                ("dead-links", 2) => GraphQuery::DeadLinks { limit },
                ("neighbors", 3) => GraphQuery::Neighbors {
                    note: rest[2].clone(),
                    depth,
                },
                ("path", 4) => GraphQuery::Path {
                    from: rest[2].clone(),
                    to: rest[3].clone(),
                },
                _ => return Err(USAGE.to_string()),
            };
            Ok(Command::GraphQuery { vault_path, query })
        }
        "save-capture" => {
            let title = take_flag(&mut rest, "--title").unwrap_or_default();
            let context = take_flag(&mut rest, "--context").unwrap_or_default();
            let body = take_flag(&mut rest, "--text").unwrap_or_default();
            let trigger =
                take_flag(&mut rest, "--trigger").unwrap_or_else(|| DEFAULT_TRIGGER.to_string());
            if rest.len() != 2 {
                return Err(
                    "usage: save-capture <vault_path> <source> [--title T] [--context C] \
                     [--text B] [--trigger TR]"
                        .to_string(),
                );
            }
            Ok(Command::SaveCapture {
                vault_path: PathBuf::from(&rest[0]),
                capture: CaptureRequest {
                    title,
                    source: rest[1].clone(),
                    context,
                    body,
                },
                trigger,
            })
        }
        other => Err(format!("unknown subcommand: {other}")),
    }
}

fn stderr_line(line: &str) {
    eprintln!("{line}");
}

fn run(command: Command) -> Result<String, String> {
    match command {
        Command::Search {
            vault_path,
            query,
            limit,
        } => rhizome_api::search_standalone(&vault_path, &query, limit),
        Command::Distill {
            vault_path,
            text,
            project,
            kind,
        } => rhizome_api::distill(
            &vault_path,
            &text,
            project.as_deref(),
            kind.as_deref(),
            "agent",
            None,
            &mut stderr_line,
        ),
        Command::ImportSource {
            vault_path,
            source,
            project,
        } => rhizome_api::import_source(
            &vault_path,
            &source,
            project.as_deref(),
            "agent",
            None,
            &mut stderr_line,
        ),
        Command::RepoResearch {
            vault_path,
            repo,
            mode,
            depth,
            project,
        } => rhizome_api::repo_research(
            &vault_path,
            &repo,
            &mode,
            &depth,
            project.as_deref(),
            None,
            &mut stderr_line,
        ),
        Command::Graph { vault_path } => rhizome_api::build_wiki_graph(&vault_path),
        Command::GraphQuery { vault_path, query } => rhizome_api::graph_query(&vault_path, &query),
        Command::SaveCapture {
            vault_path,
            capture,
            trigger,
        } => rhizome_lib::inbox_action::save_capture(&vault_path, &capture, &trigger),
    }
}

fn main() {
    let argv: Vec<String> = std::env::args().skip(1).collect();
    let command = match parse_args(&argv) {
        Ok(c) => c,
        Err(e) => {
            eprintln!("rhizome-tool: {e}");
            std::process::exit(1);
        }
    };
    match run(command) {
        Ok(output) => println!("{output}"),
        Err(e) => {
            eprintln!("rhizome-tool: {e}");
            std::process::exit(1);
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn args(v: &[&str]) -> Vec<String> {
        v.iter().map(|s| s.to_string()).collect()
    }

    #[test]
    fn parses_search_with_default_limit() {
        let cmd = parse_args(&args(&["search", "/vault", "hello world"])).unwrap();
        assert_eq!(
            cmd,
            Command::Search {
                vault_path: PathBuf::from("/vault"),
                query: "hello world".to_string(),
                limit: 10,
            }
        );
    }

    #[test]
    fn parses_search_with_explicit_limit() {
        let cmd = parse_args(&args(&["search", "/vault", "q", "--limit", "5"])).unwrap();
        assert_eq!(
            cmd,
            Command::Search {
                vault_path: PathBuf::from("/vault"),
                query: "q".to_string(),
                limit: 5,
            }
        );
    }

    #[test]
    fn search_rejects_non_numeric_limit() {
        let err = parse_args(&args(&["search", "/vault", "q", "--limit", "nope"])).unwrap_err();
        assert!(err.contains("--limit"));
    }

    #[test]
    fn search_rejects_missing_query() {
        let err = parse_args(&args(&["search", "/vault"])).unwrap_err();
        assert!(err.contains("usage"));
    }

    #[test]
    fn parses_distill_with_inline_text() {
        let cmd = parse_args(&args(&[
            "distill",
            "/vault",
            "--text",
            "some text",
            "--project",
            "rhizome",
            "--kind",
            "concept",
        ]))
        .unwrap();
        assert_eq!(
            cmd,
            Command::Distill {
                vault_path: PathBuf::from("/vault"),
                text: "some text".to_string(),
                project: Some("rhizome".to_string()),
                kind: Some("concept".to_string()),
            }
        );
    }

    #[test]
    fn parses_distill_from_file() {
        let dir = tempfile::TempDir::new().unwrap();
        let file = dir.path().join("note.txt");
        std::fs::write(&file, "file contents").unwrap();
        let cmd = parse_args(&args(&[
            "distill",
            "/vault",
            "--from",
            file.to_str().unwrap(),
        ]))
        .unwrap();
        assert_eq!(
            cmd,
            Command::Distill {
                vault_path: PathBuf::from("/vault"),
                text: "file contents".to_string(),
                project: None,
                kind: None,
            }
        );
    }

    #[test]
    fn distill_requires_text_or_from() {
        let err = parse_args(&args(&["distill", "/vault"])).unwrap_err();
        assert!(err.contains("--text or --from"));
    }

    #[test]
    fn distill_rejects_both_text_and_from() {
        let err = parse_args(&args(&[
            "distill", "/vault", "--text", "a", "--from", "b.txt",
        ]))
        .unwrap_err();
        assert!(err.contains("only one"));
    }

    #[test]
    fn parses_import_source() {
        let cmd = parse_args(&args(&[
            "import-source",
            "/vault",
            "https://example.com",
            "--project",
            "rhizome",
        ]))
        .unwrap();
        assert_eq!(
            cmd,
            Command::ImportSource {
                vault_path: PathBuf::from("/vault"),
                source: "https://example.com".to_string(),
                project: Some("rhizome".to_string()),
            }
        );
    }

    #[test]
    fn parses_repo_research_with_defaults() {
        let cmd = parse_args(&args(&["repo-research", "/vault", "owner/repo"])).unwrap();
        assert_eq!(
            cmd,
            Command::RepoResearch {
                vault_path: PathBuf::from("/vault"),
                repo: "owner/repo".to_string(),
                mode: "architecture".to_string(),
                depth: "fast".to_string(),
                project: None,
            }
        );
    }

    #[test]
    fn parses_repo_research_with_overrides() {
        let cmd = parse_args(&args(&[
            "repo-research",
            "/vault",
            "owner/repo",
            "--mode",
            "hidden-lessons",
            "--depth",
            "deep",
            "--project",
            "rhizome",
        ]))
        .unwrap();
        assert_eq!(
            cmd,
            Command::RepoResearch {
                vault_path: PathBuf::from("/vault"),
                repo: "owner/repo".to_string(),
                mode: "hidden-lessons".to_string(),
                depth: "deep".to_string(),
                project: Some("rhizome".to_string()),
            }
        );
    }

    #[test]
    fn grok_import_is_an_unknown_subcommand() {
        let err = parse_args(&args(&["grok-import", "/vault", "--list"])).unwrap_err();
        assert!(err.contains("unknown subcommand"));
    }

    #[test]
    fn parses_graph_subcommand() {
        let cmd = parse_args(&args(&["graph", "/vault"])).unwrap();
        assert_eq!(
            cmd,
            Command::Graph {
                vault_path: PathBuf::from("/vault"),
            }
        );
    }

    #[test]
    fn graph_rejects_missing_vault() {
        let err = parse_args(&args(&["graph"])).unwrap_err();
        assert!(err.contains("usage"));
    }

    #[test]
    fn graph_rejects_extra_args() {
        let err = parse_args(&args(&["graph", "/vault", "extra"])).unwrap_err();
        assert!(err.contains("usage"));
    }

    #[test]
    fn parses_graph_query_health() {
        let cmd = parse_args(&args(&["graph-query", "/vault", "health"])).unwrap();
        assert_eq!(
            cmd,
            Command::GraphQuery {
                vault_path: PathBuf::from("/vault"),
                query: GraphQuery::Health,
            }
        );
    }

    #[test]
    fn parses_graph_query_orphans_with_limit() {
        let cmd = parse_args(&args(&["graph-query", "/vault", "orphans", "--limit", "5"])).unwrap();
        assert_eq!(
            cmd,
            Command::GraphQuery {
                vault_path: PathBuf::from("/vault"),
                query: GraphQuery::Orphans { limit: 5 },
            }
        );
    }

    #[test]
    fn parses_graph_query_neighbors_with_depth() {
        let cmd = parse_args(&args(&[
            "graph-query",
            "/vault",
            "neighbors",
            "Alpha",
            "--depth",
            "2",
        ]))
        .unwrap();
        assert_eq!(
            cmd,
            Command::GraphQuery {
                vault_path: PathBuf::from("/vault"),
                query: GraphQuery::Neighbors {
                    note: "Alpha".to_string(),
                    depth: 2,
                },
            }
        );
    }

    #[test]
    fn parses_graph_query_path_between_two_notes() {
        let cmd = parse_args(&args(&["graph-query", "/vault", "path", "Alpha", "Beta"])).unwrap();
        assert_eq!(
            cmd,
            Command::GraphQuery {
                vault_path: PathBuf::from("/vault"),
                query: GraphQuery::Path {
                    from: "Alpha".to_string(),
                    to: "Beta".to_string(),
                },
            }
        );
    }

    #[test]
    fn graph_query_rejects_an_unknown_kind() {
        let err = parse_args(&args(&["graph-query", "/vault", "wat"])).unwrap_err();
        assert!(err.contains("usage"), "got: {err}");
    }

    #[test]
    fn graph_query_rejects_neighbors_without_a_note() {
        let err = parse_args(&args(&["graph-query", "/vault", "neighbors"])).unwrap_err();
        assert!(err.contains("usage"), "got: {err}");
    }

    #[test]
    fn parses_save_capture_with_every_flag() {
        let cmd = parse_args(&args(&[
            "save-capture",
            "/vault",
            "https://example.com/a",
            "--title",
            "A Page",
            "--context",
            "Why it matters.",
            "--text",
            "Body.",
            "--trigger",
            "browser_extension",
        ]))
        .unwrap();
        assert_eq!(
            cmd,
            Command::SaveCapture {
                vault_path: PathBuf::from("/vault"),
                capture: CaptureRequest {
                    title: "A Page".to_string(),
                    source: "https://example.com/a".to_string(),
                    context: "Why it matters.".to_string(),
                    body: "Body.".to_string(),
                },
                trigger: "browser_extension".to_string(),
            }
        );
    }

    #[test]
    fn save_capture_needs_only_a_source_and_defaults_the_trigger() {
        let cmd = parse_args(&args(&["save-capture", "/vault", "https://example.com/a"])).unwrap();
        assert_eq!(
            cmd,
            Command::SaveCapture {
                vault_path: PathBuf::from("/vault"),
                capture: CaptureRequest {
                    source: "https://example.com/a".to_string(),
                    ..Default::default()
                },
                // Same default every other verb in this binary uses: an
                // external caller that did not say who it is, is an agent.
                trigger: "agent".to_string(),
            }
        );
    }

    #[test]
    fn save_capture_rejects_a_missing_source() {
        let err = parse_args(&args(&["save-capture", "/vault"])).unwrap_err();
        assert!(err.contains("usage"), "got: {err}");
    }

    #[test]
    fn rejects_unknown_subcommand() {
        let err = parse_args(&args(&["frobnicate", "/vault"])).unwrap_err();
        assert!(err.contains("unknown subcommand"));
    }

    #[test]
    fn rejects_empty_argv() {
        let err = parse_args(&args(&[])).unwrap_err();
        assert!(err.contains("missing subcommand"));
    }
}

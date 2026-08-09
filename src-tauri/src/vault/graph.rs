//! Wiki graph builder — nodes are notes, edges are wikilinks and
//! frontmatter relationships. Pure data transform over scanned
//! `VaultEntry` values: no filesystem walking, no Tauri types, so it is
//! reusable from the GUI command layer, the `rhizome-tool` sidecar, and
//! MCP alike (same pattern as `rhizome_api`).
//!
//! Wikilink targets that resolve to no note become **ghost nodes**
//! (`ghost:` id prefix) — the "not written yet" surface the graph view
//! turns into a one-click create action.

use super::entry::VaultEntry;
use super::path_identity;
use serde::Serialize;
use std::collections::{BTreeSet, HashMap};
use std::path::Path;

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GraphDto {
    pub nodes: Vec<GraphNode>,
    pub edges: Vec<GraphEdge>,
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct GraphNode {
    /// Resolved notes: vault-relative path. Ghosts: `ghost:` + normalized target.
    pub id: String,
    pub path: Option<String>,
    pub title: String,
    #[serde(rename = "isA")]
    pub is_a: Option<String>,
    pub ghost: bool,
    pub snippet: String,
    /// Unix seconds (frontend `relativeDate` expects seconds, not ms).
    pub modified_at: Option<u64>,
    /// Phosphor icon name from the note's frontmatter, if any.
    pub icon: Option<String>,
    pub link_count: usize,
    pub backlink_count: usize,
}

#[derive(Debug, Serialize, PartialEq, Eq, PartialOrd, Ord, Clone)]
#[serde(rename_all = "camelCase")]
pub struct GraphEdge {
    pub source: String,
    pub target: String,
    pub kind: String,
    /// Original frontmatter field name when `kind == "relationship"`.
    pub field: Option<String>,
}

/// `parse_md_file` copies these out of `relationships` into typed
/// `VaultEntry` fields, but leaves the originals in the map — skip them
/// when emitting generic relationship edges or they'd double-emit.
const TYPED_RELATIONSHIP_KEYS: [&str; 4] = ["belongs_to", "Belongs to", "related_to", "Related to"];

/// Synthetic relationship inserted by `parse_md_file` from `is_a` — not
/// user-authored. Excluded: type grouping is already conveyed by node
/// color, and types without a type document would pollute the graph with
/// high-degree junk ghosts (`ghost:note` with hundreds of backlinks).
const SYNTHETIC_RELATIONSHIP_KEY: &str = "Type";

/// Strip `[[`/`]]` brackets and a `|display` alias part, trim.
/// `outgoing_links` targets arrive already bracket-free; frontmatter
/// relationship values keep their brackets — this handles both.
fn strip_target(raw: &str) -> String {
    let inner = raw.trim();
    let inner = inner.strip_prefix("[[").unwrap_or(inner);
    let inner = inner.strip_suffix("]]").unwrap_or(inner);
    let inner = inner.split('|').next().unwrap_or(inner);
    inner.trim().to_string()
}

fn normalize_key(raw: &str) -> String {
    strip_target(raw).to_lowercase()
}

fn path_without_md(rel_path: &str) -> String {
    rel_path.strip_suffix(".md").unwrap_or(rel_path).to_string()
}

fn filename_stem(rel_path: &str) -> String {
    let name = rel_path.rsplit('/').next().unwrap_or(rel_path);
    path_without_md(name)
}

struct Resolver {
    /// normalized key → node id (vault-relative path).
    index: HashMap<String, String>,
}

impl Resolver {
    /// Insertion precedence (first wins), entries iterated sorted by path:
    /// relative path minus `.md` → filename stem → title → each alias.
    fn build(entries: &[(String, &VaultEntry)]) -> Self {
        let mut index = HashMap::new();
        let insert = |key: String, id: &str, index: &mut HashMap<String, String>| {
            if !key.is_empty() {
                index.entry(key).or_insert_with(|| id.to_string());
            }
        };
        for (rel_path, _) in entries {
            insert(
                path_without_md(rel_path).to_lowercase(),
                rel_path,
                &mut index,
            );
        }
        for (rel_path, _) in entries {
            insert(filename_stem(rel_path).to_lowercase(), rel_path, &mut index);
        }
        for (rel_path, entry) in entries {
            insert(entry.title.trim().to_lowercase(), rel_path, &mut index);
        }
        for (rel_path, entry) in entries {
            for alias in &entry.aliases {
                insert(alias.trim().to_lowercase(), rel_path, &mut index);
            }
        }
        Resolver { index }
    }

    /// Resolve a raw wikilink target to a node id, or `None` (→ ghost).
    fn resolve(&self, raw_target: &str) -> Option<&String> {
        let key = normalize_key(raw_target);
        if key.is_empty() {
            return None;
        }
        if key.contains('/') {
            if let Some(id) = self.index.get(&path_without_md(&key)) {
                return Some(id);
            }
        }
        self.index.get(&key)
    }
}

/// Build the wiki graph from scanned entries. `vault_path` is needed to
/// relativize `VaultEntry.path` (which `scan_vault` leaves absolute).
pub fn build_graph(vault_path: &Path, entries: &[VaultEntry]) -> GraphDto {
    let mut relativized: Vec<(String, &VaultEntry)> = entries
        .iter()
        .filter(|e| e.file_kind == "markdown")
        .filter_map(|e| {
            path_identity::vault_relative_path_string(vault_path, Path::new(&e.path))
                .ok()
                .filter(|rel| !rel.is_empty())
                .map(|rel| (rel, e))
        })
        .collect();
    relativized.sort_by(|a, b| a.0.cmp(&b.0));

    let resolver = Resolver::build(&relativized);

    // Ghost id → display title (first-seen stripped target text).
    let mut ghosts: HashMap<String, String> = HashMap::new();
    let mut edge_set: BTreeSet<GraphEdge> = BTreeSet::new();

    let add_edge = |source: &str,
                    raw_target: &str,
                    kind: &str,
                    field: Option<&str>,
                    edge_set: &mut BTreeSet<GraphEdge>,
                    ghosts: &mut HashMap<String, String>| {
        let stripped = strip_target(raw_target);
        if stripped.is_empty() {
            return;
        }
        let target_id = match resolver.resolve(raw_target) {
            Some(id) => id.clone(),
            None => {
                let ghost_id = format!("ghost:{}", normalize_key(raw_target));
                ghosts.entry(ghost_id.clone()).or_insert(stripped);
                ghost_id
            }
        };
        if target_id == source {
            return;
        }
        edge_set.insert(GraphEdge {
            source: source.to_string(),
            target: target_id,
            kind: kind.to_string(),
            field: field.map(str::to_string),
        });
    };

    for (rel_path, entry) in &relativized {
        for target in &entry.outgoing_links {
            add_edge(
                rel_path,
                target,
                "wikilink",
                None,
                &mut edge_set,
                &mut ghosts,
            );
        }
        for target in &entry.belongs_to {
            add_edge(
                rel_path,
                target,
                "belongs_to",
                None,
                &mut edge_set,
                &mut ghosts,
            );
        }
        for target in &entry.related_to {
            add_edge(
                rel_path,
                target,
                "related_to",
                None,
                &mut edge_set,
                &mut ghosts,
            );
        }
        let mut fields: Vec<&String> = entry
            .relationships
            .keys()
            .filter(|k| !TYPED_RELATIONSHIP_KEYS.contains(&k.as_str()))
            .filter(|k| k.as_str() != SYNTHETIC_RELATIONSHIP_KEY)
            .collect();
        fields.sort();
        for field in fields {
            for target in &entry.relationships[field] {
                add_edge(
                    rel_path,
                    target,
                    "relationship",
                    Some(field),
                    &mut edge_set,
                    &mut ghosts,
                );
            }
        }
    }

    let edges: Vec<GraphEdge> = edge_set.into_iter().collect();

    let mut out_degree: HashMap<&str, usize> = HashMap::new();
    let mut in_degree: HashMap<&str, usize> = HashMap::new();
    for edge in &edges {
        *out_degree.entry(edge.source.as_str()).or_default() += 1;
        *in_degree.entry(edge.target.as_str()).or_default() += 1;
    }

    let mut nodes: Vec<GraphNode> = relativized
        .iter()
        .map(|(rel_path, entry)| GraphNode {
            id: rel_path.clone(),
            path: Some(rel_path.clone()),
            title: entry.title.clone(),
            is_a: entry.is_a.clone(),
            ghost: false,
            snippet: entry.snippet.clone(),
            modified_at: entry.modified_at,
            icon: entry.icon.clone(),
            link_count: out_degree.get(rel_path.as_str()).copied().unwrap_or(0),
            backlink_count: in_degree.get(rel_path.as_str()).copied().unwrap_or(0),
        })
        .collect();
    nodes.extend(ghosts.iter().map(|(id, title)| GraphNode {
        id: id.clone(),
        path: None,
        title: title.clone(),
        is_a: None,
        ghost: true,
        snippet: String::new(),
        modified_at: None,
        icon: None,
        link_count: 0,
        backlink_count: in_degree.get(id.as_str()).copied().unwrap_or(0),
    }));
    nodes.sort_by(|a, b| a.id.cmp(&b.id));

    GraphDto { nodes, edges }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn entry(rel_path: &str, title: &str) -> VaultEntry {
        VaultEntry {
            path: format!("/vault/{rel_path}"),
            filename: rel_path.rsplit('/').next().unwrap_or(rel_path).to_string(),
            title: title.to_string(),
            file_kind: "markdown".to_string(),
            ..Default::default()
        }
    }

    fn vault() -> &'static Path {
        Path::new("/vault")
    }

    fn edge_pairs(dto: &GraphDto) -> Vec<(String, String, String)> {
        dto.edges
            .iter()
            .map(|e| (e.source.clone(), e.target.clone(), e.kind.clone()))
            .collect()
    }

    fn node(dto: &GraphDto, id: &str) -> GraphNode {
        dto.nodes
            .iter()
            .find(|n| n.id == id)
            .cloned()
            .unwrap_or_else(|| panic!("node {id} not found"))
    }

    #[test]
    fn resolves_wikilink_by_title() {
        let mut a = entry("notes/a.md", "Alpha");
        a.outgoing_links = vec!["Beta Note".to_string()];
        let b = entry("notes/b.md", "Beta Note");

        let dto = build_graph(vault(), &[a, b]);

        assert_eq!(
            edge_pairs(&dto),
            vec![(
                "notes/a.md".to_string(),
                "notes/b.md".to_string(),
                "wikilink".to_string()
            )]
        );
    }

    #[test]
    fn resolves_wikilink_by_filename_stem() {
        let mut a = entry("notes/a.md", "Alpha");
        a.outgoing_links = vec!["b".to_string()];
        let b = entry("notes/b.md", "Beta Note");

        let dto = build_graph(vault(), &[a, b]);

        assert_eq!(dto.edges[0].target, "notes/b.md");
    }

    #[test]
    fn resolves_wikilink_by_alias() {
        let mut a = entry("notes/a.md", "Alpha");
        a.outgoing_links = vec!["The B".to_string()];
        let mut b = entry("notes/b.md", "Beta Note");
        b.aliases = vec!["The B".to_string()];

        let dto = build_graph(vault(), &[a, b]);

        assert_eq!(dto.edges[0].target, "notes/b.md");
    }

    #[test]
    fn resolves_wikilink_by_relative_path() {
        let mut a = entry("notes/a.md", "Alpha");
        a.outgoing_links = vec!["projects/deep/b".to_string()];
        let b = entry("projects/deep/b.md", "Beta Note");

        let dto = build_graph(vault(), &[a, b]);

        assert_eq!(dto.edges[0].target, "projects/deep/b.md");
    }

    #[test]
    fn resolution_is_case_insensitive() {
        let mut a = entry("notes/a.md", "Alpha");
        a.outgoing_links = vec!["bEtA nOtE".to_string()];
        let b = entry("notes/b.md", "Beta Note");

        let dto = build_graph(vault(), &[a, b]);

        assert_eq!(dto.edges[0].target, "notes/b.md");
    }

    #[test]
    fn strips_alias_display_text_from_bracketed_targets() {
        let mut a = entry("notes/a.md", "Alpha");
        a.belongs_to = vec!["[[Beta Note|shown text]]".to_string()];
        let b = entry("notes/b.md", "Beta Note");

        let dto = build_graph(vault(), &[a, b]);

        assert_eq!(dto.edges[0].target, "notes/b.md");
        assert_eq!(dto.edges[0].kind, "belongs_to");
    }

    #[test]
    fn path_precedence_beats_title_collision() {
        // A note whose title equals another note's stem: path/stem keys
        // are inserted before titles, so the stem owner wins the bare key.
        let mut a = entry("notes/a.md", "Alpha");
        a.outgoing_links = vec!["b".to_string()];
        let b = entry("notes/b.md", "Whatever");
        let impostor = entry("notes/c.md", "b");

        let dto = build_graph(vault(), &[a, b, impostor]);

        assert_eq!(dto.edges[0].target, "notes/b.md");
    }

    #[test]
    fn unresolved_target_becomes_ghost_node() {
        let mut a = entry("notes/a.md", "Alpha");
        a.outgoing_links = vec!["Never Written".to_string()];

        let dto = build_graph(vault(), &[a]);

        let ghost = node(&dto, "ghost:never written");
        assert!(ghost.ghost);
        assert_eq!(ghost.title, "Never Written");
        assert_eq!(ghost.path, None);
        assert_eq!(ghost.backlink_count, 1);
        assert_eq!(
            edge_pairs(&dto),
            vec![(
                "notes/a.md".to_string(),
                "ghost:never written".to_string(),
                "wikilink".to_string()
            )]
        );
    }

    #[test]
    fn ghost_nodes_dedupe_across_referrers() {
        let mut a = entry("notes/a.md", "Alpha");
        a.outgoing_links = vec!["Never Written".to_string()];
        let mut b = entry("notes/b.md", "Beta");
        b.outgoing_links = vec!["never written".to_string()];

        let dto = build_graph(vault(), &[a, b]);

        let ghost_count = dto.nodes.iter().filter(|n| n.ghost).count();
        assert_eq!(ghost_count, 1);
        assert_eq!(node(&dto, "ghost:never written").backlink_count, 2);
    }

    #[test]
    fn frontmatter_belongs_to_and_related_to_emit_typed_edges() {
        let mut a = entry("notes/a.md", "Alpha");
        a.belongs_to = vec!["[[Beta Note]]".to_string()];
        a.related_to = vec!["[[Gamma]]".to_string()];
        let b = entry("notes/b.md", "Beta Note");
        let c = entry("notes/c.md", "Gamma");

        let dto = build_graph(vault(), &[a, b, c]);

        let kinds: Vec<&str> = dto.edges.iter().map(|e| e.kind.as_str()).collect();
        assert!(kinds.contains(&"belongs_to"));
        assert!(kinds.contains(&"related_to"));
    }

    #[test]
    fn dynamic_relationship_fields_emit_edges_with_field_name() {
        let mut a = entry("notes/a.md", "Alpha");
        a.relationships
            .insert("Topics".to_string(), vec!["[[Beta Note]]".to_string()]);
        let b = entry("notes/b.md", "Beta Note");

        let dto = build_graph(vault(), &[a, b]);

        assert_eq!(dto.edges[0].kind, "relationship");
        assert_eq!(dto.edges[0].field.as_deref(), Some("Topics"));
    }

    #[test]
    fn typed_keys_in_relationships_map_do_not_double_emit() {
        // parse_md_file leaves belongs_to/related_to copies in the map.
        let mut a = entry("notes/a.md", "Alpha");
        a.belongs_to = vec!["[[Beta Note]]".to_string()];
        a.relationships
            .insert("belongs_to".to_string(), vec!["[[Beta Note]]".to_string()]);
        let b = entry("notes/b.md", "Beta Note");

        let dto = build_graph(vault(), &[a, b]);

        assert_eq!(dto.edges.len(), 1);
        assert_eq!(dto.edges[0].kind, "belongs_to");
    }

    #[test]
    fn synthetic_type_relationship_is_excluded() {
        // parse_md_file inserts relationships["Type"] from is_a — synthetic,
        // and would create junk high-degree ghosts for typeless-doc types.
        let mut a = entry("notes/a.md", "Alpha");
        a.is_a = Some("Note".to_string());
        a.relationships
            .insert("Type".to_string(), vec!["[[note]]".to_string()]);

        let dto = build_graph(vault(), &[a]);

        assert!(dto.edges.is_empty());
        assert_eq!(dto.nodes.iter().filter(|n| n.ghost).count(), 0);
    }

    #[test]
    fn duplicate_edges_deduped_and_self_links_dropped() {
        let mut a = entry("notes/a.md", "Alpha");
        a.outgoing_links = vec!["Beta Note".to_string(), "beta note".to_string()];
        a.relationships
            .insert("Self".to_string(), vec!["[[Alpha]]".to_string()]);
        let b = entry("notes/b.md", "Beta Note");

        let dto = build_graph(vault(), &[a, b]);

        assert_eq!(dto.edges.len(), 1);
    }

    #[test]
    fn degree_counts_match_edges() {
        let mut a = entry("notes/a.md", "Alpha");
        a.outgoing_links = vec!["Beta Note".to_string()];
        a.belongs_to = vec!["[[Beta Note]]".to_string()];
        let mut b = entry("notes/b.md", "Beta Note");
        b.outgoing_links = vec!["Alpha".to_string()];

        let dto = build_graph(vault(), &[a, b]);

        let a_node = node(&dto, "notes/a.md");
        let b_node = node(&dto, "notes/b.md");
        assert_eq!(a_node.link_count, 2);
        assert_eq!(a_node.backlink_count, 1);
        assert_eq!(b_node.link_count, 1);
        assert_eq!(b_node.backlink_count, 2);
    }

    #[test]
    fn non_markdown_entries_are_excluded() {
        let mut img = entry("attachments/pic.png", "pic");
        img.file_kind = "binary".to_string();
        let a = entry("notes/a.md", "Alpha");

        let dto = build_graph(vault(), &[img, a]);

        assert_eq!(dto.nodes.len(), 1);
        assert_eq!(dto.nodes[0].id, "notes/a.md");
    }

    #[test]
    fn output_is_deterministic() {
        let mut a = entry("notes/a.md", "Alpha");
        a.outgoing_links = vec!["Beta Note".to_string(), "Ghost One".to_string()];
        let mut b = entry("notes/b.md", "Beta Note");
        b.outgoing_links = vec!["Alpha".to_string(), "Ghost Two".to_string()];

        let first = build_graph(vault(), &[a.clone(), b.clone()]);
        let second = build_graph(vault(), &[b, a]);

        let ids = |dto: &GraphDto| dto.nodes.iter().map(|n| n.id.clone()).collect::<Vec<_>>();
        assert_eq!(ids(&first), ids(&second));
        assert_eq!(edge_pairs(&first), edge_pairs(&second));
    }

    #[test]
    fn node_carries_snippet_and_modified_at_seconds() {
        let mut a = entry("notes/a.md", "Alpha");
        a.snippet = "First line of the note".to_string();
        a.modified_at = Some(1_752_350_000);

        let dto = build_graph(vault(), &[a]);

        let n = node(&dto, "notes/a.md");
        assert_eq!(n.snippet, "First line of the note");
        assert_eq!(n.modified_at, Some(1_752_350_000));
    }

    /// Normalization parity with the real body parser: feed targets the
    /// actual `extract_outgoing_links` produced from a fixture note.
    #[test]
    fn resolves_targets_produced_by_real_parser() {
        let body = "Linking [[Beta Note|the beta]] and [[missing page]] here.";
        let targets = super::super::parsing::extract_outgoing_links(body);

        let mut a = entry("notes/a.md", "Alpha");
        a.outgoing_links = targets;
        let b = entry("notes/b.md", "Beta Note");

        let dto = build_graph(vault(), &[a, b]);

        let targets: Vec<&str> = dto.edges.iter().map(|e| e.target.as_str()).collect();
        assert!(targets.contains(&"notes/b.md"));
        assert!(targets.contains(&"ghost:missing page"));
    }
}

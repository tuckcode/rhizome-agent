//! Scoped, structured queries over the wiki graph — the agent-facing half
//! of `graph.rs`. `build_graph` answers "draw me everything"; these answer
//! the questions an agent actually asks: what is near this note, what
//! connects nothing, what links point at notes that were never written.
//!
//! Everything here is a pure transform over a `GraphDto`, so it is
//! testable without a vault and reusable from the GUI command layer, the
//! `rhizome-tool` sidecar, and MCP alike.

use super::graph::{GraphDto, GraphEdge, GraphNode};
use serde::Serialize;
use std::collections::{HashMap, HashSet, VecDeque};

/// A note (or ghost) as an agent wants to see it: enough to name it,
/// judge it, and open it — never the whole `GraphNode`.
#[derive(Debug, Serialize, Clone, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct NoteRef {
    pub id: String,
    pub title: String,
    pub path: Option<String>,
    #[serde(rename = "isA")]
    pub is_a: Option<String>,
    pub ghost: bool,
    pub link_count: usize,
    pub backlink_count: usize,
}

impl From<&GraphNode> for NoteRef {
    fn from(node: &GraphNode) -> Self {
        NoteRef {
            id: node.id.clone(),
            title: node.title.clone(),
            path: node.path.clone(),
            is_a: node.is_a.clone(),
            ghost: node.ghost,
            link_count: node.link_count,
            backlink_count: node.backlink_count,
        }
    }
}

/// The vault's shape in one call — the numbers that change behaviour,
/// not a picture to browse.
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GraphHealth {
    /// Notes that exist on disk.
    pub notes: usize,
    /// Wikilink targets with no note behind them yet (ghosts).
    pub uncreated: usize,
    pub links: usize,
    pub wikilinks: usize,
    pub relationships: usize,
    /// Notes with no links in *or* out.
    pub orphans: usize,
    /// Edges pointing at a note that was never written.
    pub dead_links: usize,
    pub most_connected: Vec<NoteRef>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OrphanReport {
    pub notes: Vec<NoteRef>,
    pub total: usize,
    /// True when `notes` is shorter than `total` — never cap silently.
    pub truncated: bool,
}

/// One note that was linked to but never written, plus everyone who
/// wanted it. Grouped this way because the unit of work is *write the
/// missing note*, not *visit each link*.
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DeadLinkTarget {
    pub id: String,
    pub title: String,
    pub wanted_by: Vec<NoteRef>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DeadLinkReport {
    pub targets: Vec<DeadLinkTarget>,
    /// Distinct uncreated notes, before truncation.
    pub total: usize,
    /// Individual edges across all of them.
    pub link_count: usize,
    pub truncated: bool,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Neighbor {
    #[serde(flatten)]
    pub note: NoteRef,
    /// Hops from the root, following links in either direction.
    pub distance: usize,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Neighborhood {
    pub root: NoteRef,
    pub depth: usize,
    pub nodes: Vec<Neighbor>,
    /// Every edge among root + nodes, so a caller can draw this subgraph.
    pub edges: Vec<GraphEdge>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PathReport {
    pub from: NoteRef,
    pub to: NoteRef,
    pub connected: bool,
    /// Endpoints included; empty when `connected` is false.
    pub hops: Vec<NoteRef>,
}

/// Depth is bounded so a bad argument cannot ask for the whole vault
/// under the guise of a neighbourhood.
pub const MAX_DEPTH: usize = 5;

fn node_index(dto: &GraphDto) -> HashMap<&str, &GraphNode> {
    dto.nodes.iter().map(|n| (n.id.as_str(), n)).collect()
}

/// Links in both directions. A neighbourhood that only followed outgoing
/// links would call a heavily-cited note isolated.
fn adjacency(dto: &GraphDto) -> HashMap<&str, Vec<&str>> {
    let mut adj: HashMap<&str, Vec<&str>> = HashMap::new();
    for edge in &dto.edges {
        adj.entry(edge.source.as_str())
            .or_default()
            .push(edge.target.as_str());
        adj.entry(edge.target.as_str())
            .or_default()
            .push(edge.source.as_str());
    }
    for targets in adj.values_mut() {
        targets.sort_unstable();
        targets.dedup();
    }
    adj
}

fn normalize(raw: &str) -> String {
    raw.trim().to_lowercase()
}

fn strip_md(raw: &str) -> &str {
    raw.strip_suffix(".md").unwrap_or(raw)
}

fn stem(raw: &str) -> &str {
    strip_md(raw).rsplit('/').next().unwrap_or(raw)
}

/// Resolve what a caller typed to a node id. An agent will say "Alpha"
/// or "notes/alpha.md" or "alpha" and mean the same note; failing on the
/// wrong one of those is a tool that looks broken.
///
/// Exact id wins, then case-insensitive id, then path without `.md`,
/// then title, then filename stem — most specific first, so a title that
/// happens to match another note's stem cannot steal an exact hit.
pub fn resolve_note<'a>(dto: &'a GraphDto, query: &str) -> Option<&'a GraphNode> {
    let wanted = normalize(query);
    if wanted.is_empty() {
        return None;
    }

    let matchers: [fn(&GraphNode, &str) -> bool; 5] = [
        |n, w| n.id == w,
        |n, w| normalize(&n.id) == w,
        |n, w| normalize(strip_md(&n.id)) == w,
        |n, w| normalize(&n.title) == w,
        |n, w| normalize(stem(&n.id)) == w,
    ];

    // The first matcher compares against the raw query, not the
    // lowercased one — ids are case-sensitive paths.
    if let Some(hit) = dto.nodes.iter().find(|n| n.id == query.trim()) {
        return Some(hit);
    }
    for matcher in &matchers[1..] {
        if let Some(hit) = dto.nodes.iter().find(|n| matcher(n, &wanted)) {
            return Some(hit);
        }
    }
    None
}

pub fn health(dto: &GraphDto) -> GraphHealth {
    let notes = dto.nodes.iter().filter(|n| !n.ghost).count();
    let uncreated = dto.nodes.len() - notes;
    let wikilinks = dto.edges.iter().filter(|e| e.kind == "wikilink").count();
    let dead_links = dto
        .edges
        .iter()
        .filter(|e| e.target.starts_with("ghost:"))
        .count();

    // Ranked on links between notes that *exist*. Counting ghosts here
    // would crown a note that links to five pages nobody wrote, which is
    // the opposite of well-connected.
    let mut real_degree: HashMap<&str, usize> = HashMap::new();
    for edge in &dto.edges {
        if edge.source.starts_with("ghost:") || edge.target.starts_with("ghost:") {
            continue;
        }
        *real_degree.entry(edge.source.as_str()).or_default() += 1;
        *real_degree.entry(edge.target.as_str()).or_default() += 1;
    }
    let mut most_connected: Vec<&GraphNode> = dto.nodes.iter().filter(|n| !n.ghost).collect();
    most_connected.sort_by(|a, b| {
        real_degree
            .get(b.id.as_str())
            .cmp(&real_degree.get(a.id.as_str()))
            .then_with(|| a.id.cmp(&b.id))
    });

    GraphHealth {
        notes,
        uncreated,
        links: dto.edges.len(),
        wikilinks,
        relationships: dto.edges.len() - wikilinks,
        orphans: dto
            .nodes
            .iter()
            .filter(|n| !n.ghost && n.link_count == 0 && n.backlink_count == 0)
            .count(),
        dead_links,
        most_connected: most_connected
            .into_iter()
            .filter(|n| real_degree.contains_key(n.id.as_str()))
            .take(10)
            .map(NoteRef::from)
            .collect(),
    }
}

pub fn orphans(dto: &GraphDto, limit: usize) -> OrphanReport {
    let all: Vec<NoteRef> = dto
        .nodes
        .iter()
        .filter(|n| !n.ghost && n.link_count == 0 && n.backlink_count == 0)
        .map(NoteRef::from)
        .collect();
    let total = all.len();

    OrphanReport {
        notes: all.into_iter().take(limit).collect(),
        total,
        truncated: total > limit,
    }
}

pub fn dead_links(dto: &GraphDto, limit: usize) -> DeadLinkReport {
    let index = node_index(dto);
    let mut wanted: HashMap<&str, Vec<NoteRef>> = HashMap::new();

    for edge in &dto.edges {
        if !edge.target.starts_with("ghost:") {
            continue;
        }
        if let Some(source) = index.get(edge.source.as_str()) {
            wanted
                .entry(edge.target.as_str())
                .or_default()
                .push(NoteRef::from(*source));
        }
    }

    let link_count = wanted.values().map(Vec::len).sum();
    let total = wanted.len();

    let mut targets: Vec<DeadLinkTarget> = wanted
        .into_iter()
        .map(|(id, mut sources)| {
            sources.sort_by(|a, b| a.id.cmp(&b.id));
            DeadLinkTarget {
                id: id.to_string(),
                title: index
                    .get(id)
                    .map(|n| n.title.clone())
                    .unwrap_or_else(|| id.trim_start_matches("ghost:").to_string()),
                wanted_by: sources,
            }
        })
        .collect();
    // Most-wanted first: the note five others reference is worth writing
    // before the one referenced once.
    targets.sort_by(|a, b| {
        b.wanted_by
            .len()
            .cmp(&a.wanted_by.len())
            .then_with(|| a.title.cmp(&b.title))
    });

    DeadLinkReport {
        truncated: total > limit,
        targets: targets.into_iter().take(limit).collect(),
        total,
        link_count,
    }
}

pub fn neighbors(dto: &GraphDto, query: &str, depth: usize) -> Option<Neighborhood> {
    let root = resolve_note(dto, query)?;
    let depth = depth.clamp(1, MAX_DEPTH);
    let index = node_index(dto);
    let adj = adjacency(dto);

    let mut distances: HashMap<&str, usize> = HashMap::from([(root.id.as_str(), 0)]);
    let mut queue: VecDeque<(&str, usize)> = VecDeque::from([(root.id.as_str(), 0)]);

    while let Some((id, distance)) = queue.pop_front() {
        if distance == depth {
            continue;
        }
        for next in adj.get(id).into_iter().flatten() {
            if distances.contains_key(next) {
                continue;
            }
            distances.insert(next, distance + 1);
            // A ghost is a leaf by construction — it has no note to read
            // outgoing links from, so nothing is lost by not expanding it.
            queue.push_back((next, distance + 1));
        }
    }

    let mut nodes: Vec<Neighbor> = distances
        .iter()
        .filter(|(id, _)| **id != root.id)
        .filter_map(|(id, distance)| {
            index.get(id).map(|node| Neighbor {
                note: NoteRef::from(*node),
                distance: *distance,
            })
        })
        .collect();
    nodes.sort_by(|a, b| {
        a.distance
            .cmp(&b.distance)
            .then_with(|| a.note.id.cmp(&b.note.id))
    });

    let included: HashSet<&str> = distances.keys().copied().collect();
    let edges: Vec<GraphEdge> = dto
        .edges
        .iter()
        .filter(|e| included.contains(e.source.as_str()) && included.contains(e.target.as_str()))
        .cloned()
        .collect();

    Some(Neighborhood {
        root: NoteRef::from(root),
        depth,
        nodes,
        edges,
    })
}

pub fn shortest_path(dto: &GraphDto, from: &str, to: &str) -> Option<PathReport> {
    let start = resolve_note(dto, from)?;
    let goal = resolve_note(dto, to)?;
    let index = node_index(dto);
    let adj = adjacency(dto);

    let mut came_from: HashMap<&str, &str> = HashMap::new();
    let mut seen: HashSet<&str> = HashSet::from([start.id.as_str()]);
    let mut queue: VecDeque<&str> = VecDeque::from([start.id.as_str()]);
    let mut found = start.id == goal.id;

    while let Some(id) = queue.pop_front() {
        if id == goal.id {
            found = true;
            break;
        }
        for next in adj.get(id).into_iter().flatten() {
            if !seen.insert(next) {
                continue;
            }
            came_from.insert(next, id);
            queue.push_back(next);
        }
    }

    let mut hops: Vec<NoteRef> = Vec::new();
    if found {
        let mut cursor = goal.id.as_str();
        loop {
            if let Some(node) = index.get(cursor) {
                hops.push(NoteRef::from(*node));
            }
            match came_from.get(cursor) {
                Some(previous) => cursor = previous,
                None => break,
            }
        }
        hops.reverse();
    }

    Some(PathReport {
        from: NoteRef::from(start),
        to: NoteRef::from(goal),
        connected: found,
        hops,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::vault::entry::VaultEntry;
    use crate::vault::graph::build_graph;
    use std::path::Path;

    fn entry(rel_path: &str, title: &str, links: &[&str]) -> VaultEntry {
        VaultEntry {
            path: format!("/vault/{rel_path}"),
            filename: rel_path.rsplit('/').next().unwrap_or(rel_path).to_string(),
            title: title.to_string(),
            file_kind: "markdown".to_string(),
            outgoing_links: links.iter().map(|s| s.to_string()).collect(),
            ..Default::default()
        }
    }

    /// index → Alpha, Beta;  alpha → Gamma, "Missing Note" (ghost);
    /// lonely is linked from nothing and links to nothing.
    fn fixture() -> GraphDto {
        build_graph(
            Path::new("/vault"),
            &[
                entry("index.md", "Index", &["Alpha", "Beta"]),
                entry("notes/alpha.md", "Alpha", &["Gamma", "Missing Note"]),
                entry("notes/beta.md", "Beta", &[]),
                entry("notes/gamma.md", "Gamma", &[]),
                entry("notes/lonely.md", "Lonely", &[]),
            ],
        )
    }

    #[test]
    fn health_counts_notes_ghosts_orphans_and_dead_links() {
        let health = health(&fixture());

        assert_eq!(health.notes, 5);
        assert_eq!(health.uncreated, 1);
        assert_eq!(health.links, 4);
        assert_eq!(health.orphans, 1);
        assert_eq!(health.dead_links, 1);
        assert_eq!(
            health.most_connected.first().map(|n| n.id.as_str()),
            Some("index.md")
        );
    }

    #[test]
    fn most_connected_ignores_links_to_notes_that_do_not_exist() {
        let dto = build_graph(
            Path::new("/vault"),
            &[
                entry("hub.md", "Hub", &["A", "B"]),
                entry("a.md", "A", &[]),
                entry("b.md", "B", &[]),
                entry(
                    "wishful.md",
                    "Wishful",
                    &["Nope One", "Nope Two", "Nope Three"],
                ),
            ],
        );

        let report = health(&dto);
        let ranked: Vec<&str> = report
            .most_connected
            .iter()
            .map(|n| n.id.as_str())
            .collect();

        assert_eq!(ranked.first(), Some(&"hub.md"));
        assert!(!ranked.contains(&"wishful.md"), "ranked: {ranked:?}");
    }

    #[test]
    fn orphans_are_real_notes_with_no_links_either_way() {
        let found = orphans(&fixture(), 100);

        assert_eq!(
            found
                .notes
                .iter()
                .map(|n| n.id.as_str())
                .collect::<Vec<_>>(),
            vec!["notes/lonely.md"]
        );
        assert_eq!(found.total, 1);
        assert!(!found.truncated);
    }

    #[test]
    fn orphans_reports_truncation_rather_than_capping_silently() {
        let dto = build_graph(
            Path::new("/vault"),
            &[
                entry("a.md", "A", &[]),
                entry("b.md", "B", &[]),
                entry("c.md", "C", &[]),
            ],
        );

        let found = orphans(&dto, 2);

        assert_eq!(found.notes.len(), 2);
        assert_eq!(found.total, 3);
        assert!(found.truncated);
    }

    #[test]
    fn dead_links_group_by_the_note_that_was_never_written() {
        let found = dead_links(&fixture(), 100);

        assert_eq!(found.total, 1);
        let first = &found.targets[0];
        assert_eq!(first.title, "Missing Note");
        assert_eq!(first.wanted_by.len(), 1);
        assert_eq!(first.wanted_by[0].id, "notes/alpha.md");
    }

    #[test]
    fn neighbors_walks_both_directions_and_reports_distance() {
        let found = neighbors(&fixture(), "Alpha", 1).expect("alpha resolves");

        assert_eq!(found.root.id, "notes/alpha.md");
        let mut ids: Vec<&str> = found.nodes.iter().map(|n| n.note.id.as_str()).collect();
        ids.sort();
        assert_eq!(
            ids,
            vec!["ghost:missing note", "index.md", "notes/gamma.md"]
        );
        assert!(found.nodes.iter().all(|n| n.distance == 1));
    }

    #[test]
    fn neighbors_at_depth_two_reaches_a_sibling_through_the_hub() {
        let found = neighbors(&fixture(), "notes/alpha.md", 2).expect("alpha resolves");

        let beta = found
            .nodes
            .iter()
            .find(|n| n.note.id == "notes/beta.md")
            .expect("beta reached at depth 2");
        assert_eq!(beta.distance, 2);
    }

    #[test]
    fn neighbors_resolves_a_note_by_title_path_or_filename_stem() {
        let dto = fixture();

        for query in ["Alpha", "notes/alpha.md", "notes/alpha", "alpha"] {
            let found =
                neighbors(&dto, query, 1).unwrap_or_else(|| panic!("{query} should resolve"));
            assert_eq!(found.root.id, "notes/alpha.md", "query was {query}");
        }
    }

    #[test]
    fn neighbors_returns_none_for_a_note_that_is_not_in_the_vault() {
        assert!(neighbors(&fixture(), "No Such Note", 1).is_none());
    }

    #[test]
    fn shortest_path_finds_the_shortest_route_between_two_notes() {
        let found = shortest_path(&fixture(), "Beta", "Gamma").expect("both resolve");

        assert!(found.connected);
        assert_eq!(
            found.hops.iter().map(|n| n.id.as_str()).collect::<Vec<_>>(),
            vec![
                "notes/beta.md",
                "index.md",
                "notes/alpha.md",
                "notes/gamma.md"
            ]
        );
    }

    #[test]
    fn shortest_path_reports_no_connection_rather_than_failing() {
        let found = shortest_path(&fixture(), "Lonely", "Alpha").expect("both resolve");

        assert!(!found.connected);
        assert!(found.hops.is_empty());
    }

    #[test]
    fn shortest_path_returns_none_when_an_endpoint_does_not_resolve() {
        assert!(shortest_path(&fixture(), "Lonely", "No Such Note").is_none());
    }
}

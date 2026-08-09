//! Manual parity check: Rust resident index vs Python `rhizome-search`.
//! Not part of `cargo test` — needs network (ONNX model download) and a
//! real vault. Run with:
//!
//!   cargo run --example rhizome_search_parity -- "<vault path>" "query one" "query two" ...
//!
//! See docs/plans/2026-07-08-step3-absorb-search-scope.md (One Brain step 3a).

use rhizome_lib::rhizome_search::embedder::FastEmbedTextEmbedder;
use rhizome_lib::rhizome_search::{index_dir_for_vault, RhizomeSearchIndex};

fn main() {
    let mut args = std::env::args().skip(1);
    let vault_path = args.next().expect("usage: <vault path> <query>...");
    let queries: Vec<String> = args.collect();
    let queries = if queries.is_empty() {
        vec!["memory".to_string()]
    } else {
        queries
    };

    let vault_path = std::path::Path::new(&vault_path);
    let cache_dir = index_dir_for_vault(vault_path)
        .expect("resolve cache dir")
        .join("model");

    println!("Loading BGE-small-en-v1.5 (downloads on first run)...");
    let mut embedder = FastEmbedTextEmbedder::new(&cache_dir).expect("load embedder");

    let mut index = RhizomeSearchIndex::open_or_create(vault_path).expect("open index");
    let start = std::time::Instant::now();
    let count = index.reindex_all(&mut embedder).expect("reindex");
    println!("Indexed {count} documents in {:?}", start.elapsed());

    for query in &queries {
        println!("\n=== query: {query:?} ===");
        let start = std::time::Instant::now();
        let hits = index.search(query, 10, &mut embedder).expect("search");
        let elapsed = start.elapsed();
        for hit in &hits {
            println!("  {:.4}  {}", hit.score, hit.id);
        }
        println!("  ({} results, {:?})", hits.len(), elapsed);
    }
}

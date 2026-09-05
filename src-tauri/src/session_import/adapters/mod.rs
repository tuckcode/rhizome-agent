//! Per-source readers that turn an app's export or session log into candidates.
//!
//! Adapters only parse — they never decide whether to import. That decision is
//! `dedup::decide`, so a new source cannot invent its own dedup behaviour.

pub mod claude_code;
pub mod claude_code_scan;

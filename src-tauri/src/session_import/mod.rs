//! Importing chat history from other harnesses.
//!
//! Slice 0 of `docs/plans/2026-09-01-session-import-plan.md`: the parts that
//! decide *whether* a session should be imported. Adapters, the Prime/vault
//! writers, and the UI come in later slices and build on these.
//!
//! Nothing here reads a third-party app's files or writes to Prime — it is pure
//! decision logic over candidates an adapter has already parsed, which is what
//! makes the dedup rules testable without fixtures from five different apps.

pub mod adapters;
pub mod dedup;
pub mod fingerprint;
pub mod ledger;
pub mod preview;
pub mod selection;
pub mod vault_note;

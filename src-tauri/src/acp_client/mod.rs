//! Generic Agent Client Protocol client.
//!
//! Rhizome is a client of harnesses ([ADR-0177](../../../docs/adr/0177-rhizome-is-a-client-of-harnesses.md)).
//! This module speaks ACP over stdio JSON-RPC so any ACP agent — Hermes today,
//! another harness later — can own the loop. It is not a Hermes fork and does
//! not vendor harness code.

mod client;
mod events;
mod permission;
mod protocol;

pub(crate) use client::{run_acp_prompt, AcpLaunch, AcpSessionRequest};

#[cfg(test)]
mod client_tests;

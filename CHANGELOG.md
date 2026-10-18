# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html) where releases are tagged.

## [Unreleased]

### Added

- Rhizome-native chat engine as the primary loop (ADR-0187); Prime remains optional.
- Native tool registry: unknown tool names fail closed at the loop.
- Read-only file tools in the native loop: `read_file`, `list_dir`, `grep`, and `glob` (with output and walk caps).
- Mutate file tools: `edit_file` and `write_file`, with approval previews and session grants.
- Secret-path denylist for native file tools, with a settings override.
- Power User `bash` tool: run-command approval UI, vault-scoped execution, and Windows-focused test coverage in CI (ongoing hardening).

### Changed

- Settings and provider preset flows updated for the native-engine direction (model chips, env handling, Packages marketplace removal).

### Fixed

- Native edit/write approval previews: review holds, diff presentation, and temp-file handling.
- Write permission checks routed through `resolve_for_write` after secret-file policy changes.

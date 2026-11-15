---
session: 2026-11-14T13:38-06:00
model: GPT-6
description: Update the Rust coverage tool for Cargo 1.100.
---

# Rust coverage tool

Cargo 1.100 stores Rust test executables in its new build directory layout.
The version 0.8.5 reporter does not collect all coverage from this layout.
The CI workflow now pins the official installer revision for cargo-llvm-cov
0.9.1.

On main at `8e704704`, Rust 1.100.0 ran 2,890 tests successfully.
The 0.8.5 reporter measured 5.30% line coverage and failed the 85% check.
Version 0.9.1 measured 88.43% from the same binaries and test profiles.

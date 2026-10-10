---
type: ADR
id: "0184"
title: "Provider keys live in the OS keychain through the keyring crate"
status: active
date: 2026-10-10
---

**Origin:** Claude Code (Opus 5.5) · 2026-10-10 · step 3a of the [remaining-threads plan](../plans/2026-10-10-harness-remaining-threads.md)
**Decisions confirmed:** knispo · 2026-10-10 · D5 (move keys one at a time) and D8 (approve `keyring`)

## Context

[ADR-0182](0182-free-tier-provider-routing.md) decision 4 says user keys live in the OS keychain, one key per provider. Until now, Rhizome kept provider keys in `ai-provider-secrets.json` in the app config folder (`com.rhizome.app`), owner-only on Unix. That file exists on real machines. On 2026-10-10 the owner's file held 3 keys for custom OpenAI-compatible providers. ADR-0183 sets the crash rule for moving them: write, verify, then remove the old copy.

The free-tier router (`rhizome_routing`) reads keys through its `KeyStore` trait. Native Chat (step 2b) shipped with a store that read the JSON file directly.

## Decision

**Provider keys are stored in the OS keychain through the `keyring` crate (3.6.3), service `ai.rhizome.agent`, account = provider id. `provider_keys::ProviderKeys` is the one place that reads, saves, deletes, and migrates them.**

- macOS: Keychain (`apple-native`). Windows: Credential Manager (`windows-native`). Linux: Secret Service (`sync-secret-service`, `crypto-rust`). `dbus` is already in the lock file.
- Cloudflare's account id is a second entry, `<provider id>:account`.
- **Migration:** a key still in the legacy file moves the first time it is read. Rhizome writes it to the keychain, reads it back, and removes it from the file only on a match. The file is deleted when it holds no keys. A crash between the steps is safe: the next read finds the same value in both places and finishes the removal. If the write or the read-back fails, the file copy stays and keeps working, and the provider id (never the key) is logged.
- A keychain entry that differs from the file copy wins. The file copy is kept and reported rather than removed on a guess.
- Saving a key reads it back, then removes any legacy file copy, so an old key cannot shadow the new one.
- The stored setting name `api_key_storage: "local_file"` stays as-is, because settings on disk use it. It now means "a key Rhizome holds".
- **Test builds cannot reach the real keychain or the real key file.** `ProviderKeys::for_app()` returns an in-memory backend and a legacy path that never exists when `cfg(test)`. A real-keychain round trip exists only as an `#[ignore]` test run by hand.

## Options considered

- **Option A** (chosen): the `keyring` crate. One API over the three OS stores. MIT OR Apache-2.0. Widely used.
- **Option B**: platform crates directly (`security-framework`, Windows `wincred`, `secret-service`). The same result with three code paths to maintain.
- **Option C**: Tauri's Stronghold plugin. An encrypted file under a password Rhizome would have to manage. It is not the OS keychain that ADR-0182 names.
- **Option D**: keep the JSON file. Simple, but the keys sit in a plain file that backups and sync tools copy.

## Consequences

- Keys leave the plain file, with no user step. The first read of each key moves it.
- **Unsigned dev builds on macOS may show a keychain prompt** after a rebuild, because the code signature changes. The keychain asks whether the new binary may read an item the old one created. Signed release builds keep their access.
- The Secret Service needs a running keyring daemon on Linux. Without one, saving a key fails with a clear error, and a key still in the legacy file keeps working.
- A new dependency tree per platform (`security-framework` on macOS, `dbus-secret-service` on Linux).
- Re-evaluate if users report repeated keychain prompts in release builds, or if Linux without a Secret Service matters.

## Advice

knispo approved the keychain (ADR-0182 decision 4), the crate (D8), and the one-key-at-a-time migration (D5, ADR-0183) on 2026-10-10.

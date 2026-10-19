# AI agent not found

Source: troubleshooting/ai-agent-not-found.md
URL: /troubleshooting/ai-agent-not-found

Rhizome runs Prime Agent as a separate program. It can only use Prime when Prime is installed and Rhizome can find it.

You don't need Prime for Chat. Rhizome's own engine is the only chat engine, and Prime is no longer a chat engine (ADR-0189); its leftover code is still in the repo until the follow-up PRs.

## Symptoms

- Chat says Prime is missing.
- `prime-agent` works in one terminal but not from Rhizome.

## Checks

1. Open a terminal and run:

   ```bash
   prime-agent status
   ```

2. If the command isn't found, run `./install.sh` in your `rhizome-agent` folder. It installs Prime when it's missing.
3. If Prime is installed but not running, start the daemon:

   ```bash
   (prime-agent --mode daemon >/dev/null 2>&1 &) && sleep 2 && prime-agent status
   ```

## Path issues

Desktop apps can get a different `PATH` from your terminal. Rhizome checks common install locations, but shell setup varies. Install command-line tools in standard locations, or make them available from your login shell.

---

# Chat doesn't answer

Source: troubleshooting/chat-doesnt-answer.md
URL: /troubleshooting/chat-doesnt-answer

New chats use Rhizome's own engine (ADR-0187).

## Rhizome's engine

| You see | Do this |
|---|---|
| No key for the model | Add the key in Settings → AI Agents → API model (or Local model). Settings points you there |
| "No free-tier provider key is set." | Turn on at least one provider under **Taproot** and paste its key |
| A provider row says **Keychain error** | Unlock the keychain, or allow Rhizome to use it, then reopen Settings |
| A notice appears, but the reply goes on | Something went wrong that didn't stop the turn, such as part of the chat not being saved. Read the notice; the chat still works |
| The model can't be reached | Click **Test model** on the provider. See [Model provider connection](model-provider-connection.md) |
| Enter does nothing while a reply runs | Rhizome's engine takes one turn at a time. Wait for the reply, or press Stop |
| **Continue (12/50)** (your numbers may differ) | The step limit paused the turn. It is not a failure. Click Continue for 50 more rounds. **Agent max steps** changes the next message you type, not the size of Continue. See [Chat with the agent](../guides/use-ai-panel.md#when-a-turn-reaches-its-step-limit) |
| `Continue couldn't start:` | Read the reason on that line. The paused turn is still there and can be tried again |
| `<model> can't read images` | Remove the image, or pick a model that can read images. The message is not sent as text only |
| `Every model that can read images is cooling down. Try again shortly.` | Wait, then send again. Taproot does not switch to a text-only model to get an answer |
| Another window is already running this chat | Only one turn can run at a time. Wait, or continue in that window |

## Prime Agent

| You see | Do this |
|---|---|
| Prime is missing | Applies to Prime-locked chats only. Install Prime with `./install.sh`, run `prime-agent` once, and start the daemon (see [Install](../start/install.md#set-up-prime-legacy)) |
| Prime is installed, but Chat still says it's missing | Wait a few seconds. The check repeats. If it keeps failing, see [AI agent not found](ai-agent-not-found.md) |
| Chat stopped answering after you closed a terminal | Prime stops with the terminal that started it. Start it as a daemon: `(prime-agent --mode daemon >/dev/null 2>&1 &) && sleep 2 && prime-agent status` |
| The provider login expired | Run `prime-agent`, then `/login`. Settings no longer has a Prime sign-in |

## Either engine

| You see | Do this |
|---|---|
| No network | Notes on disk still open. Chat can't answer until the network is back, unless you use a local model |
| The window disappeared | The red button quits Rhizome unless **Keep in taskbar** is on. Reopen the app, or click the Dock icon |

---

# Git authentication

Source: troubleshooting/git-auth.md
URL: /troubleshooting/git-auth

Rhizome uses system Git authentication. It does not manage provider passwords directly.

## Symptoms

- Push fails.
- Pull asks for credentials repeatedly.
- Remote fetch works in one terminal but not in Rhizome.

## Checks

1. Open a terminal.
2. `cd` into the vault.
3. Run `git remote -v`.
4. Run `git fetch`.

If `git fetch` fails in the terminal, fix system Git auth first.

## Common fixes

- Sign in with GitHub CLI.
- Configure SSH keys.
- Update the remote URL.
- Check your credential helper.

---

# Model provider connection

Source: troubleshooting/model-provider-connection.md
URL: /troubleshooting/model-provider-connection

Use this checklist when a model provider doesn't answer. It applies to Rhizome's own engine. Prime handles its own providers; see [Chat doesn't answer](chat-doesnt-answer.md).

## Local providers

For Ollama or LM Studio:

1. Start the local model server.
2. Check that the base URL in Settings → AI Agents → Local model matches the server.
3. Check that the model ID is installed and loaded.
4. Click **Test model** again.

## Hosted providers

1. Check the provider kind and endpoint.
2. Check that the model ID exists for your account.
3. Check the key. With **Save locally in Rhizome**, the key is in the system keychain. With **Read from env var**, the variable must be set for the app, not only in your terminal.
4. Click **Test model**. It sends one short request with no tools.

Never store keys in the vault. Vault notes are committed and can be pushed.

## Keychain problems

If a Free tier provider row says **Keychain error**, the system keychain is locked or Rhizome isn't allowed to use it. Unlock it or allow access, then reopen Settings. Keys from older versions move to the keychain the first time they're read; don't edit a key file by hand.

## Taproot can't route

If no free provider has a key, Settings says "Add a key to at least one provider to use Taproot." Turn on a provider and paste its key. With **Strict mode** on, only Groq and your own endpoint are used. See [Free models and routing](../concepts/free-models-and-routing.md).

## No file tools

Rhizome's engine can read, search, edit, and create notes in the open vault. See [Agents, engines and models](../concepts/ai.md).

---

# Sync conflicts

Source: troubleshooting/sync-conflicts.md
URL: /troubleshooting/sync-conflicts

Sync conflicts happen when local and remote changes touch the same content.

## What to do

1. Stop editing the conflicted note.
2. Open the conflict resolver if Rhizome presents it.
3. Review both sides.
4. Choose the correct content or merge manually.
5. Commit the resolved file.
6. Push again.

## Prevent conflicts

- Pull before starting work on another device.
- Push after meaningful sessions.
- Keep AI-generated edits in small commits.
- Avoid editing the same note on multiple devices at the same time.

---

# Vault not loading

Source: troubleshooting/vault-not-loading.md
URL: /troubleshooting/vault-not-loading

Use this checklist when Rhizome cannot open or refresh a vault.

## Check the folder

- Confirm the folder exists.
- Confirm the folder contains readable files.
- Confirm Rhizome has permission to access the folder.
- Try opening a smaller test vault to isolate the issue.

## macOS folder permission

If the vault is in Documents, Desktop or Downloads, macOS must allow Rhizome to read it. Allow access when macOS asks, or turn it on in System Settings → Privacy & Security → Files and Folders. Or move the vault to another folder.

## Check Git

If the vault is a Git repository, verify it is not in a broken state:

```bash
git status
```

Resolve interrupted merges or corrupted repository state before retrying.

## Reload

Run `Reload Vault` from the command palette. This clears derived cache and rescans the filesystem.
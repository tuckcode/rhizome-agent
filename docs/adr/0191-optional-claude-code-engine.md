---
type: ADR
id: "0191"
title: "Optional Claude Code engine that drives the user's own install, with a harness marker on each session"
status: proposed
date: 2026-11-01
---

**Origin:** Claude Opus 5.5 · 2026-11-01 · Claude Code desktop session, on Atticus's question about T3 Code
**Status note:** Proposed. Atticus has not decided. Nothing here takes effect, and no engine code may land, until he accepts this ADR.
**Would amend if accepted:** [ADR-0187](0187-native-is-the-only-chat-engine.md) decision 1, [ADR-0189](0189-no-ties-to-outside-harnesses.md) decisions 3 and 7, and the sentence in [ADR-0186](0186-rhizome-sign-in-storage-and-provider-sign-in.md) decision 4 that says there is no Claude Code engine. The Claude API key rule in 0186 stays.
**Build plan:** [`docs/plans/2026-11-01-claude-code-engine-plan.md`](../plans/2026-11-01-claude-code-engine-plan.md)

## Context

Atticus asked if Claude can work in Rhizome as it does in T3 Code, with a marker per harness on each session.

**What T3 Code does.** T3 Code's README tells users to install Claude Code and run `claude auth login`. It then controls the agent that is already set up on the machine. Its Claude provider doc says that it uses Claude Code's own login and configuration. T3 Code does not need to hold a Claude token for this. A second account is a second `CLAUDE_CONFIG_DIR`.

**What Anthropic's legal page says** (read again 2026-11-01):

- Third-party developers may not offer Claude.ai login in their own applications.
- Third-party developers may not collect, store, or intermediate Claude.ai credentials or session tokens. Sign-in must complete through Anthropic's own flow.
- The page does not prevent an end user from signing in to the unmodified Claude Code binary with their own subscription.
- Preinstalling or running Claude Code in a product requires agreement to the Commercial Terms, unless Anthropic agrees otherwise. Two conditions apply. The binary stays unmodified, with every built-in authentication method left in place. The customer does not pay for, resell, or intermediate Claude usage: each end user authenticates and is billed under their own agreement.
- A product may say in plain text that it runs Claude Code. It may not use the Claude Code or Anthropic names or logos in its own product, feature, or company name, in its own logo, or in a way that suggests that Anthropic built, endorses, or partners with the product.

**What is already in the repo.** A hidden Claude Code path exists and works:

| Piece | State today |
| --- | --- |
| `src-tauri/src/claude_cli.rs` | Finds `claude`, runs `claude -p` with stream JSON, and maps events. It reads no Claude credential file. |
| `src-tauri/src/claude_invocation.rs` | Builds the flags. Agent turns use `--permission-mode acceptEdits`, `--strict-mcp-config`, the `rhizome` MCP server, and `--no-session-persistence`. Power User preapproves `Bash`. |
| `src-tauri/src/cli_agent_runtime.rs` | Shared process runner, PATH setup, version check, MCP config. |
| `src/lib/aiAgents.ts` | `claude_code` has `productVisible: false`, so `agentTargets()` does not offer it. |
| `src/lib/migrateRemovedHarnessChoices.ts` | Keeps `claude_code` as a CLI target "that is not a chat engine". |
| `public/ai-agent-icons/claude-code.svg` | The Claude mark. `SOURCES.md` says so. |
| `src/components/PrimeSessionList.tsx` | Shows no harness marker. The native session record already carries `target`. |

**The conflict.** ADR-0187 says native is the only chat engine. ADR-0189 says there is no setting that points chat at an outside harness, and that a new engine dependency needs a new ADR. ADR-0186 says there is no Claude Code engine, and records knispo's 2026-10-24 confirmation that Claude stays out of sign-in. This ADR is the new ADR that 0189 asks for. It reverses a recent owner decision, so only Atticus can accept it.

## Decision

**Proposed: Rhizome may drive the user's own installed, unmodified Claude Code as an optional engine for one chat at a time. Native stays the default and the only engine that Rhizome needs. Rhizome never offers Claude login and never reads or stores a Claude token.**

### 1. Position against the native-only rule

1. Native stays the default engine. Rhizome must work with no Claude Code present.
2. Claude Code is off until the user turns it on in Settings.
3. The user picks the engine when a chat starts. The chat keeps that engine for its whole life. There is no switch inside a chat.
4. Claude Code is never the app default. It never serves distill, inbox, jobs, titles, or any other turn that the user did not send. Those use native.
5. Only Claude Code gets this exception. Other outside harnesses still need their own ADR. Prime and Hermes stay out (0189).
6. The native-only rule of 0187 and 0189 becomes: native is the only engine that Rhizome owns or requires.

### 2. Sign-in and credentials

1. Rhizome has no Claude login button, no embedded web view, and no OAuth client for Claude.
2. Rhizome does not read `~/.claude/.credentials.json`, the Claude Code keychain item, or `~/.claude.json`.
3. Rhizome does not run `claude setup-token`, store its output, or pass `CLAUDE_CODE_OAUTH_TOKEN`.
4. Rhizome does not put its keychain Anthropic key into a Claude Code process.
5. Rhizome asks only `claude auth status --json` for login state. It keeps a yes or no and the method name, and it drops every other field.
6. A user who is not logged in sees plain text that tells them to run `claude auth login` in their terminal. Rhizome does not run that command for them.
7. Rhizome does not change Claude Code's authentication. It never removes or restricts a method, and it never picks the account. Claude Code chooses, as it does in the user's terminal.
8. The shell environment list in `claude_cli.rs` drops `ANTHROPIC_AUTH_TOKEN` for this engine, because that value is a bearer token that Rhizome would read from the user's shell. A variable already in the process environment passes through unread. A user-owned `ANTHROPIC_API_KEY` or cloud provider setting still applies, under the same rules as the terminal.

### 3. Commercial Terms condition

The engine does not ship until all four items hold:

1. **Atticus decides who accepts the Commercial Terms for Rhizome and records it.** He is the person who can bind the project. An agent cannot accept them, and this ADR does not claim that anyone has.
2. **The binary is the user's own.** Rhizome does not bundle, download, patch, wrap, or preinstall `claude`.
3. **Rhizome pays nothing for Claude usage.** Each user authenticates for themselves and is billed under their own agreement. There is no hosted Rhizome relay in this path.
4. **Atticus resolves the competing-product question.** The Commercial Terms bar access to the Services for building a competing product. Rhizome is a harness with its own agent loop. Whether that clause reaches Rhizome is a question for Anthropic or for a lawyer. This ADR does not answer it. The legal page names Anthropic sales for authentication questions.

If Rhizome becomes a paid or hosted product, repeat this check first. Check the legal page again before each release that changes this engine.

### 4. Harness marker

1. Every session row shows a small marker for its harness, and every open chat shows the same marker. Native chats show the Rhizome mark.
2. The Claude Code marker is a neutral icon from Phosphor (`Terminal`) with the plain text `Claude Code` as the visible label or tooltip and the accessible name. No Anthropic logo, Claude mark, or Anthropic brand color appears.
3. `AiAgentIcon` stops using `claude-code.svg` for this engine, before the target becomes visible. The file goes when nothing else uses it.
4. Rhizome uses `Claude Code` only as a plain description of what the chat runs. It does not name a Rhizome feature, plan, or setting so that the name reads as Rhizome's own or as a partnership. The Settings row reads as a statement: "Run chats with your installed Claude Code". The Settings page also says that Claude Code is Anthropic's product, and that Anthropic does not make or endorse Rhizome.
5. The marker comes from the session's stored `target`, so it stays correct after a restart.

### 5. Tools in Claude Code turns

Claude Code's own loop runs these turns. The Rhizome loop, tool registry, plugins, step limit, and model routing do not run in them. Rhizome limits what the process may do with flags, and it answers approvals through an MCP tool.

| Rule | Native | Claude Code turn |
| --- | --- | --- |
| Tool set | Registry | `--tools` allow-list: `Read,Edit,MultiEdit,Write,Glob,Grep,LS`, the `mcp__rhizome__*` tools, and `Bash` in Power User only |
| Read and search | No ask, vault and workspace only | No ask inside `cwd` and `--add-dir` paths. A read elsewhere reaches the approval tool, which denies it. |
| Edit, Limited | Ask every call | Ask every call through `--permission-prompt-tool`. The current `acceptEdits` flag goes. |
| Edit, Power User | No ask | `acceptEdits` |
| `bash`, Limited | Never offered | Not in `--tools` |
| `bash`, Power User | Ask every call | Ask every call. The current `Bash` preapproval goes. |
| Web, subagent, and task tools | Not in the core tool policy | Not in `--tools` |
| Approval failure | Fail closed | Bridge down, timeout, or app restart means deny |
| Cancel | Kill on cancel | Send SIGINT first, then SIGTERM. The headless doc says that SIGTERM leaves the turn unfinished. |

The approval tool is new work. It lives on the `rhizome` MCP server and shows the same approval UI as native. Earlier approvals never carry over to a resumed session (ADR-0183).

**Known gap.** Rhizome loads the user's own Claude Code settings (see Memory, item 3). A user who set `permissions.allow` rules or hooks in `~/.claude` keeps them in Rhizome turns. Such a rule may allow a call without a Rhizome prompt. `--tools` still caps the tool set. Settings states this in plain text. The engine must not claim that Rhizome approves every call.

### 6. Memory and context

1. **The vault stays the one memory authority.** Rhizome passes context with `--append-system-prompt` and gives vault access through the `rhizome` MCP server. Saved knowledge goes through Rhizome's tools.
2. **Claude Code auto memory is off for these turns.** Rhizome sets `CLAUDE_CODE_DISABLE_AUTO_MEMORY=1` on the process, or `autoMemoryEnabled: false` through `--settings`. This keeps a second memory store from growing beside the vault (0180 borrow care).
3. **Project content does not run.** Rhizome passes `--setting-sources user` and keeps `--strict-mcp-config`. Without these, a `-p` run in a vault folder runs that folder's hooks and connects its `.mcp.json` servers with no trust prompt. A synced vault must not gain code execution this way.
4. **The user's `~/.claude/CLAUDE.md` still loads.** The user's own Claude Code instructions apply, and Settings says so. Rhizome does not treat them as vault knowledge.
5. **Rhizome keeps its own record.** Each turn appends to the Rhizome session log with the ADR-0183 redaction, size, and damage rules. The record stores `target: agent:claude_code` and the Claude Code session id. It stores no credential.
6. **Claude Code's transcript stays Claude Code's.** Sessions persist so that `--resume <id>` works. The current `--no-session-persistence` flag goes for this engine. Rhizome does not read `~/.claude/projects/` to run a chat. The Settings import of Claude Code threads into vault notes is a separate feature and does not change.
7. **Search covers Rhizome's log.** Session search reads the Rhizome log. If a Claude Code session cannot resume, the Rhizome record still opens read-only.
8. **`import_jsonl` stays blocked.** This engine does not use it, wrap it, or add a route to it. Claude Code threads do not enter the session list by import. That work waits until Atticus says `1`.

### 7. Limits and billing

Turns draw on the user's own plan or key. Anthropic's support page, updated 2026-10-07, says that `claude -p`, the Agent SDK, and third-party app use draw on subscription limits today. It also records that a planned change was paused on 2026-06-15, so this may change. The legal page says that advertised limits assume ordinary, individual use. This is one more reason for decision 1.4: every turn is one that the user sent.

## Options considered

- **A (proposed): optional engine on the user's own `claude` binary.** Matches T3 Code and fits the legal page. Reuses `claude_cli.rs`. Costs an exception to the native-only rule and a split in what Rhizome's tool policy covers.
- **B: keep native only, Claude through an API key.** This is ADR-0186 as written. It needs no legal work and keeps one loop. It gives subscription users no way to use their plan in Rhizome, which is the ask.
- **C: Rhizome-owned Claude login or token reuse.** Rejected. The legal page forbids it, and 0186 already rejected it.
- **D: `--bare` runs.** Rejected. Bare mode is the cleanest isolation, but it reads no OAuth credential or keychain, so subscription login fails. See the risk below.
- **E: Agent SDK package or an ACP adapter (0178).** Not chosen for v1. `claude_cli.rs` already works, and the legal page covers the Agent SDK with the same API key guidance for developers. An adapter adds another party between Rhizome and the binary. I did not study either path in depth. The plan's probe step may reopen this.

## Consequences

- Rhizome gains subscription access to Claude with no Rhizome credential work.
- Two loops exist. A Rhizome feature that depends on the native loop (plugins, step limit, model routing, reasoning controls) does not reach Claude Code chats. The UI must not imply that it does.
- `claude_code` moves from hidden leftover to a product surface, so its tests and native QA become required.
- A chat cannot move between engines. A forked chat keeps its engine.
- Claude Code updates arrive outside Rhizome's release cycle. The stream format and flags may change without notice, and a version floor and a clear error must handle that.
- **Risk: bare default.** The headless doc says that `--bare` will become the default for `-p` in a future release, and bare mode does not use subscription login. If that ships with no opt-out, this design breaks for subscription users. Stable `-p` behaviour is a known unknown. Option E is the fallback to check.
- Anthropic may enforce or change these rules without notice. The engine stays optional so that Rhizome loses nothing core if it must come out.
- On acceptance, add `Amended` lines to 0186, 0187, and 0189, and update `CONTEXT.md` and `docs/IDENTITY.md`.

## Questions for Atticus

1. Accept, change, or reject this ADR.
2. Who accepts the Commercial Terms for Rhizome?
3. Does Atticus ask Anthropic about the competing-product clause before the build, or before release?

## Sources

Read 2026-11-01.

- Anthropic: https://code.claude.com/docs/en/legal-and-compliance ; https://www.anthropic.com/legal/commercial-terms ; https://code.claude.com/docs/en/headless ; https://code.claude.com/docs/en/cli-reference ; https://code.claude.com/docs/en/permissions ; https://code.claude.com/docs/en/memory ; https://support.claude.com/en/articles/15036540-use-the-claude-agent-sdk-with-your-claude-plan
- T3 Code: https://github.com/pingdotgg/t3code ; https://github.com/pingdotgg/t3code/blob/main/docs/user/providers-claude.md
- Local check: `claude --help` and `claude auth --help` on version 2.1.316.

[[0180-rhizome-is-its-own-harness]]
[[0183-save-native-chat-sessions]]
[[0186-rhizome-sign-in-storage-and-provider-sign-in]]
[[0187-native-is-the-only-chat-engine]]
[[0189-no-ties-to-outside-harnesses]]
[[0178-generic-acp-client]]

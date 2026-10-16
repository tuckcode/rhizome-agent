---
title: Why Rhizome
description: What makes Rhizome different from other agent harnesses, and what will feel familiar.
---

Rhizome gives an AI agent a memory you can see. The things worth keeping become notes in a folder you own, and you can check what the agent did to your files after the fact.

## The problem it solves

Most agent harnesses either forget everything when a session ends, or remember things in a store you can't easily read: a hidden memory file, a database, a cloud account. You can't tell what the agent "knows", fix it when it's wrong, or take it with you.

## Memory is a folder of Markdown

Rhizome keeps memory in a **vault**: an ordinary folder of Markdown files on your disk. You can start from a template with starter folders and note types, so you don't have to design a structure first. You can open the same files in any editor, search them with `grep`, and back them up however you like.

When a chat produces something worth keeping, you click **Save to vault**. Rhizome writes a note. Nothing is saved without a click unless you turn automatic saving on. [How memory works](../concepts/vault-as-memory.md)

## Git is the undo button

If the vault is a Git repository, every change to it can be committed, including the agent's changes. You can see what a note looked like before, see what changed, and revert it. Git is optional, but it's what makes agent memory safe to trust. [Git](../concepts/git.md)

## See where the agent went

**Mycelium** can replay an optional Prime session as a map. The folder that run worked in becomes a city of files, and each file it searched, read or edited lights up. When something breaks, you can see which files a run touched and where it went in circles. Mycelium uses the open-source Mindwalk project, which you install separately. It does not map chats from Rhizome's own engine. [Mycelium](../concepts/mycelium.md)

## Free models, routed for you

**Free tier (auto)** sends a chat to free hosted models (Groq, Mistral, LLM7, OpenRouter's free models, NVIDIA NIM) in a fixed order. When one fails or runs out of free use, Rhizome moves to the next. Models whose free tier trains on your prompts are left out. You can add your own endpoint as the last stop. It builds on two open-source projects, OmniRoute and freellmapi. [Free models and routing](../concepts/free-models-and-routing.md)

## Rhizome runs its own loop

An **agent loop** is the cycle that sends your message to a model, runs the tools the model asks for, and repeats until the answer is done. Rhizome has its own, and Chat uses it. You can also switch to an optional **engine**: another harness that runs the loop instead. Prime Agent is one of those. Hermes is a planned adapter, not usable today. The vault, the permissions and the memory stay with Rhizome.

Rhizome's own engine is new. Today it can create notes, and not much else. It can't read, search or edit files yet, and it can't search the vault. [Agents, engines and models](../concepts/ai.md)

## What will feel familiar

If you've used Claude Code, Hermes Agent, Cursor or Prime, most of the basics carry over:

| You know | In Rhizome |
|---|---|
| Sessions you can resume | Saved chats with automatic titles; Prime's session list when Prime is the engine |
| Tool approval | Permission modes: **Limited tools** and **Power User** |
| Bring your own model | Hosted providers, local models (Ollama, LM Studio), any OpenAI-compatible endpoint; keys in the system keychain |
| `CLAUDE.md` / `AGENTS.md` | A vault `AGENTS.md`, with `CLAUDE.md` kept as a compatibility file |
| MCP | Rhizome runs an MCP server, so other apps can read and write your vault |
| Past chat history | Import Claude Code chats into the vault |
| Extensions | Prime packages from Settings → Packages when Prime is the engine. Rhizome's own plugin system is planned |
| An editor | A rich Markdown editor with a raw mode, plus PDF and image previews, sheets, diagrams and whiteboards |
| A graph | The Wiki Graph: notes as nodes, links as edges |

[Coming from another harness](../guides/coming-from-other-harnesses.md) maps each one in detail.

## What it isn't yet

Rhizome is a macOS developer preview. You build it from source; there is no signed download or in-app updater. Rhizome's own engine works without Prime. The install script can also fetch Prime Agent if you want that optional engine.

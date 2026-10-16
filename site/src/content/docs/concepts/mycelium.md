---
title: Mycelium
description: Replay where an optional Prime run went, meaning which files it searched, read and edited. Uses Mindwalk.
---

Mycelium shows where an agent run went. It draws the folder the run worked in as a map of files, and lights up each file the agent searched, read or edited. Use it to see a run's scope at a glance, find where it went in circles, or check which files a run touched before something broke.

Mycelium uses [Mindwalk](https://github.com/cosmtrek/mindwalk) (MIT) © 2026 Ricko Yu. Mindwalk replays coding-agent sessions on a city map of a repository. You install it yourself; Rhizome doesn't include it or rebrand it.

## What you see

- **The map.** Each file in the folder is a building. The layout is fixed for a given folder, so the same file is always in the same place and two runs can be compared by eye.
- **The footprint.** Files the run searched, read or edited are highlighted. A tight cluster means a focused run. Scattered light, or the same files lit again and again, means the agent was searching or going in circles.
- **Sessions.** A column lists past sessions by title. Pick one to see its footprint, or look at the overview across all sessions.

## Before you start

1. Install Mindwalk so that the `mindwalk` program is on your path. See [Mindwalk](https://github.com/cosmtrek/mindwalk) for install steps.
2. Mycelium currently reads sessions from `~/.prime/agent/sessions/`, so it only maps runs from Prime as an optional engine. It doesn't show chats from Rhizome's own engine, and the agent can't search old Mycelium sessions. You don't need Prime to use Rhizome.

If Mindwalk is missing, Mycelium says **Install Mindwalk, then retry**.

## Open it

- In Chat, click the **Mycelium** button in the Prime session header to see the current session's footprint.
- In the sessions list, right-click a Prime session and choose **Show in Mycelium**.
- From the **Views** group on the left rail, choose Mycelium. The shortcut is Ctrl+⌘3 on a Mac and Ctrl+Shift+3 on Windows.

## Find what touched a broken file

Mycelium can't filter sessions by file yet, but the map makes it quick to check by eye:

1. Open Mycelium and look at the overview across sessions.
2. Find the file on the map. It's always in the same place.
3. Open the sessions where it lights up, newest first.
4. Open that session's chat to see what the agent did, and the vault or repository history to see the change.

## What it needs

- **A session that used tools.** A chat with no file activity draws an empty map.
- **A real working folder.** The map is drawn from the folder the run worked in. A run that only touched the vault draws a small, sparse map.

## What it isn't

Mycelium shows where a run went. It doesn't save anything to memory and doesn't replace Git. For what's in the vault, use the Graph view (see [Relationships](relationships.md)). For what changed, use the Changes view and [Git](git.md).

## Related

- [Your vault is the agent's memory](vault-as-memory.md)
- [Chat with the agent](../guides/use-ai-panel.md)

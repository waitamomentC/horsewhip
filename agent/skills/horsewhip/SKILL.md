---
name: horsewhip
description: >-
  Use Horsewhip before editing code in a git repo: lock a file boundary via MCP,
  whip sound on lock and on task complete, ask the user before expanding the
  boundary, never edit outside the pasture. Requires horsewhip MCP; full
  experience includes the VS Code/Cursor Horsewhip extension for visualization.
---

# Horsewhip — AI boundary workflow

Before changing any project files, define the **pasture** (allowed paths). Do not edit outside it. If you need more scope, ask the user first.

## When to use

- The user asks you to implement, fix, refactor, or otherwise **modify files**
- The workspace is a **git repo** with **horsewhip MCP** configured
- **Full install**: Horsewhip VS Code/Cursor extension installed → after `lock_paths`, locked paths should appear in the timeline/boundary bar and you should hear the whip on ceremony/complete

## Standard flow (follow in order)

1. **Scope** — Call `horsewhip_suggest_scope` if useful, or infer a candidate path list from the task.
2. **Lock** — Call `horsewhip_lock_paths` with workspace-relative paths (e.g. `src/ui/a.tsx`).
3. **Whip (lock)** — Right after a successful `lock_paths`, call `horsewhip_whip_ceremony({ "phase": "lock" })`.
   - Extension installed: whip sound + boundary bar shows the pasture.
   - Extension not installed: tools still succeed; no UI/sound.
4. **Edit inside the pasture** — Only touch paths on the allowlist.
5. **On overreach** — If a save is blocked, `get_boundary` shows you outside the fence, or `.git/horsewhip/edit-blocked.json` exists, **stop immediately**:
   - Tell the user: current pasture is …; to do … you need …; ask whether to expand.
   - User agrees → `horsewhip_expand_boundary` → optional `horsewhip_whip_ceremony({ "phase": "expand" })` → continue
   - User declines → find an in-pasture approach only; never silently edit outside
6. **Task done** — When in-pasture work satisfies the user’s goal:
   - Call `horsewhip_task_complete({ "summary": "one-line what you did" })` — second whip; hand off to the user
   - Remind the user to **`git commit` themselves** (do not commit for them; no `--no-verify`)
7. **Unlock (optional)** — When the user ends the session or switches tasks → `horsewhip_unlock`

## Whip ceremony (do not skip)

| When | Required call | Meaning |
|------|----------------|---------|
| After lock succeeds | `horsewhip_whip_ceremony` `phase="lock"` | Boundary set; start editing |
| Task wrapped up | `horsewhip_task_complete` | In-pasture work finished; return control |

The two whips mirror manual “whip to lock” and “done for the day” on the graph.

## Forbidden

- Batch-editing files before `horsewhip_lock_paths`
- Skipping `whip_ceremony` or `task_complete`
- Calling `expand_boundary` without explicit user approval
- `git commit --no-verify` to bypass guards
- Committing or pushing on behalf of the user

## MCP tools

| Tool | Purpose |
|------|---------|
| `horsewhip_lock_paths` | Lock allowed paths |
| `horsewhip_unlock` | Clear boundary |
| `horsewhip_get_boundary` | Current allowlist + block markers |
| `horsewhip_expand_boundary` | Merge paths after user agrees |
| `horsewhip_suggest_scope` | Suggest paths from task (stub in 4A) |
| `horsewhip_whip_ceremony` | Whip + UI on lock/expand |
| `horsewhip_task_complete` | Closing whip + toast |

## Extension vs MCP

- **Extension**: timeline UI, manual whip, edit/commit guards.
- **MCP + this skill**: agent-driven pasture and discipline.
- **Full install** = MCP + skill + extension; MCP locks must be **visible** in the panel (boundary bar + file-rail highlights).

See [agent/README.md](../../README.md) and [docs/boundary-guard.md](../../../docs/boundary-guard.md).

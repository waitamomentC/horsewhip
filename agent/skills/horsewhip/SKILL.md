---
name: horsewhip
description: >-
  MANDATORY when user types /horsewhip or asks to use Horsewhip boundary workflow.
  Lock minimum file paths via MCP before any edits; whip on lock and task complete;
  ask before expand_boundary; never edit outside pasture. Triggers: /horsewhip,
  horsewhip, 挥鞭, 圈定, boundary lock, lock paths before edit.
---

# Horsewhip — AI boundary workflow

## Forced invocation: `/horsewhip`

When the user message **starts with `/horsewhip`** or they pick the **`/horsewhip` slash command** (Cursor: `.cursor/commands/horsewhip.md`; Claude Code: `/horsewhip` skill slash):

1. Treat this as **mandatory** — do **not** edit files until the workflow below completes.
2. Strip the `/horsewhip` prefix; the remainder (same message) is the task.
3. Follow every step in **Standard flow** and **Minimum lock** without shortcuts.

If the user did **not** use `/horsewhip`, still apply this skill when they ask to implement/fix/refactor **with boundary discipline** or mention horsewhip / 圈定 / 挥鞭.

Before changing any project files, define the **pasture** (allowed paths). Do not edit outside it. If you need more scope, ask the user first.

## Minimum lock (hard rules — MCP enforces)

**`horsewhip_lock_paths` rejects overly broad paths.** You must lock the **smallest** set that can complete the task.

| Allowed on first lock | Rejected on first lock |
|-----------------------|-------------------------|
| Specific files: `src/auth/login.ts`, `README.md`, `package.json` | Top-level dirs: `src/`, `lib/`, `tests/`, `docs/` |
| Deep subdirs only (≥2 segments): `src/auth/`, `packages/foo/src/` | Bare names: `src`, `lib` (no extension, no trailing `/`) |
| Up to **8** paths in one lock call | `__root__` (whole repo) |
| | More than 8 paths at once |

**Need a wider pasture?** Do **not** guess. Tell the user what extra paths you need and why → after explicit approval → `horsewhip_expand_boundary` (can add `src/`, more files, etc.).

**Bad:** lock `src/` because “all code is under src”. **Good:** lock only files you will edit for this task (often 1–3 paths).

## When to use

- The user asks you to implement, fix, refactor, or otherwise **modify files**
- The workspace is a **git repo** with **horsewhip MCP** configured
- **Full install**: Horsewhip VS Code/Cursor extension installed → after `lock_paths`, locked paths should appear in the timeline/boundary bar and you should hear the whip on ceremony/complete

## Standard flow (follow in order)

1. **Scope** — List the **minimum** files this task will touch (read/search first). Call `horsewhip_suggest_scope` if useful.
2. **Lock** — Call `horsewhip_lock_paths` with those **specific files** (e.g. `src/ui/a.tsx`). Use a deep subdir (`src/ui/`) only when the task truly edits many files in that folder.
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

- Locking `src/`, `lib/`, or other top-level directories on first lock (MCP will error)
- Locking “just in case” paths you might not edit
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

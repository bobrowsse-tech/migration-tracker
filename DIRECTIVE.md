
# Build Directive — Migration-in-Progress Tracker

> Rank **#5** in the Unbuilt VS Code Tools roadmap. This directive is written for an AI coding agent (Claude Code, Copilot agent mode, or a human following along) to execute directly. This repository already contains a working scaffold — activation, side-panel dashboard, command registration, and a Language Model Tool stub — following the suite conventions (TypeScript strict, esbuild bundle, WebviewView dashboard, shared VS Code–free service module, Language Model Tool). Everything marked `TODO` below is the real remaining work.

## 1. Objective

Let a team define a migration as an old-pattern-to-new-pattern AST matcher, scan the repo to produce a checked-in call-site inventory, and surface live progress (e.g. 312/480 migrated) in the status bar with a sidebar list that jumps straight to the next unmigrated call site.

## 2. Why this doesn't already exist

Codemod tools like jscodeshift do the one-time rewrite well but provide no persistent, shared sense of how far along a migration is — that state lives in someone's head or a stale spreadsheet until the last commit lands.

## 3. VS Code surfaces this extension uses

- **Activity bar view container**: `migration-trackerContainer` (icon: `arrow-swap`)
- **Side panel dashboard**: `migration-trackerView`, a `WebviewViewProvider` — see `src/dashboardProvider.ts`
- **Commands**: `migrationTracker.define`, `migrationTracker.rescan`, `migrationTracker.jumpToNext`, `migrationTracker.viewProgress`
- **Language Model Tool**: `migration_status` — see `src/lmTool.ts` and `contributes.languageModelTools` in `package.json`. This is what lets Copilot Chat, Claude Code, or any other MCP/agent-aware surface invoke this extension's core action conversationally instead of the user hunting for the right command.

## 4. Dashboard (side panel) spec

The sidebar webview is the primary UI. It must show, at minimum, the buttons below plus a status/summary area above them (current scan state, last-run timestamp, or a short result summary — specifics depend on the feature, see phase notes).

| Button | Command | Behavior |
|---|---|---|
| **Define Migration** | `migrationTracker.define` | Opens a form to name a migration and specify the old/new pattern (as a small matcher DSL or a `ts-morph` snippet), saved to .migrations/<id>.json. |
| **Rescan** | `migrationTracker.rescan` | Re-runs the matcher across the workspace and updates the persisted call-site inventory and progress percentage. |
| **Jump to Next** | `migrationTracker.jumpToNext` | Opens the editor at the next unmigrated call site, cycling through the list. |
| **View Progress** | `migrationTracker.viewProgress` | Shows the full call-site list with status, plus a progress-over-time sparkline computed from git history of the inventory file. |

Buttons call `vscode.commands.executeCommand`, not the tool logic directly — keep exactly one implementation of the core logic (a plain TypeScript service module with no VS Code imports) called from three places: the command handler, the dashboard's message handler, and the Language Model Tool's `invoke`. Do not fork the logic across these three entry points.

## 5. Implementation phases

1. **Migration definition** — A migration is defined as `{id, name, oldPattern, newPattern, matcherKind: 'callExpression'|'importSpecifier'|'jsxElement'}` saved to `.migrations/<id>.json`. For v1, support matching by function/import name and call-shape via `ts-morph` (e.g. `oldPattern: 'lodash.get'`), leaving arbitrary AST-shape matchers as a documented v2 extension point.
2. **Scan & inventory** — Load the workspace as a `ts-morph` Project, find every node matching the migration's pattern, and write `.migrations/<id>.status.json`: `{ total, migrated, remaining: [{file, line, snippet}] }`. 'Migrated' is defined as zero remaining matches of `oldPattern`; track total as the historical high-water mark of matches ever seen, not just the current count, so progress can go up even as remaining count goes down.
3. **Progress persistence & history** — Check `.migrations/<id>.status.json` into git so `git log` on that file becomes a natural progress-over-time record; read that history with `simple-git` to render a sparkline without needing any external state store.
4. **Dashboard wiring** — WebviewView: migration picker (if more than one is defined), a progress bar with `migrated/total`, the remaining call-site list with jump links, and the four buttons above.
5. **Status bar** — A `vscode.StatusBarItem` showing `<migration name>: 312/480` for the active migration, clickable to open the sidebar.
6. **Language Model Tool** — Register `migration_status` so an agent picking up a migration mid-flight can ask what's left and go straight to the next call site instead of the developer re-deriving it.
7. **Tests** — Fixture repo with a known old-pattern usage count, asserting the scan finds exactly that count and that progress recalculates correctly after a fixture file is 'migrated' in a test copy.

## 6. Suggested dependencies

`ts-morph`, `simple-git`

Progress tracking does not require `jscodeshift` (no rewrite engine in v1). Pin resolved versions in `package.json`.

## 7. Edge cases & safety notes

- A call site that matches the old pattern but is inside a test fixture intentionally exercising legacy behavior — support a per-line `// migration-ignore:<id>` comment to exclude it.
- Renaming or moving a migrated file shouldn't reset progress — key call sites by a stable hash of their surrounding code, not just file:line, where feasible.

## 8. Definition of done

- [ ] Core logic lives in a VS Code-free service module, unit-tested against fixtures (see phase notes above for what fixtures to build).
- [ ] All buttons in the dashboard spec are wired to real behavior, not the placeholder `showInformationMessage` stub.
- [ ] The Language Model Tool calls the same service module and returns a concise, agent-readable text result (not raw JSON dumped as text).
- [ ] No destructive or external-write action (file rewrite, PR post, process kill) runs without an explicit user-initiated click — the LM tool path in particular must stay read/report-only unless the directive above says otherwise.
- [ ] `npm run package` produces a `dist/extension.js` with no bundling warnings; `vsce package` produces a `.vsix` that installs cleanly via `code --install-extension`.
- [ ] README.md (user-facing, not this directive) documents what the extension does in plain language, per `AGENTS.md`'s copy conventions.
    
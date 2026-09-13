# Migration-in-Progress Tracker

Turns a team-wide code migration into a shared, persistent progress view — not tribal knowledge. Definitions and status live in git under `.migrations/`.

## Install

```bash
git clone https://github.com/bobrowsse-tech/migration-tracker.git
cd migration-tracker
npm install
npm run package
npx @vscode/vsce package --no-dependencies
code --install-extension migration-tracker-0.1.0.vsix
```

Or press **F5** after `npm install`.

## Use

Open the **Migration-in-Progress Tracker** side panel (status bar shows `Migration: migrated/total`):

| Action | What it does |
|---|---|
| **Define Migration** | Old→new pattern (`callExpression`, `importSpecifier`, or `jsxElement`) → `.migrations/<id>.json` |
| **Rescan** | AST scan; updates `.migrations/<id>.status.json` (commit this so the team shares progress) |
| **Jump to Next** | Opens the next unmigrated site |
| **View Progress** | Progress bar, remaining list, sparkline from git history of the status file |

Ignore a site with `// migration-ignore:<id>` on the same or previous line.

Agents can call `migration_status` (report-only).

## How it’s built

TypeScript strict + esbuild + `ts-morph` + `simple-git`. Service module under `src/service/` is VS Code–free and unit-tested.

```bash
npm run watch
npm run test:unit
npm run package
```

## License

MIT

# Migration-in-Progress Tracker

Turns a team-wide code migration into a shared, persistent progress view — not tribal knowledge.

1. **Define Migration** — name an old→new pattern (`callExpression`, `importSpecifier`, or `jsxElement`) saved under `.migrations/<id>.json`.
2. **Rescan** — AST-scans the workspace and updates `.migrations/<id>.status.json` (commit this file so the team shares progress).
3. **Jump to Next** — opens the next unmigrated call site.
4. **View Progress** — progress bar, remaining list, and a sparkline from git history of the status file.

Status bar shows `Migration: 312/480`. Ignore a site with `// migration-ignore:<id>`.

Agents can call `migration_status` for a report-only progress summary.

## Development

```bash
npm install
npm run watch
npm run test:unit
```

Press `F5` in VS Code to launch an Extension Development Host.

## License

MIT

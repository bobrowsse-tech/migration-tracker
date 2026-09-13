import * as vscode from 'vscode';
import { DashboardProvider } from './dashboardProvider';
import { registerMigrationStatusTool } from './lmTool';

export function activate(context: vscode.ExtensionContext) {
  const dashboard = new DashboardProvider(context.extensionUri);
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider("migration-trackerView", dashboard)
  );

  context.subscriptions.push(vscode.commands.registerCommand("migrationTracker.define", () => {
    // TODO (Define Migration): Opens a form to name a migration and specify the old/new pattern (as a small matcher DSL or a `ts-morph` snippet), saved to .migrations/<id>.json.
    vscode.window.showInformationMessage("Define Migration \u2014 not yet implemented, see DIRECTIVE.md");
  }));

  context.subscriptions.push(vscode.commands.registerCommand("migrationTracker.rescan", () => {
    // TODO (Rescan): Re-runs the matcher across the workspace and updates the persisted call-site inventory and progress percentage.
    vscode.window.showInformationMessage("Rescan \u2014 not yet implemented, see DIRECTIVE.md");
  }));

  context.subscriptions.push(vscode.commands.registerCommand("migrationTracker.jumpToNext", () => {
    // TODO (Jump to Next): Opens the editor at the next unmigrated call site, cycling through the list.
    vscode.window.showInformationMessage("Jump to Next \u2014 not yet implemented, see DIRECTIVE.md");
  }));

  context.subscriptions.push(vscode.commands.registerCommand("migrationTracker.viewProgress", () => {
    // TODO (View Progress): Shows the full call-site list with status, plus a progress-over-time sparkline computed from git history of the inventory file.
    vscode.window.showInformationMessage("View Progress \u2014 not yet implemented, see DIRECTIVE.md");
  }));

  // Exposes the same capability to Copilot Chat / Claude Code / any MCP-aware
  // agent via the Language Model Tool API — see contributes.languageModelTools
  // in package.json and DIRECTIVE.md, section "Language Model Tool".
  registerMigrationStatusTool(context);
}

export function deactivate() {}

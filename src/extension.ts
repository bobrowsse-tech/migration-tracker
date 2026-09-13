import * as vscode from 'vscode';
import { DashboardProvider } from './dashboardProvider';
import { registerMigrationStatusTool } from './lmTool';
import {
  MigrationService,
  type MatcherKind,
  type MigrationProgress,
} from './service';

const ACTIVE_KEY = 'migrationTracker.activeId';
const CURSOR_HASH_KEY = 'migrationTracker.cursorHash';

function workspaceRoot(): string | undefined {
  return vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
}

function createService(): MigrationService | undefined {
  const root = workspaceRoot();
  if (!root) {
    vscode.window.showErrorMessage('Migration Tracker needs an open workspace folder.');
    return undefined;
  }
  return new MigrationService(root);
}

export function activate(context: vscode.ExtensionContext) {
  const dashboard = new DashboardProvider(context.extensionUri);
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider('migration-trackerView', dashboard)
  );

  const statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 99);
  statusBar.command = 'migrationTracker.viewProgress';
  statusBar.tooltip = 'Migration-in-Progress Tracker';
  statusBar.text = '$(arrow-swap) Migration';
  statusBar.show();
  context.subscriptions.push(statusBar);

  const refreshUi = async (migrationId?: string) => {
    const service = createService();
    if (!service) {
      return;
    }
    const id = migrationId ?? context.workspaceState.get<string>(ACTIVE_KEY);
    if (!id) {
      const defs = service.list();
      dashboard.setSummary(defs.length ? 'Select a migration or Rescan.' : 'Define a migration to begin.');
      dashboard.showList(defs);
      statusBar.text = '$(arrow-swap) Migration';
      return;
    }
    try {
      const progress = await service.getProgress(id);
      context.workspaceState.update(ACTIVE_KEY, id);
      dashboard.showProgress(progress);
      dashboard.setSummary(
        `${progress.definition.name}: ${progress.status.migrated}/${progress.status.total} (${progress.percent}%)`
      );
      statusBar.text = `$(arrow-swap) ${progress.definition.name}: ${progress.status.migrated}/${progress.status.total}`;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      dashboard.setSummary(msg);
    }
  };

  context.subscriptions.push(
    vscode.commands.registerCommand('migrationTracker.define', async () => {
      const service = createService();
      if (!service) {
        return;
      }
      const name = await vscode.window.showInputBox({
        title: 'Migration name',
        placeHolder: 'e.g. lodash-get → optional chaining',
        ignoreFocusOut: true,
      });
      if (!name) {
        return;
      }
      const oldPattern = await vscode.window.showInputBox({
        title: 'Old pattern (function/import/JSX name)',
        placeHolder: 'e.g. lodash.get or _.get',
        ignoreFocusOut: true,
      });
      if (!oldPattern) {
        return;
      }
      const newPattern = await vscode.window.showInputBox({
        title: 'New pattern (documentation / target)',
        placeHolder: 'e.g. obj?.prop',
        ignoreFocusOut: true,
        value: '',
      });
      if (newPattern === undefined) {
        return;
      }
      const kindPick = await vscode.window.showQuickPick(
        [
          { label: 'Call expression', matcherKind: 'callExpression' as MatcherKind },
          { label: 'Import specifier', matcherKind: 'importSpecifier' as MatcherKind },
          { label: 'JSX element', matcherKind: 'jsxElement' as MatcherKind },
        ],
        { title: 'Matcher kind' }
      );
      if (!kindPick) {
        return;
      }

      const def = service.define({
        name,
        oldPattern,
        newPattern,
        matcherKind: kindPick.matcherKind,
      });
      service.rescan(def.id);
      await context.workspaceState.update(ACTIVE_KEY, def.id);
      vscode.window.showInformationMessage(`Migration defined: ${def.name}`);
      await refreshUi(def.id);
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('migrationTracker.rescan', async (payload?: { migrationId?: string }) => {
      const service = createService();
      if (!service) {
        return;
      }
      let id = payload?.migrationId ?? context.workspaceState.get<string>(ACTIVE_KEY);
      if (!id) {
        const defs = service.list();
        if (!defs.length) {
          vscode.window.showWarningMessage('Define a migration first.');
          return;
        }
        const pick = await vscode.window.showQuickPick(
          defs.map((d) => ({ label: d.name, description: d.id, id: d.id })),
          { title: 'Rescan which migration?' }
        );
        if (!pick) {
          return;
        }
        id = pick.id;
      }
      dashboard.setSummary('Rescanning…');
      try {
        const status = service.rescan(id);
        await context.workspaceState.update(ACTIVE_KEY, id);
        vscode.window.showInformationMessage(
          `Rescan complete: ${status.migrated}/${status.total} migrated, ${status.remaining.length} remaining`
        );
        await refreshUi(id);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        vscode.window.showErrorMessage(msg);
      }
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('migrationTracker.jumpToNext', async (payload?: { migrationId?: string; hash?: string }) => {
      const service = createService();
      const root = workspaceRoot();
      if (!service || !root) {
        return;
      }
      const id = payload?.migrationId ?? context.workspaceState.get<string>(ACTIVE_KEY);
      if (!id) {
        vscode.window.showWarningMessage('No active migration — Rescan or Define first.');
        return;
      }
      const afterHash = payload?.hash ?? context.workspaceState.get<string>(CURSOR_HASH_KEY);
      let site = service.nextSite(id, afterHash);
      if (!site) {
        // Ensure we have a status
        service.rescan(id);
        site = service.nextSite(id);
      }
      if (!site) {
        vscode.window.showInformationMessage('No remaining call sites — migration complete!');
        await refreshUi(id);
        return;
      }
      await context.workspaceState.update(CURSOR_HASH_KEY, site.hash);
      const uri = vscode.Uri.file(`${root}/${site.file}`);
      const doc = await vscode.workspace.openTextDocument(uri);
      const editor = await vscode.window.showTextDocument(doc);
      const pos = new vscode.Position(Math.max(0, site.line - 1), 0);
      editor.selection = new vscode.Selection(pos, pos);
      editor.revealRange(new vscode.Range(pos, pos), vscode.TextEditorRevealType.InCenter);
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('migrationTracker.viewProgress', async (payload?: { migrationId?: string }) => {
      const service = createService();
      if (!service) {
        return;
      }
      let id = payload?.migrationId ?? context.workspaceState.get<string>(ACTIVE_KEY);
      if (!id) {
        const defs = service.list();
        if (!defs.length) {
          vscode.window.showWarningMessage('Define a migration first.');
          return;
        }
        const pick = await vscode.window.showQuickPick(
          defs.map((d) => ({ label: d.name, description: d.id, id: d.id })),
          { title: 'View progress for which migration?' }
        );
        if (!pick) {
          return;
        }
        id = pick.id;
      }
      await context.workspaceState.update(ACTIVE_KEY, id);
      await refreshUi(id);
      await vscode.commands.executeCommand('migration-trackerView.focus');
    })
  );

  dashboard.onSelectMigration((id) => {
    void context.workspaceState.update(ACTIVE_KEY, id);
    void refreshUi(id);
  });

  registerMigrationStatusTool(context, () => createService(), async (id) => {
    if (id) {
      await context.workspaceState.update(ACTIVE_KEY, id);
    }
    await refreshUi(id);
  });

  void refreshUi();
}

export function deactivate() {}

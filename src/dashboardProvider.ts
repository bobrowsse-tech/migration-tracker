import * as vscode from 'vscode';
import type { MigrationDefinition, MigrationProgress } from './service';
import { sparkline } from './service';

const BUTTONS: { label: string; command: string }[] = [
  { label: 'Define Migration', command: 'migrationTracker.define' },
  { label: 'Rescan', command: 'migrationTracker.rescan' },
  { label: 'Jump to Next', command: 'migrationTracker.jumpToNext' },
  { label: 'View Progress', command: 'migrationTracker.viewProgress' },
];

export class DashboardProvider implements vscode.WebviewViewProvider {
  private view?: vscode.WebviewView;
  private summary = 'No migration selected.';
  private selectHandler?: (id: string) => void;

  constructor() {}

  onSelectMigration(handler: (id: string) => void) {
    this.selectHandler = handler;
  }

  resolveWebviewView(webviewView: vscode.WebviewView) {
    this.view = webviewView;
    webviewView.webview.options = { enableScripts: true };
    webviewView.webview.html = this.getHtml();
    webviewView.webview.onDidReceiveMessage((message) => {
      if (message.type === 'runCommand') {
        void vscode.commands.executeCommand(message.command, message.payload);
      } else if (message.type === 'selectMigration') {
        this.selectHandler?.(message.id);
      } else if (message.type === 'jumpSite') {
        void vscode.commands.executeCommand('migrationTracker.jumpToNext', {
          migrationId: message.migrationId,
          hash: message.hash,
        });
      }
    });
  }

  setSummary(text: string) {
    this.summary = text;
    this.post({ type: 'summary', text });
  }

  showList(defs: MigrationDefinition[]) {
    this.post({
      type: 'list',
      migrations: defs.map((d) => ({ id: d.id, name: d.name, oldPattern: d.oldPattern })),
    });
  }

  showProgress(progress: MigrationProgress) {
    this.post({
      type: 'progress',
      progress: {
        id: progress.definition.id,
        name: progress.definition.name,
        oldPattern: progress.definition.oldPattern,
        newPattern: progress.definition.newPattern,
        migrated: progress.status.migrated,
        total: progress.status.total,
        percent: progress.percent,
        sparkline: sparkline(progress.history),
        remaining: progress.status.remaining.map((s) => ({
          file: s.file,
          line: s.line,
          snippet: s.snippet,
          hash: s.hash,
        })),
      },
    });
  }

  private post(message: unknown) {
    void this.view?.webview.postMessage(message);
  }

  private getHtml(): string {
    const buttonsHtml = BUTTONS.map(
      (b) => `<button data-command="${b.command}">${b.label}</button>`
    ).join('\n');
    const nonce = String(Date.now());
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'nonce-${nonce}';" />
  <style>
    body { font-family: var(--vscode-font-family); color: var(--vscode-foreground); padding: 8px; font-size: var(--vscode-font-size); }
    button {
      display: block; width: 100%; margin-bottom: 6px; padding: 6px 10px;
      background: var(--vscode-button-background); color: var(--vscode-button-foreground);
      border: none; border-radius: 4px; cursor: pointer; text-align: left;
    }
    button:hover { background: var(--vscode-button-hoverBackground); }
    #summary { margin: 8px 0 12px; font-size: 0.85em; color: var(--vscode-descriptionForeground); }
    .bar { height: 8px; background: var(--vscode-editor-background); border: 1px solid var(--vscode-widget-border, transparent); border-radius: 4px; overflow: hidden; margin: 8px 0; }
    .bar > span { display: block; height: 100%; background: var(--vscode-progressBar-background); }
    .site { font-size: 0.8em; padding: 4px 0; border-bottom: 1px solid var(--vscode-widget-border, transparent); cursor: pointer; }
    .site:hover { background: var(--vscode-list-hoverBackground); }
    .meta { color: var(--vscode-descriptionForeground); font-size: 0.75em; }
    .mig { padding: 4px 0; cursor: pointer; }
    .spark { font-family: var(--vscode-editor-font-family); letter-spacing: 1px; }
    .hint { font-size: 0.75em; color: var(--vscode-descriptionForeground); margin-top: 8px; }
  </style>
</head>
<body>
  <div id="summary">${escapeHtml(this.summary)}</div>
  ${buttonsHtml}
  <div id="picker"></div>
  <div id="progress"></div>
  <p class="hint">Ignore a site with <code>// migration-ignore:&lt;id&gt;</code>. Status files under .migrations/ are meant to be committed.</p>
  <script nonce="${nonce}">
    const vscode = acquireVsCodeApi();
    const summaryEl = document.getElementById('summary');
    const pickerEl = document.getElementById('picker');
    const progressEl = document.getElementById('progress');
    document.querySelectorAll('button[data-command]').forEach((btn) => {
      btn.addEventListener('click', () => vscode.postMessage({ type: 'runCommand', command: btn.dataset.command }));
    });
    function esc(s) {
      return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
    }
    window.addEventListener('message', (event) => {
      const msg = event.data;
      if (msg.type === 'summary') summaryEl.textContent = msg.text;
      if (msg.type === 'list') {
        pickerEl.innerHTML = '<div class="meta">Migrations</div>';
        for (const m of msg.migrations) {
          const div = document.createElement('div');
          div.className = 'mig';
          div.textContent = m.name + ' (' + m.oldPattern + ')';
          div.addEventListener('click', () => vscode.postMessage({ type: 'selectMigration', id: m.id }));
          pickerEl.appendChild(div);
        }
      }
      if (msg.type === 'progress') {
        const p = msg.progress;
        progressEl.innerHTML =
          '<div><strong>' + esc(p.name) + '</strong></div>' +
          '<div class="meta">' + esc(p.oldPattern) + ' → ' + esc(p.newPattern) + '</div>' +
          '<div class="bar"><span style="width:' + p.percent + '%"></span></div>' +
          '<div class="meta">' + p.migrated + '/' + p.total + ' (' + p.percent + '%)' +
            (p.sparkline ? ' · <span class="spark">' + esc(p.sparkline) + '</span>' : '') +
          '</div>' +
          '<div class="meta" style="margin-top:8px">Remaining</div>';
        for (const s of p.remaining) {
          const div = document.createElement('div');
          div.className = 'site';
          div.innerHTML = '<div>' + esc(s.file) + ':' + s.line + '</div><div class="meta">' + esc(s.snippet) + '</div>';
          div.addEventListener('click', () => vscode.postMessage({
            type: 'jumpSite', migrationId: p.id, hash: s.hash
          }));
          progressEl.appendChild(div);
        }
      }
    });
  </script>
</body>
</html>`;
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

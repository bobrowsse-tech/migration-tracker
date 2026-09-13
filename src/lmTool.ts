import * as vscode from 'vscode';
import type { MigrationService } from './service';

interface ToolInput {
  migrationId?: string;
}

/**
 * Report-only LM tool — reports progress / next sites; does not rewrite code.
 */
export function registerMigrationStatusTool(
  context: vscode.ExtensionContext,
  getService: () => MigrationService | undefined,
  onReported?: (migrationId?: string) => Promise<void>
) {
  context.subscriptions.push(
    vscode.lm.registerTool('migration_status', {
      async invoke(
        options: vscode.LanguageModelToolInvocationOptions<ToolInput>,
        _token: vscode.CancellationToken
      ) {
        const service = getService();
        if (!service) {
          return textResult('No workspace folder is open.');
        }
        const id = options.input?.migrationId;
        try {
          if (!id) {
            await onReported?.();
            return textResult(service.formatAll());
          }
          const progress = await service.getProgress(id);
          await onReported?.(id);
          const next = service.nextSite(id);
          const extra = next
            ? `\n\nNext unmigrated site: ${next.file}:${next.line}\n${next.snippet}`
            : '\n\nNo remaining sites.';
          return textResult(service.formatStatus(progress) + extra);
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          return textResult(msg);
        }
      },
    })
  );
}

function textResult(text: string): vscode.LanguageModelToolResult {
  return new vscode.LanguageModelToolResult([new vscode.LanguageModelTextPart(text)]);
}

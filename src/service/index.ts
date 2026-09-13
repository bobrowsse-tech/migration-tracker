export type {
  CallSite,
  MatcherKind,
  MigrationDefinition,
  MigrationProgress,
  MigrationStatus,
  ProgressPoint,
} from './types';
export { MIGRATIONS_DIR } from './types';

export {
  definitionPath,
  listDefinitions,
  loadDefinition,
  loadStatus,
  saveDefinition,
  saveStatus,
  slugify,
  statusPath,
} from './store';
export { scanMigration } from './scan';
export { readProgressHistory, sparkline } from './history';

import {
  listDefinitions,
  loadDefinition,
  loadStatus,
  saveDefinition,
  saveStatus,
  slugify,
} from './store';
import { scanMigration } from './scan';
import { readProgressHistory, sparkline } from './history';
import type {
  MatcherKind,
  MigrationDefinition,
  MigrationProgress,
  MigrationStatus,
} from './types';

export interface DefineInput {
  name: string;
  oldPattern: string;
  newPattern: string;
  matcherKind: MatcherKind;
  id?: string;
}

/**
 * VS Code–free migration tracker service.
 */
export class MigrationService {
  constructor(private readonly root: string) {}

  list(): MigrationDefinition[] {
    return listDefinitions(this.root);
  }

  define(input: DefineInput): MigrationDefinition {
    const id = input.id || slugify(input.name);
    const def: MigrationDefinition = {
      id,
      name: input.name,
      oldPattern: input.oldPattern,
      newPattern: input.newPattern,
      matcherKind: input.matcherKind,
      createdAt: new Date().toISOString(),
    };
    saveDefinition(this.root, def);
    return def;
  }

  rescan(migrationId: string): MigrationStatus {
    const def = loadDefinition(this.root, migrationId);
    if (!def) {
      throw new Error(`Unknown migration id: ${migrationId}`);
    }
    const previous = loadStatus(this.root, migrationId);
    const status = scanMigration(this.root, def, previous);
    saveStatus(this.root, status);
    return status;
  }

  getStatus(migrationId: string): MigrationStatus | undefined {
    return loadStatus(this.root, migrationId);
  }

  async getProgress(migrationId: string): Promise<MigrationProgress> {
    const definition = loadDefinition(this.root, migrationId);
    if (!definition) {
      throw new Error(`Unknown migration id: ${migrationId}`);
    }
    let status = loadStatus(this.root, migrationId);
    if (!status) {
      status = this.rescan(migrationId);
    }
    const history = await readProgressHistory(this.root, migrationId);
    const percent = status.total > 0 ? Math.round((status.migrated / status.total) * 100) : 100;
    return { definition, status, percent, history };
  }

  nextSite(migrationId: string, afterHash?: string) {
    const status = loadStatus(this.root, migrationId);
    if (!status || !status.remaining.length) {
      return undefined;
    }
    if (!afterHash) {
      return status.remaining[0];
    }
    const idx = status.remaining.findIndex((s) => s.hash === afterHash);
    if (idx < 0 || idx + 1 >= status.remaining.length) {
      return status.remaining[0];
    }
    return status.remaining[idx + 1];
  }

  formatStatus(progress: MigrationProgress): string {
    const { definition, status, percent, history } = progress;
    const lines = [
      `Migration "${definition.name}" (${definition.id})`,
      `Pattern: ${definition.oldPattern} → ${definition.newPattern} [${definition.matcherKind}]`,
      `Progress: ${status.migrated}/${status.total} (${percent}%) — ${status.remaining.length} remaining`,
      `Last scan: ${status.scannedAt}`,
    ];
    const spark = sparkline(history);
    if (spark) {
      lines.push(`History: ${spark}`);
    }
    if (status.remaining.length) {
      lines.push('', 'Next sites:');
      for (const site of status.remaining.slice(0, 10)) {
        lines.push(`  - ${site.file}:${site.line}  ${site.snippet.replace(/\s+/g, ' ').slice(0, 80)}`);
      }
      if (status.remaining.length > 10) {
        lines.push(`  …and ${status.remaining.length - 10} more`);
      }
    }
    return lines.join('\n');
  }

  formatAll(): string {
    const defs = this.list();
    if (!defs.length) {
      return 'No migrations defined. Create one under .migrations/<id>.json.';
    }
    return defs
      .map((d) => {
        const s = loadStatus(this.root, d.id);
        if (!s) {
          return `- ${d.name} (${d.id}): not scanned yet`;
        }
        return `- ${d.name} (${d.id}): ${s.migrated}/${s.total} migrated, ${s.remaining.length} remaining`;
      })
      .join('\n');
  }
}

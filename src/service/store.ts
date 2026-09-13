import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import type { MigrationDefinition, MigrationStatus } from './types';
import { MIGRATIONS_DIR } from './types';

export function migrationsDir(root: string): string {
  return path.join(root, MIGRATIONS_DIR);
}

export function definitionPath(root: string, id: string): string {
  return path.join(migrationsDir(root), `${id}.json`);
}

export function statusPath(root: string, id: string): string {
  return path.join(migrationsDir(root), `${id}.status.json`);
}

export function ensureMigrationsDir(root: string): void {
  const dir = migrationsDir(root);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

export function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 64) || 'migration';
}

export function saveDefinition(root: string, def: MigrationDefinition): string {
  ensureMigrationsDir(root);
  const file = definitionPath(root, def.id);
  fs.writeFileSync(file, JSON.stringify(def, null, 2) + '\n', 'utf8');
  return file;
}

export function loadDefinition(root: string, id: string): MigrationDefinition | undefined {
  const file = definitionPath(root, id);
  if (!fs.existsSync(file)) {
    return undefined;
  }
  return JSON.parse(fs.readFileSync(file, 'utf8')) as MigrationDefinition;
}

export function listDefinitions(root: string): MigrationDefinition[] {
  const dir = migrationsDir(root);
  if (!fs.existsSync(dir)) {
    return [];
  }
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.json') && !f.endsWith('.status.json'))
    .map((f) => {
      try {
        return JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')) as MigrationDefinition;
      } catch {
        return undefined;
      }
    })
    .filter((d): d is MigrationDefinition => Boolean(d))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function loadStatus(root: string, id: string): MigrationStatus | undefined {
  const file = statusPath(root, id);
  if (!fs.existsSync(file)) {
    return undefined;
  }
  return JSON.parse(fs.readFileSync(file, 'utf8')) as MigrationStatus;
}

export function saveStatus(root: string, status: MigrationStatus): string {
  ensureMigrationsDir(root);
  const file = statusPath(root, status.migrationId);
  fs.writeFileSync(file, JSON.stringify(status, null, 2) + '\n', 'utf8');
  return file;
}

export function hashSnippet(file: string, snippet: string): string {
  return crypto.createHash('sha1').update(`${file}\n${snippet.trim()}`).digest('hex').slice(0, 12);
}

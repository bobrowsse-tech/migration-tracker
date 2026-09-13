export type MatcherKind = 'callExpression' | 'importSpecifier' | 'jsxElement';

export interface MigrationDefinition {
  id: string;
  name: string;
  oldPattern: string;
  newPattern: string;
  matcherKind: MatcherKind;
  createdAt: string;
}

export interface CallSite {
  file: string;
  line: number;
  snippet: string;
  /** Stable hash of surrounding code so renames don't reset progress. */
  hash: string;
}

export interface MigrationStatus {
  migrationId: string;
  scannedAt: string;
  /** Historical high-water mark of matches ever seen. */
  total: number;
  migrated: number;
  remaining: CallSite[];
}

export interface ProgressPoint {
  date: string;
  migrated: number;
  total: number;
}

export interface MigrationProgress {
  definition: MigrationDefinition;
  status: MigrationStatus;
  percent: number;
  history: ProgressPoint[];
}

export const MIGRATIONS_DIR = '.migrations';

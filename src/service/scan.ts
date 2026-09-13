import * as path from 'path';
import { Project, Node } from 'ts-morph';
import type { CallSite, MigrationDefinition, MigrationStatus } from './types';
import { hashSnippet, loadStatus } from './store';

function isIgnoredNear(lines: string[], lineNumber: number, migrationId: string): boolean {
  const marker = `migration-ignore:${migrationId}`;
  const current = lines[lineNumber - 1] ?? '';
  const previous = lines[lineNumber - 2] ?? '';
  return current.includes(marker) || previous.includes(marker);
}

function matchesPattern(text: string, pattern: string): boolean {
  if (text === pattern) {
    return true;
  }
  // Qualified patterns like lodash.get / React.useEffect
  const parts = pattern.split('.');
  if (parts.length >= 2) {
    return text === pattern || text.endsWith('.' + parts[parts.length - 1]);
  }
  // Bare identifier
  return text === pattern || text.endsWith('.' + pattern) || text.endsWith('/' + pattern);
}

/**
 * Find remaining old-pattern call sites for a migration.
 */
export function scanMigration(
  root: string,
  definition: MigrationDefinition,
  previous?: MigrationStatus
): MigrationStatus {
  const project = new Project({
    skipAddingFilesFromTsConfig: true,
    compilerOptions: { allowJs: true, jsx: 2 },
  });
  project.addSourceFilesAtPaths([
    path.join(root, '**/*.ts'),
    path.join(root, '**/*.tsx'),
    path.join(root, '**/*.js'),
    path.join(root, '**/*.jsx'),
  ]);

  const remaining: CallSite[] = [];
  const pattern = definition.oldPattern;

  for (const sf of project.getSourceFiles()) {
    const rel = path.relative(root, sf.getFilePath()).replace(/\\/g, '/');
    if (
      rel.includes('node_modules/') ||
      rel.startsWith('dist/') ||
      rel.includes('/dist/') ||
      rel.includes('.git/')
    ) {
      continue;
    }

    const lines = sf.getFullText().split(/\r?\n/);

    if (definition.matcherKind === 'callExpression') {
      sf.forEachDescendant((node) => {
        if (!Node.isCallExpression(node)) {
          return;
        }
        const text = node.getExpression().getText();
        if (!matchesPattern(text, pattern)) {
          return;
        }
        const line = node.getStartLineNumber();
        if (isIgnoredNear(lines, line, definition.id)) {
          return;
        }
        const snippet = node.getText().slice(0, 160);
        remaining.push({
          file: rel,
          line,
          snippet,
          hash: hashSnippet(rel, snippet),
        });
      });
    } else if (definition.matcherKind === 'importSpecifier') {
      for (const imp of sf.getImportDeclarations()) {
        const module = imp.getModuleSpecifierValue();
        for (const spec of imp.getNamedImports()) {
          const name = spec.getName();
          const full = `${module}.${name}`;
          const hit =
            matchesPattern(name, pattern) ||
            matchesPattern(full, pattern) ||
            module === pattern ||
            `${module}/${name}` === pattern;
          if (!hit) {
            continue;
          }
          const line = spec.getStartLineNumber();
          if (isIgnoredNear(lines, line, definition.id)) {
            continue;
          }
          const snippet = spec.getText();
          remaining.push({
            file: rel,
            line,
            snippet,
            hash: hashSnippet(rel, `${module}:${snippet}`),
          });
        }
        if (module === pattern || matchesPattern(module, pattern)) {
          const line = imp.getStartLineNumber();
          if (!isIgnoredNear(lines, line, definition.id)) {
            const snippet = imp.getText().slice(0, 160);
            remaining.push({
              file: rel,
              line,
              snippet,
              hash: hashSnippet(rel, snippet),
            });
          }
        }
      }
    } else if (definition.matcherKind === 'jsxElement') {
      sf.forEachDescendant((node) => {
        if (!Node.isJsxOpeningElement(node) && !Node.isJsxSelfClosingElement(node)) {
          return;
        }
        const tag = node.getTagNameNode().getText();
        if (!matchesPattern(tag, pattern)) {
          return;
        }
        const line = node.getStartLineNumber();
        if (isIgnoredNear(lines, line, definition.id)) {
          return;
        }
        const snippet = node.getText().slice(0, 160);
        remaining.push({
          file: rel,
          line,
          snippet,
          hash: hashSnippet(rel, snippet),
        });
      });
    }
  }

  const unique = new Map<string, CallSite>();
  for (const site of remaining) {
    if (!unique.has(site.hash)) {
      unique.set(site.hash, site);
    }
  }
  const remainingList = [...unique.values()].sort(
    (a, b) => a.file.localeCompare(b.file) || a.line - b.line
  );

  const prev = previous ?? loadStatus(root, definition.id);
  const currentCount = remainingList.length;
  const total = Math.max(prev?.total ?? 0, currentCount);
  const migrated = Math.max(0, total - currentCount);

  return {
    migrationId: definition.id,
    scannedAt: new Date().toISOString(),
    total,
    migrated,
    remaining: remainingList,
  };
}

import { simpleGit } from 'simple-git';
import type { ProgressPoint } from './types';
import { statusPath } from './store';

/**
 * Read git history of `.migrations/<id>.status.json` for a progress sparkline.
 * Returns empty array when not a git repo or file has no history.
 */
export async function readProgressHistory(
  root: string,
  migrationId: string,
  maxPoints = 20
): Promise<ProgressPoint[]> {
  const file = statusPath(root, migrationId);
  const rel = `.migrations/${migrationId}.status.json`;
  try {
    const git = simpleGit(root);
    const isRepo = await git.checkIsRepo();
    if (!isRepo) {
      return [];
    }
    const log = await git.log({ file: rel, maxCount: maxPoints });
    const points: ProgressPoint[] = [];
    for (const entry of [...log.all].reverse()) {
      try {
        const raw = await git.show([`${entry.hash}:${rel}`]);
        const status = JSON.parse(raw) as { migrated?: number; total?: number };
        points.push({
          date: entry.date,
          migrated: status.migrated ?? 0,
          total: status.total ?? 0,
        });
      } catch {
        // file may not exist in that commit
      }
    }
    // If no history yet, try reading working tree as a single point.
    if (!points.length) {
      try {
        const fs = await import('fs');
        if (fs.existsSync(file)) {
          const status = JSON.parse(fs.readFileSync(file, 'utf8')) as {
            migrated?: number;
            total?: number;
            scannedAt?: string;
          };
          points.push({
            date: status.scannedAt ?? new Date().toISOString(),
            migrated: status.migrated ?? 0,
            total: status.total ?? 0,
          });
        }
      } catch {
        // ignore
      }
    }
    return points;
  } catch {
    return [];
  }
}

/** Compact ASCII sparkline from progress percentages. */
export function sparkline(points: ProgressPoint[]): string {
  if (!points.length) {
    return '';
  }
  const blocks = '▁▂▃▄▅▆▇█';
  return points
    .map((p) => {
      const pct = p.total > 0 ? p.migrated / p.total : 0;
      const idx = Math.min(blocks.length - 1, Math.max(0, Math.round(pct * (blocks.length - 1))));
      return blocks[idx];
    })
    .join('');
}

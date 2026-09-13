import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { MigrationService, sparkline, scanMigration, saveDefinition } from '../service';
import type { MigrationDefinition, ProgressPoint } from '../service';

const fixtureRoot = path.join(__dirname, 'fixtures', 'repo');

const def: MigrationDefinition = {
  id: 'lodash-get',
  name: 'lodash.get → optional chaining',
  oldPattern: '_.get',
  newPattern: 'obj?.prop',
  matcherKind: 'callExpression',
  createdAt: new Date().toISOString(),
};

describe('scanMigration', () => {
  it('finds exactly the non-ignored old-pattern usages', () => {
    const status = scanMigration(fixtureRoot, def);
    // a.ts has 2, b.ts has 1 visible + 1 ignored => 3
    assert.equal(status.remaining.length, 3);
    assert.equal(status.total, 3);
    assert.equal(status.migrated, 0);
    assert.ok(status.remaining.every((s) => s.hash.length > 0));
  });
});

describe('MigrationService progress', () => {
  it('recalculates progress after a file is migrated in a copy', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'migration-'));
    try {
      // Copy fixture files
      fs.mkdirSync(path.join(dir, 'src'), { recursive: true });
      for (const f of ['a.ts', 'b.ts', 'migrated.ts']) {
        fs.copyFileSync(path.join(fixtureRoot, 'src', f), path.join(dir, 'src', f));
      }
      const service = new MigrationService(dir);
      service.define({
        name: def.name,
        oldPattern: def.oldPattern,
        newPattern: def.newPattern,
        matcherKind: def.matcherKind,
        id: def.id,
      });
      const first = service.rescan(def.id);
      assert.equal(first.remaining.length, 3);
      assert.equal(first.total, 3);

      // Migrate a.ts by removing _.get calls
      fs.writeFileSync(
        path.join(dir, 'src', 'a.ts'),
        `export function one(obj: any) { return obj?.a?.b; }
export function two(obj: any) { return obj?.c; }
`
      );
      const second = service.rescan(def.id);
      assert.equal(second.remaining.length, 1);
      assert.equal(second.total, 3); // high-water mark preserved
      assert.equal(second.migrated, 2);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe('sparkline', () => {
  it('renders blocks from progress points', () => {
    const points: ProgressPoint[] = [
      { date: 'a', migrated: 0, total: 10 },
      { date: 'b', migrated: 5, total: 10 },
      { date: 'c', migrated: 10, total: 10 },
    ];
    const s = sparkline(points);
    assert.equal(s.length, 3);
    assert.notEqual(s[0], s[2]);
  });
});

describe('saveDefinition', () => {
  it('writes .migrations/<id>.json', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'migdef-'));
    try {
      const file = saveDefinition(dir, def);
      assert.ok(fs.existsSync(file));
      const loaded = JSON.parse(fs.readFileSync(file, 'utf8'));
      assert.equal(loaded.id, 'lodash-get');
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});

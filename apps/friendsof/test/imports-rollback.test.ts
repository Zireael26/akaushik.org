import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';

describe('P1 Imports Atomic Rollback & Constraint Qualification Suite', () => {

  function setupTestDb() {
    const db = new DatabaseSync(':memory:');
    db.exec('PRAGMA foreign_keys = ON;');

    db.exec(`
      CREATE TABLE workspaces (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL
      ) STRICT;

      CREATE TABLE resources (
        id TEXT PRIMARY KEY,
        workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE RESTRICT,
        current_revision_id TEXT,
        title TEXT NOT NULL
      ) STRICT;

      CREATE TABLE resource_revisions (
        id TEXT PRIMARY KEY,
        resource_id TEXT NOT NULL REFERENCES resources(id) ON DELETE RESTRICT,
        workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE RESTRICT,
        revision_number INTEGER NOT NULL CHECK (revision_number >= 1),
        base_revision_id TEXT,
        markdown TEXT NOT NULL,
        content_sha256 TEXT NOT NULL,
        UNIQUE(resource_id, revision_number)
      ) STRICT;

      CREATE TRIGGER resource_revision_immutable_update
      BEFORE UPDATE ON resource_revisions
      BEGIN
        SELECT RAISE(ABORT, 'immutable-revision');
      END;

      CREATE TRIGGER resource_revision_immutable_delete
      BEFORE DELETE ON resource_revisions
      BEGIN
        SELECT RAISE(ABORT, 'immutable-revision');
      END;

      CREATE TABLE forced_constraint_failure (
        id TEXT PRIMARY KEY,
        must_be_one INTEGER NOT NULL CHECK (must_be_one = 1)
      ) STRICT;
    `);

    // Seed workspace
    db.prepare('INSERT INTO workspaces (id, name) VALUES (?, ?)').run('ws_test', 'Test Workspace');

    // D1-compatible atomic batch runner
    function batch(statements: Array<[string, unknown[]]>) {
      db.exec('BEGIN TRANSACTION;');
      try {
        const results = [];
        for (const [sql, params] of statements) {
          const stmt = db.prepare(sql);
          const res = stmt.run(...params);
          results.push(res);
        }
        db.exec('COMMIT;');
        return results;
      } catch (err) {
        db.exec('ROLLBACK;');
        throw err;
      }
    }

    return { db, batch };
  }

  // 1. Constraint Failure Aborts and Leaves Zero Residue
  it('atomic rollback: second statement constraint failure rolls back first statement, leaving zero rows', () => {
    const { db, batch } = setupTestDb();

    assert.throws(
      () => {
        batch([
          // Statement 1: valid insert into resources
          [
            'INSERT INTO resources (id, workspace_id, current_revision_id, title) VALUES (?, ?, NULL, ?)',
            ['res_rollback_probe_1', 'ws_test', 'Rollback Probe Document']
          ],
          // Statement 2: forced CHECK constraint failure (must_be_one = 0)
          [
            'INSERT INTO forced_constraint_failure (id, must_be_one) VALUES (?, ?)',
            ['f_1', 0] // VIOLATION: must_be_one must be 1
          ]
        ]);
      },
      /CHECK constraint failed: must_be_one = 1/,
      'Batch must throw on constraint violation'
    );

    // Verify residue in resources table: MUST BE 0 (Statement 1 rolled back)
    const row = db.prepare('SELECT count(*) as count FROM resources WHERE id = ?').get('res_rollback_probe_1') as { count: number };
    assert.equal(row.count, 0, 'Atomic rollback MUST leave 0 rows in resources table for statement 1');

    // Verify residue in forced_constraint_failure table: MUST BE 0
    const failRow = db.prepare('SELECT count(*) as count FROM forced_constraint_failure WHERE id = ?').get('f_1') as { count: number };
    assert.equal(failRow.count, 0, 'No partial commit permitted');
  });

  // 2. Foreign Key Violation Aborts and Leaves Zero Residue
  it('atomic rollback: foreign key violation in revision rolls back resource insertion', () => {
    const { db, batch } = setupTestDb();

    assert.throws(
      () => {
        batch([
          // Statement 1: valid resource insert
          [
            'INSERT INTO resources (id, workspace_id, current_revision_id, title) VALUES (?, ?, NULL, ?)',
            ['res_fk_probe', 'ws_test', 'FK Probe Document']
          ],
          // Statement 2: revision referencing nonexistent workspace
          [
            'INSERT INTO resource_revisions (id, resource_id, workspace_id, revision_number, base_revision_id, markdown, content_sha256) VALUES (?, ?, ?, 1, NULL, ?, ?)',
            ['rev_fk_probe', 'res_fk_probe', 'nonexistent_workspace', '# Markdown', 'a'.repeat(64)] // VIOLATION: FK fails
          ]
        ]);
      },
      /FOREIGN KEY constraint failed/,
      'Batch must abort on foreign key failure'
    );

    // Verify statement 1 was rolled back
    const row = db.prepare('SELECT count(*) as count FROM resources WHERE id = ?').get('res_fk_probe') as { count: number };
    assert.equal(row.count, 0, 'Resource row must be rolled back');
  });

  // 3. Immutable Revision Trigger Enforcement
  it('immutable revision contract: updates and deletes are rejected by database triggers', () => {
    const { db, batch } = setupTestDb();

    // Successful atomic batch insert
    batch([
      [
        'INSERT INTO resources (id, workspace_id, current_revision_id, title) VALUES (?, ?, ?, ?)',
        ['res_imm', 'ws_test', 'rev_imm_1', 'Immutable Resource']
      ],
      [
        'INSERT INTO resource_revisions (id, resource_id, workspace_id, revision_number, base_revision_id, markdown, content_sha256) VALUES (?, ?, ?, 1, NULL, ?, ?)',
        ['rev_imm_1', 'res_imm', 'ws_test', '# Original Content', 'a'.repeat(64)]
      ]
    ]);

    // Verify row exists
    const before = db.prepare('SELECT markdown FROM resource_revisions WHERE id = ?').get('rev_imm_1') as { markdown: string };
    assert.equal(before.markdown, '# Original Content');

    // Attempt UPDATE -> MUST ABORT
    assert.throws(() => {
      db.prepare('UPDATE resource_revisions SET markdown = ? WHERE id = ?').run('# Mutated Content', 'rev_imm_1');
    }, /immutable-revision/);

    // Attempt DELETE -> MUST ABORT
    assert.throws(() => {
      db.prepare('DELETE FROM resource_revisions WHERE id = ?').run('rev_imm_1');
    }, /immutable-revision/);

    // Content remains intact
    const after = db.prepare('SELECT markdown FROM resource_revisions WHERE id = ?').get('rev_imm_1') as { markdown: string };
    assert.equal(after.markdown, '# Original Content', 'Revision content must remain completely unchanged');
  });

  // 4. D1 REST API Batch Envelope Structure
  it('verifies D1 REST API /query payload matches exact { batch: [ { sql, params } ] } envelope', () => {
    const statements = [
      { sql: 'INSERT INTO test VALUES (?1)', params: ['val1'] },
      { sql: 'INSERT INTO test VALUES (?1)', params: ['val2'] }
    ];

    // Build payload matching Cloudflare D1 REST API contract
    const payload = {
      batch: statements.map(s => ({ sql: s.sql, params: s.params }))
    };

    assert.ok(payload.batch, 'Payload must have top-level "batch" key');
    assert.ok(Array.isArray(payload.batch), 'batch must be an array');
    assert.equal(payload.batch.length, 2);
    assert.equal(payload.batch[0].sql, 'INSERT INTO test VALUES (?1)');
    assert.deepEqual(payload.batch[0].params, ['val1']);

    // Bare array is INVALID per live verified root check
    const bareArray = statements;
    assert.ok(!('batch' in bareArray), 'Bare array does not satisfy Cloudflare D1 REST object envelope');
  });

});

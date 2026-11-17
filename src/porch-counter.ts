import { DurableObject } from 'cloudflare:workers';

export type PorchCounts = { off: number; on: number };
type RecordResult = {ok:true; counts:PorchCounts} | {ok:false; conflict:true};

// A single house is the coordination unit. Keep this class, namespace, and
// instance name stable across deployments: the counts live in SQLite, not RAM.
export class PorchCounter extends DurableObject<Env> {
  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    this.ctx.storage.transactionSync(() => {
      this.ctx.storage.sql.exec('CREATE TABLE IF NOT EXISTS totals (id INTEGER PRIMARY KEY CHECK (id = 1), off_count INTEGER NOT NULL DEFAULT 0, on_count INTEGER NOT NULL DEFAULT 0)');
      this.ctx.storage.sql.exec('INSERT OR IGNORE INTO totals (id) VALUES (1)');
      this.ctx.storage.sql.exec('CREATE TABLE IF NOT EXISTS actions (id TEXT PRIMARY KEY, direction TEXT NOT NULL, recorded_at INTEGER NOT NULL)');
      this.ctx.storage.sql.exec('CREATE INDEX IF NOT EXISTS actions_recorded_at ON actions(recorded_at)');
    });
  }

  read(): PorchCounts {
    return this.ctx.storage.sql.exec<PorchCounts>('SELECT off_count AS "off", on_count AS "on" FROM totals WHERE id = 1').one();
  }

  record(direction: 'off' | 'on', id: string): RecordResult {
    if (!['off','on'].includes(direction) || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) {
      throw new Error('Invalid action');
    }
    return this.ctx.storage.transactionSync(() => {
      const now = Date.now();
      this.ctx.storage.sql.exec('DELETE FROM actions WHERE recorded_at < ?', now - 24 * 60 * 60 * 1000);
      const seen = this.ctx.storage.sql.exec<{direction:string}>('SELECT direction FROM actions WHERE id = ?', id).toArray()[0];
      if (seen && seen.direction !== direction) return {ok:false, conflict:true};
      if (!seen) {
        this.ctx.storage.sql.exec('INSERT INTO actions (id, direction, recorded_at) VALUES (?, ?, ?)', id, direction, now);
        if (direction === 'off') this.ctx.storage.sql.exec('UPDATE totals SET off_count = off_count + 1 WHERE id = 1');
        else this.ctx.storage.sql.exec('UPDATE totals SET on_count = on_count + 1 WHERE id = 1');
      }
      return {ok:true, counts:this.read()};
    });
  }
}

import { DurableObject, env } from "cloudflare:workers";

export type PublicWidgetRateReservation = {
  clientHash: string;
  window: number;
  limit: number;
};

export type PublicWidgetDailyReservation = {
  dateUtc: string;
  limit: number;
};

export type PublicWidgetProviderCost = {
  costUsd: number;
  dateUtc: string;
  path: string[];
  status: "failed" | "succeeded";
};

/**
 * Global, strongly consistent budget gate for operator-sponsored public calls.
 *
 * One named instance serializes reservations across Cloudflare locations. The
 * SQLite statements are synchronous, so each check-and-increment RPC is atomic
 * without holding a lock across provider I/O.
 */
export class PublicWidgetAuditBudget extends DurableObject {
  constructor(ctx: DurableObjectState, workerEnv: Env) {
    super(ctx, workerEnv);
    this.ctx.storage.sql.exec(`
      CREATE TABLE IF NOT EXISTS rate_counters (
        client_hash TEXT NOT NULL,
        window INTEGER NOT NULL,
        used INTEGER NOT NULL,
        PRIMARY KEY (client_hash, window)
      );
      CREATE TABLE IF NOT EXISTS daily_provider_reservations (
        date_utc TEXT PRIMARY KEY,
        used INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS provider_cost_events (
        event_id TEXT PRIMARY KEY,
        date_utc TEXT NOT NULL,
        provider TEXT NOT NULL,
        path_json TEXT NOT NULL,
        cost_usd REAL NOT NULL,
        status TEXT NOT NULL,
        recorded_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS provider_cost_events_date_idx
        ON provider_cost_events (date_utc);
    `);
  }

  checkRate(input: PublicWidgetRateReservation): boolean {
    if (
      !input.clientHash ||
      !Number.isSafeInteger(input.window) ||
      !Number.isSafeInteger(input.limit) ||
      input.limit < 1
    ) {
      return false;
    }

    this.ctx.storage.sql.exec(
      "DELETE FROM rate_counters WHERE window < ?",
      input.window - 2,
    );
    const row = this.ctx.storage.sql
      .exec<{
        used: number;
      }>("SELECT used FROM rate_counters WHERE client_hash = ? AND window = ?", input.clientHash, input.window)
      .toArray()[0];
    if ((row?.used ?? 0) >= input.limit) return false;

    this.ctx.storage.sql.exec(
      `INSERT INTO rate_counters (client_hash, window, used)
       VALUES (?, ?, 1)
       ON CONFLICT (client_hash, window)
       DO UPDATE SET used = used + 1`,
      input.clientHash,
      input.window,
    );
    return true;
  }

  reserveProviderCall(input: PublicWidgetDailyReservation): boolean {
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(input.dateUtc) ||
      !Number.isSafeInteger(input.limit) ||
      input.limit < 1
    ) {
      return false;
    }

    this.ctx.storage.sql.exec(
      "DELETE FROM daily_provider_reservations WHERE date_utc < ?",
      input.dateUtc,
    );
    const row = this.ctx.storage.sql
      .exec<{
        used: number;
      }>("SELECT used FROM daily_provider_reservations WHERE date_utc = ?", input.dateUtc)
      .toArray()[0];
    if ((row?.used ?? 0) >= input.limit) return false;

    this.ctx.storage.sql.exec(
      `INSERT INTO daily_provider_reservations (date_utc, used)
       VALUES (?, 1)
       ON CONFLICT (date_utc)
       DO UPDATE SET used = used + 1`,
      input.dateUtc,
    );
    return true;
  }

  recordProviderCost(input: PublicWidgetProviderCost): void {
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(input.dateUtc) ||
      !Number.isFinite(input.costUsd) ||
      input.costUsd < 0
    ) {
      return;
    }

    this.ctx.storage.sql.exec(
      `INSERT INTO provider_cost_events (
         event_id, date_utc, provider, path_json, cost_usd, status, recorded_at
       ) VALUES (?, ?, 'dataforseo', ?, ?, ?, ?)`,
      crypto.randomUUID(),
      input.dateUtc,
      JSON.stringify(input.path),
      input.costUsd,
      input.status,
      new Date().toISOString(),
    );
  }
}

export function getPublicWidgetAuditBudget() {
  const namespace =
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- wrangler binds this name to this exported class
    env.PUBLIC_WIDGET_AUDIT_BUDGET as unknown as DurableObjectNamespace<PublicWidgetAuditBudget>;
  return namespace.get(namespace.idFromName("global-v1"));
}

import { Injectable, OnModuleDestroy, OnModuleInit, Logger } from "@nestjs/common";
import { Pool, PoolClient } from "pg";
import { Redis } from "ioredis";

export interface RealtimePgNotifyPayload {
  op: "I" | "U" | "D";
  table: string;
  npsn?: string | null;
  school_npsn?: string | null;
  changed_by_user_id?: string | null;
  ts?: string | null;
  old?: Record<string, unknown> | null;
  new?: Record<string, unknown> | null;
}

export const REALTIME_CHANNELS = [
  "tbl_schools",
  "tbl_users",
  "tbl_workspace_school_proposal_data",
  "tbl_workspace_school_equipment_data",
  "tbl_school_profile_administrative_documents",
  "tbl_school_profile_concentrations",
  "tbl_school_profile_organization_members",
  "tbl_workspace_interview_assessments",
  "tbl_workspace_verifikasi_online_reviews",
  "tbl_workspace_school_assignments",
  "tbl_equipment_items",
  "tbl_equipment_proposals",
] as const;

@Injectable()
export class PgNotifyListenerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PgNotifyListenerService.name);
  private pgPool: Pool | null = null;
  private pgListenerClient: PoolClient | null = null;
  private redisPublisher: Redis | null = null;
  private stopped = false;

  constructor() {}

  async onModuleInit() {
    try {
      const redisConn = {
        host: process.env.REDIS_HOST ?? "127.0.0.1",
        port: parseInt(process.env.REDIS_PORT ?? "6379", 10),
        password: process.env.REDIS_PASSWORD ?? undefined,
        maxRetriesPerRequest: 2,
        reconnectOnError: () => true,
      } as const;
      this.redisPublisher = new Redis(redisConn);
      this.redisPublisher.on("error", (err) =>
        this.logger.verbose(`Redis publisher error (circuit): ${err.message}`),
      );

      this.pgPool = new Pool({
        host: process.env.DB_HOST ?? "127.0.0.1",
        port: parseInt(process.env.DB_PORT ?? "5432", 10),
        user: process.env.DB_USER ?? "saranasmk",
        password: process.env.DB_PASSWORD ?? "saranasmk123",
        database: process.env.DB_NAME ?? "saranasmk",
        max: 2,
        idleTimeoutMillis: 0,
      });
      this.pgListenerClient = await this.pgPool.connect();
      this.pgListenerClient.on("notification", async (msg) => {
        await this.handleNotification(msg.channel, msg.payload ?? "");
      });
      for (const ch of REALTIME_CHANNELS) {
        try { await this.pgListenerClient.query(`LISTEN ${ch};`); } catch {}
      }
      this.logger.log(
        `PG NOTIFY Listener READY (${REALTIME_CHANNELS.length} channels) → Redis PubSub bridge up.`,
      );
    } catch (err) {
      this.logger.warn(
        `PG NOTIFY Listener skipped: PG/Redis offline (non-fatal). FE fallback polling. Err=${(err as Error).message}`,
      );
    }
  }

  async onModuleDestroy() {
    this.stopped = true;
    try {
      if (this.pgListenerClient) {
        for (const ch of REALTIME_CHANNELS) {
          try { await this.pgListenerClient.query(`UNLISTEN ${ch};`); } catch {}
        }
        this.pgListenerClient.release(true);
      }
      if (this.pgPool) {
        await this.pgPool.end().catch(() => null);
      }
      if (this.redisPublisher) {
        try { await this.redisPublisher.quit(); } catch { this.redisPublisher.disconnect(false); }
      }
    } catch {}
  }

  private async handleNotification(channel: string, payloadRaw: string) {
    if (this.stopped || !payloadRaw) return;
    let payload: RealtimePgNotifyPayload | null = null;
    try { payload = JSON.parse(payloadRaw) as RealtimePgNotifyPayload; } catch { return; }
    if (!payload) return;
    const npsnScope = payload.npsn ?? payload.school_npsn ?? null;
    const tableName = payload.table ?? channel.replace(/^tbl_/, "");
    const broadcastScopes: string[] = ["global", `table:${tableName}`];
    if (npsnScope) broadcastScopes.push(`npsn:${npsnScope}`);
    const wrapped = {
      source: "pg_notify",
      channel,
      receivedAt: new Date().toISOString(),
      data: payload,
    };
    if (this.redisPublisher) {
      for (const scope of broadcastScopes) {
        try {
          await this.redisPublisher.publish(
            `rt_scope_${scope}`,
            JSON.stringify(wrapped),
          );
        } catch {}
      }
    }
  }
}

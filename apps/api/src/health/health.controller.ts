import { Controller, Get } from "@nestjs/common";
import type { HealthResp } from "@saranasmk/shared-types";

@Controller("health")
export class HealthController {
  @Get()
  check(): HealthResp {
    const uptimeSec = process.uptime();
    const rssBytes = process.memoryUsage().rss;
    return {
      ok: true,
      slot: process.env.SLOT ?? "blue",
      ts: new Date().toISOString(),
      uptimeMs: Math.floor(uptimeSec * 1000),
      memRssMb: Math.round((rssBytes / 1024 / 1024) * 10) / 10,
    };
  }
}

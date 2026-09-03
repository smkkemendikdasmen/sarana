import { NextRequest } from "next/server";
import Redis, { RedisOptions } from "ioredis";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const scope = (req.nextUrl.searchParams.get("scope") ?? "global").trim();
  const _token = (req.nextUrl.searchParams.get("token") ?? "").trim();
  const role = (req.nextUrl.searchParams.get("role") ?? "").trim();
  const sessionNpsn = (req.nextUrl.searchParams.get("npsn") ?? "").trim();

  let redisSub: Redis | null = null;
  try {
    const encoder = new TextEncoder();

    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        try {
          const conn: RedisOptions = {
            host: process.env.REDIS_HOST ?? "127.0.0.1",
            port: parseInt(process.env.REDIS_PORT ?? "6379", 10),
            password: process.env.REDIS_PASSWORD ?? undefined,
            maxRetriesPerRequest: 2,
            lazyConnect: true,
          };
          redisSub = new Redis(conn);
          await redisSub.connect().catch(() => null);

          const heartbeat = setInterval(() => {
            try { controller.enqueue(encoder.encode(`: ping ${Date.now()}\n\n`)); } catch {}
          }, 15000);

          redisSub.on("message", (ch, message) => {
            try {
              controller.enqueue(encoder.encode(`event: rt\ndata: ${message}\n\n`));
            } catch {}
          });

          const channels: string[] = [`rt_scope_global`];
          if (scope) channels.push(`rt_scope_${scope}`);
          if (sessionNpsn) channels.push(`rt_scope_npsn:${sessionNpsn}`);
          if (role) channels.push(`rt_scope_role:${role}`);
          for (const ch of channels) {
            try { await redisSub.subscribe(ch); } catch {}
          }
          controller.enqueue(
            encoder.encode(
              `event: ready\ndata: ${JSON.stringify({ subscribed: channels, at: new Date().toISOString() })}\n\n`,
            ),
          );
          req.signal.addEventListener("abort", () => {
            clearInterval(heartbeat);
            try { redisSub?.disconnect(false); } catch {}
            try { controller.close(); } catch {}
          });
        } catch (err) {
          try {
            controller.enqueue(
              encoder.encode(`event: error\ndata: ${JSON.stringify({ error: (err as Error).message })}\n\n`),
            );
          } catch {}
          try { controller.close(); } catch {}
        }
      },
    });

    return new Response(stream, {
      status: 200,
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform, must-revalidate, private, max-age=0",
        "X-Accel-Buffering": "no",
        Connection: "keep-alive",
      },
    });
  } catch (err) {
    return Response.json(
      { ok: false, error: (err as Error).message },
      { status: 503 },
    );
  }
}

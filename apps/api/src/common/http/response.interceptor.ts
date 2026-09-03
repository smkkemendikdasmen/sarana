import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from "@nestjs/common";
import { ClsServiceManager } from "nestjs-cls";
import { Observable } from "rxjs";
import { map } from "rxjs/operators";

function generateFallbackTraceId(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return `trace_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
  }
}

function getTraceId(): string {
  try {
    const cls = ClsServiceManager.getClsService();
    if (cls && typeof (cls as unknown as { getId?: () => string | undefined }).getId === "function") {
      const id = (cls as unknown as { getId: () => string | undefined }).getId();
      if (id && id.length > 0) return id;
    }
    if (cls) {
      const stored = (cls as unknown as { get: (k: string) => string | undefined }).get("traceId");
      if (stored && stored.length > 0) return stored;
      const storedReq = (cls as unknown as { get: (k: string) => string | undefined }).get("reqId");
      if (storedReq && storedReq.length > 0) return storedReq;
    }
  } catch {
    /* ignore, fallback */
  }
  return generateFallbackTraceId();
}

function isHealthEndpoint(ctx: ExecutionContext): boolean {
  try {
    const http = ctx.switchToHttp();
    const req = http.getRequest<{ url?: string; path?: string } | undefined>();
    if (!req) return false;
    const url = String(req.url ?? req.path ?? "");
    return url === "/health" || url.startsWith("/health?") || url.endsWith("/health");
  } catch {
    return false;
  }
}

@Injectable()
export class ResponseInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const skipWrap = isHealthEndpoint(context);
    return next.handle().pipe(
      map((payload: unknown) => {
        if (skipWrap) {
          return payload;
        }
        if (
          payload !== null &&
          typeof payload === "object" &&
          "ok" in payload &&
          (payload as { ok?: unknown }).ok === true &&
          "data" in payload &&
          "traceId" in payload &&
          "ts" in payload
        ) {
          return payload;
        }
        return {
          ok: true,
          data: payload,
          traceId: getTraceId(),
          ts: new Date().toISOString(),
        };
      }),
    );
  }
}

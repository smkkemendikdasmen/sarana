import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from "@nestjs/common";
import { ClsServiceManager } from "nestjs-cls";

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
    /* ignore */
  }
  return generateFallbackTraceId();
}

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<{
      status: (code: number) => unknown;
      json: (body: unknown) => unknown;
    }>();

    const traceId = getTraceId();

    let statusCode = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = "Internal Server Error";
    let code = "INTERNAL_ERROR";

    if (exception instanceof HttpException) {
      statusCode = exception.getStatus();
      const res = exception.getResponse();
      if (typeof res === "string") {
        message = res;
      } else if (res !== null && typeof res === "object") {
        const r = res as { message?: unknown; error?: unknown; code?: unknown };
        if (typeof r.message === "string") {
          message = r.message;
        } else if (Array.isArray(r.message)) {
          message = (r.message as unknown[]).map(String).join("; ");
        }
        if (typeof r.error === "string" && r.error.length > 0) {
          code = r.error.toUpperCase().replace(/\s+/g, "_");
        }
        if (typeof r.code === "string" && r.code.length > 0) {
          code = r.code;
        }
      }
    } else if (exception instanceof Error) {
      message = exception.message || "Internal Server Error";
      code = exception.name?.toUpperCase?.()?.replace(/\s+/g, "_") || "INTERNAL_ERROR";
      this.logger.error(`[${traceId}] Unhandled exception: ${exception.message}`, exception.stack);
    } else {
      try {
        message = String(exception);
      } catch {
        message = "Internal Server Error";
      }
      this.logger.error(`[${traceId}] Non-Error exception thrown: ${message}`);
    }

    if (!code || code.length === 0) {
      code = `HTTP_${statusCode}`;
    }

    const isProduction = String(process.env.NODE_ENV ?? "").toLowerCase() === "production";

    const body: {
      ok: false;
      error: {
        code: string;
        message: string;
        traceId: string;
        statusCode: number;
        stack?: string;
      };
    } = {
      ok: false,
      error: {
        code,
        message,
        traceId,
        statusCode,
      },
    };

    if (!isProduction && exception instanceof Error && exception.stack) {
      body.error.stack = exception.stack;
    }

    try {
      const resp = response as unknown as {
        status: (code: number) => { json: (b: typeof body) => void };
      };
      resp.status(statusCode).json(body);
    } catch {
      /* ignore */
    }
  }
}

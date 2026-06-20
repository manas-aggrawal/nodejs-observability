import { hostname } from "os";
import { Service } from "typedi";
import { createLogger, format, transports } from "winston";
import { Span, context, trace } from "@opentelemetry/api";

/**
 * @deprecated Winston → stdout logger with X-Ray-shaped trace-id injection.
 * Logs are not correlated with traces unless a separate log shipper picks up
 * stdout and ships to the same backend. Prefer `otelLogger` from this package,
 * which emits LogRecords through the OTel Logs SDK so logs ride the same OTLP
 * pipeline as traces and the backend correlates them natively.
 *
 * Planned removal: v2.0.0 (target 2026-08-01). See DEPRECATIONS.md.
 */
// Module-scoped flag so the deprecation warning fires once per process,
// not once per log call. Triggered on first use of any Logger method —
// can't be in the constructor because the singleton is instantiated at
// module load (importing the package would warn even on v1.1+ users who
// only use otelLogger).
let warned = false;
const emitDeprecationWarning = () => {
  if (warned) return;
  warned = true;
  process.emitWarning(
    "`logger` (Winston → stdout) is deprecated and will be removed in v2.0.0 " +
      "(target 2026-08-01). It still works in v1.1.x but does NOT flow through " +
      "the OTLP logs pipeline. Migrate to `otelLogger` for OTLP-correlated logs. " +
      "See https://github.com/manas-aggrawal/nodejs-observability/blob/master/DEPRECATIONS.md",
    "DeprecationWarning"
  );
};

@Service()
export class Logger {

  private logger;
  private hostName: string = hostname();
  // Initialized to {} so userContext() can write `.user` before any
  // contextData() call without throwing on `undefined.user = ...`.
  private ctxData: Record<string, unknown> = {};


  constructor() {
    this.logger = createLogger({
      format: format.combine(
        format.json({ deterministic: false }),
      ),
      transports: [new transports.Console()],
    });
  }

  public info(
    message: string,
    source: string,
    data?: Record<string, unknown>
  ): void {
    this.log("info", message, source, data);
  }
  public warn(
    message: string,
    source: string,
    data?: Record<string, unknown>
  ): void {
    this.log("warn", message, source, data);
  }
  public error(
    message: string,
    source: string,
    data?: Record<string, unknown>
  ): void {
    this.log("error", message, source, data);
  }
  public debug(
    message: string,
    source: string,
    data?: Record<string, unknown>
  ): void {
    this.log("debug", message, source, data);
  }

  // this function is used to get request context
  public contextData(ctx: Record<string, unknown>): void {
    this.ctxData = ctx;
  }

  // this fn to add user context
  public userContext(usrCtx: Record<string, unknown>): void {
    this.ctxData.user = usrCtx;
  }

  private log(
    level: string,
    message: string,
    source: string,
    data?: Record<string, unknown>
  ): void {
    emitDeprecationWarning();
    const traceId = this.getAwsTraceId();
    const logEntry = {
      timestamp: new Date(),
      level,
      source,
      message,
      data,
      context: this.ctxData,
      traceId,
      hostname: this.hostName,
    };
    this.logger.log(logEntry);
    
  }
  // Convert OpenTelemetry trace ID to AWS X-Ray trace ID format
  // ({flags}-{first-8-hex}-{rest-of-hex}). Returns undefined when no
  // active span exists, so callers handle the "no trace context" case.
  private getAwsTraceId(): string | undefined {
    const span: Span | undefined = trace?.getSpan(context.active());
    const traceId = span?.spanContext().traceId;
    // `&&` short-circuits to undefined when traceId is missing — branchless.
    return traceId && `${span?.spanContext().traceFlags}-${traceId.substring(0, 8)}-${traceId.substring(8)}`;
  }
}
/** @deprecated See `Logger` class JSDoc. Migrate to `otelLogger`. */
export const logger = new Logger();

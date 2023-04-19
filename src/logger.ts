import { hostname } from "os";
import { Service } from "typedi";
import { createLogger, format, transports } from "winston";
import { Span, context, trace } from "@opentelemetry/api";

interface ContextOptions {
  url: string;
  method: string;
  request_id: string;
}

@Service()
export class Logger {
  private hostName: string = hostname();
  private ctxData: ContextOptions;

  public logger = createLogger({
    format: format.combine(
      format.json({ deterministic: false }),
      format.colorize()
    ),
    transports: [new transports.Console()],
  });

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
  public contextData(ctx: ContextOptions): void {
    this.ctxData = ctx;
  }

  public log(
    level: string,
    message: string,
    source: string,
    data?: Record<string, unknown>
  ): void {
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
  // Method to convert opentelemetry trace Id to AWS Xray trace Id.
  private getAwsTraceId(): string {
    const span: Span = trace?.getSpan(context.active());
    const xrayTraceId = span?.spanContext().traceId;
    const traceIdP1 = xrayTraceId?.substring(0, 8);
    const traceIdP2 = xrayTraceId?.substring(8, xrayTraceId.length);
    let traceId;
    if (xrayTraceId) {
      traceId = `${span?.spanContext().traceFlags}-${traceIdP1}-${traceIdP2}`;
    }
    return traceId;
  }
}
export const logger = new Logger();

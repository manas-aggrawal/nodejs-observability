import { hostname } from "os";
import { Service } from "typedi";
import { createLogger, format, transports } from "winston";
import { Span, context, trace } from "@opentelemetry/api";

interface ContextOptions {
  url?: string;
  method?: string;
  request_id?: string;
  user?: Record<string, unknown>;
}
interface LogInterface {
  message: string;
  source?: string;
  event?: string;
  data?: Record<string, unknown>;
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

  public info(logData: LogInterface): void {
    this.log("info", logData);
  }
  public warn(logData: LogInterface): void {
    this.log("warn", logData);
  }
  public error(logData: LogInterface): void {
    this.log("error", logData);
  }
  public debug(logData: LogInterface): void {
    this.log("debug", logData);
  }

  // this function is used to get request context
  public contextData(ctx: ContextOptions): void {
    this.ctxData = ctx;
  }

  public log(level: string, logData: LogInterface): void {
    const traceId = this.getAwsTraceId();
    const logEntry = {
      timestamp: new Date(),
      level,
      source: logData.source,
      message: logData.message,
      data: logData.data,
      event: logData.event,
      context: this.ctxData,
      traceId,
      hostname: this.hostName,
    };
    this.logger.log(logEntry);
  }

  //Method to convert opentelemetry trace Id to AWS Xray trace Id.
  private getAwsTraceId() {
    const span: Span = trace?.getSpan(context.active());
    const xrayTraceId = span?.spanContext().traceId;
    const traceIdP1 = xrayTraceId?.substring(0, 8);
    const traceIdP2 = xrayTraceId?.substring(8, xrayTraceId.length);
    let traceId;
    if (xrayTraceId) {
      traceId =
        span?.spanContext().traceFlags + "-" + traceIdP1 + "-" + traceIdP2;
    }
    return traceId;
  }
}

export const logger = new Logger();

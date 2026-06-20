import { logs, SeverityNumber } from "@opentelemetry/api-logs";

// OTel-native logger. Emits LogRecords through the LoggerProvider configured
// by initTelemetry, which means logs travel via OTLP to the collector on the
// same pipeline as traces. The active span's trace_id and span_id are
// auto-attached by the SDK, so correlation in the backend is automatic.
//
// Designed as a parallel export to the legacy `logger` (Winston → stdout).
// API surface mirrors the legacy logger so migration is a one-line import
// swap. Consumers add log calls explicitly where they want them — neither
// initTelemetry nor traceDecorator emit anything implicitly.
//
// If initTelemetry hasn't run yet (or `logs.exporter` was set to "none"),
// emit calls are no-ops via the noop LoggerProvider — safe to import
// anywhere without ordering concerns.

const LOGGER_NAME = "telemetry-logger";

const severityFor = {
  debug: { number: SeverityNumber.DEBUG, text: "DEBUG" },
  info: { number: SeverityNumber.INFO, text: "INFO" },
  warn: { number: SeverityNumber.WARN, text: "WARN" },
  error: { number: SeverityNumber.ERROR, text: "ERROR" },
} as const;

type Level = keyof typeof severityFor;

function emit(
  level: Level,
  message: string,
  source: string,
  data?: Record<string, unknown>
): void {
  const sev = severityFor[level];
  logs.getLogger(LOGGER_NAME).emit({
    severityNumber: sev.number,
    severityText: sev.text,
    body: message,
    attributes: {
      "code.namespace": source,
      ...(data ?? {}),
    },
  });
}

export const otelLogger = {
  debug: (message: string, source: string, data?: Record<string, unknown>) =>
    emit("debug", message, source, data),
  info: (message: string, source: string, data?: Record<string, unknown>) =>
    emit("info", message, source, data),
  warn: (message: string, source: string, data?: Record<string, unknown>) =>
    emit("warn", message, source, data),
  error: (message: string, source: string, data?: Record<string, unknown>) =>
    emit("error", message, source, data),
};

import { TextMapPropagator } from "@opentelemetry/api";
import { Instrumentation } from "@opentelemetry/instrumentation";
import { IdGenerator, Sampler, SpanExporter } from "@opentelemetry/sdk-trace-base";
import { PushMetricExporter } from "@opentelemetry/sdk-metrics";
import { LogRecordExporter } from "@opentelemetry/sdk-logs";

// Named transport for the OTLP exporter. Concrete exporter instances are
// also accepted (see *Config.exporter) so callers can plug in anything
// implementing the relevant Exporter interface — Jaeger, Zipkin, custom sinks.
export type OtlpTransport = "otlp-grpc" | "otlp-http" | "otlp-proto";

export interface TracesConfig {
  // SpanExporter instance, OTLP transport name, or "none" to disable export.
  // Omit to fall back to OTEL_EXPORTER_OTLP_* environment variables.
  exporter?: SpanExporter | OtlpTransport | "none";

  // OTLP endpoint URL. Used only when `exporter` is an OTLP transport string.
  endpoint?: string;

  // Headers sent on every OTLP request (auth keys, dataset hints, etc.).
  headers?: Record<string, string>;

  // Sampling strategy. If omitted, falls back to `sampleRate` (or the
  // package default — see init.ts). Provide a full Sampler instance only
  // when you need something more elaborate than a single rate.
  sampler?: Sampler;

  // Head-based sample rate, 0.0 to 1.0. Convenience shortcut so callers
  // don't have to construct ParentBased / TraceIdRatioBased samplers
  // themselves. Ignored when `sampler` is also set. Defaults to 0.1 (10%)
  // when neither is set — see DEPRECATIONS / README for the cost rationale.
  sampleRate?: number;

  // Context propagator. Defaults to W3C Trace Context.
  propagator?: TextMapPropagator;

  // Trace-id generator. Defaults to random 128-bit; AWS X-Ray needs its own.
  idGenerator?: IdGenerator;

  // Auto-instrumentations to install. Each preset ships a sensible default
  // list; callers can override entirely or extend via `extraInstrumentations`.
  instrumentations?: Instrumentation[];

  // Health-check (or any other) request paths to exclude from HTTP traces.
  ignoreIncomingPaths?: string[];
}

export interface MetricsConfig {
  // PushMetricExporter instance, OTLP transport name, or "none" to disable.
  exporter?: PushMetricExporter | OtlpTransport | "none";
  endpoint?: string;
  headers?: Record<string, string>;
  // PeriodicExportingMetricReader interval. Defaults to 60s (OTel default).
  exportIntervalMs?: number;
}

export interface LogsConfig {
  // LogRecordExporter instance, OTLP transport name, or "none" to disable.
  exporter?: LogRecordExporter | OtlpTransport | "none";
  endpoint?: string;
  headers?: Record<string, string>;
}

export interface TelemetryOptions {
  serviceName: string;
  traces?: TracesConfig;
  metrics?: MetricsConfig;
  logs?: LogsConfig;

  // Additional instrumentations appended to whatever traces.instrumentations
  // resolves to. Convenient when you want a preset's defaults *plus* MongoDB.
  extraInstrumentations?: Instrumentation[];
}

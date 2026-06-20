import { SpanExporter } from "@opentelemetry/sdk-trace-base";
import { PushMetricExporter } from "@opentelemetry/sdk-metrics";
import { LogRecordExporter } from "@opentelemetry/sdk-logs";
import { OTLPTraceExporter as OTLPTraceGrpc } from "@opentelemetry/exporter-trace-otlp-grpc";
import { OTLPTraceExporter as OTLPTraceHttp } from "@opentelemetry/exporter-trace-otlp-http";
import { OTLPTraceExporter as OTLPTraceProto } from "@opentelemetry/exporter-trace-otlp-proto";
import { OTLPMetricExporter as OTLPMetricGrpc } from "@opentelemetry/exporter-metrics-otlp-grpc";
import { OTLPMetricExporter as OTLPMetricHttp } from "@opentelemetry/exporter-metrics-otlp-http";
import { OTLPMetricExporter as OTLPMetricProto } from "@opentelemetry/exporter-metrics-otlp-proto";
import { OTLPLogExporter as OTLPLogGrpc } from "@opentelemetry/exporter-logs-otlp-grpc";
import { OTLPLogExporter as OTLPLogHttp } from "@opentelemetry/exporter-logs-otlp-http";
import { OTLPLogExporter as OTLPLogProto } from "@opentelemetry/exporter-logs-otlp-proto";
import { Metadata } from "@grpc/grpc-js";

import { LogsConfig, MetricsConfig, OtlpTransport, TracesConfig } from "./types";

// Resolves the configured exporter (per signal) into the concrete OTel
// exporter interface. Dispatch is data-driven (registry, not switch/if-else)
// so adding a new transport is a one-line registry entry and never touches
// resolution code.
//   - SRP: this module's single concern is "build an exporter from config"
//   - OCP: register a new transport without editing the resolvers
//   - DIP: each resolver returns the OTel interface, hiding concrete classes

type ExporterKind = OtlpTransport | "none" | "instance";

// Tiny helper used by every resolver to map the (untyped) `exporter` config
// onto an ExporterKind in the matching registry. Branchless via nested
// ternaries — chains of if/else aren't worth their complexity here.
const classify = (exporter: unknown): ExporterKind =>
  typeof exporter === "string" ? (exporter as ExporterKind)
  : exporter ? "instance"
  : "otlp-grpc";

const headersToMetadata = (headers?: Record<string, string>): Metadata | undefined =>
  headers && Object.entries(headers).reduce((md, [k, v]) => (md.set(k, v), md), new Metadata());

// ── Traces ────────────────────────────────────────────────────────────
const traceBuilders: Record<ExporterKind, (cfg: TracesConfig) => SpanExporter | undefined> = {
  "none": () => undefined,
  "instance": (cfg) => cfg.exporter as SpanExporter,
  "otlp-grpc": (cfg) => new OTLPTraceGrpc({ url: cfg.endpoint, metadata: headersToMetadata(cfg.headers) }),
  "otlp-http": (cfg) => new OTLPTraceHttp({ url: cfg.endpoint, headers: cfg.headers }),
  "otlp-proto": (cfg) => new OTLPTraceProto({ url: cfg.endpoint, headers: cfg.headers }),
};

export function resolveTraceExporter(config: TracesConfig = {}): SpanExporter | undefined {
  return traceBuilders[classify(config.exporter)](config);
}

// ── Metrics ───────────────────────────────────────────────────────────
const metricBuilders: Record<ExporterKind, (cfg: MetricsConfig) => PushMetricExporter | undefined> = {
  "none": () => undefined,
  "instance": (cfg) => cfg.exporter as PushMetricExporter,
  "otlp-grpc": (cfg) => new OTLPMetricGrpc({ url: cfg.endpoint, metadata: headersToMetadata(cfg.headers) }),
  "otlp-http": (cfg) => new OTLPMetricHttp({ url: cfg.endpoint, headers: cfg.headers }),
  "otlp-proto": (cfg) => new OTLPMetricProto({ url: cfg.endpoint, headers: cfg.headers }),
};

export function resolveMetricExporter(config: MetricsConfig = {}): PushMetricExporter | undefined {
  return metricBuilders[classify(config.exporter)](config);
}

// ── Logs ──────────────────────────────────────────────────────────────
const logBuilders: Record<ExporterKind, (cfg: LogsConfig) => LogRecordExporter | undefined> = {
  "none": () => undefined,
  "instance": (cfg) => cfg.exporter as LogRecordExporter,
  "otlp-grpc": (cfg) => new OTLPLogGrpc({ url: cfg.endpoint, metadata: headersToMetadata(cfg.headers) }),
  "otlp-http": (cfg) => new OTLPLogHttp({ url: cfg.endpoint, headers: cfg.headers }),
  "otlp-proto": (cfg) => new OTLPLogProto({ url: cfg.endpoint, headers: cfg.headers }),
};

export function resolveLogExporter(config: LogsConfig = {}): LogRecordExporter | undefined {
  return logBuilders[classify(config.exporter)](config);
}

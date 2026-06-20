import process from "process";
import { TextMapPropagator } from "@opentelemetry/api";
import { W3CTraceContextPropagator } from "@opentelemetry/core";
import { defaultResource, resourceFromAttributes } from "@opentelemetry/resources";
import { ATTR_SERVICE_NAME } from "@opentelemetry/semantic-conventions";
import {
  BatchSpanProcessor,
  ParentBasedSampler,
  Sampler,
  TraceIdRatioBasedSampler,
} from "@opentelemetry/sdk-trace-base";
import { PeriodicExportingMetricReader } from "@opentelemetry/sdk-metrics";
import { BatchLogRecordProcessor } from "@opentelemetry/sdk-logs";
import * as opentelemetry from "@opentelemetry/sdk-node";

import { TelemetryOptions } from "./types";
import {
  resolveLogExporter,
  resolveMetricExporter,
  resolveTraceExporter,
} from "./exporter-factory";
import { defaultInstrumentations } from "./instrumentations";

// Cost-mindful default: 10% head sampling with parent-based inheritance.
// Means a given trace is either sampled in fully or dropped fully (never
// half — critical for trace quality). Override via traces.sampler (full
// Sampler instance) or traces.sampleRate (number, 0..1).
const DEFAULT_SAMPLE_RATE = 0.1;

const samplerFromRate = (rate: number): Sampler =>
  new ParentBasedSampler({ root: new TraceIdRatioBasedSampler(rate) });

// Branchless resolution: explicit Sampler wins; else rate-derived sampler;
// else the package default. Single `??` chain — no if/else ladder.
const resolveSampler = (sampler?: Sampler, rate?: number): Sampler =>
  sampler ?? (rate !== undefined ? samplerFromRate(rate) : samplerFromRate(DEFAULT_SAMPLE_RATE));

// Single SDK assembly point. Consumes a TelemetryOptions and emits a started
// NodeSDK. Defers exporter/propagator/id-generator/instrumentation
// construction to other modules / the caller — its only job is to wire them
// onto the SDK (SRP). It depends only on OTel interfaces, never on a vendor
// (DIP); vendor specifics live in presets.ts.
export function initTelemetry(options: TelemetryOptions): opentelemetry.NodeSDK {
  const traces = options.traces ?? {};
  const metrics = options.metrics ?? {};
  const logs = options.logs ?? {};

  const traceExporter = resolveTraceExporter(traces);
  const metricExporter = resolveMetricExporter(metrics);
  const logExporter = resolveLogExporter(logs);

  const propagator: TextMapPropagator = traces.propagator ?? new W3CTraceContextPropagator();
  const instrumentations =
    traces.instrumentations ?? defaultInstrumentations(traces.ignoreIncomingPaths);
  const allInstrumentations = [...instrumentations, ...(options.extraInstrumentations ?? [])];

  const resource = defaultResource().merge(
    resourceFromAttributes({ [ATTR_SERVICE_NAME]: options.serviceName })
  );

  const sdkConfig: Partial<opentelemetry.NodeSDKConfiguration> = {
    textMapPropagator: propagator,
    instrumentations: allInstrumentations,
    resource,
    ...(traceExporter
      ? { spanProcessors: [new BatchSpanProcessor(traceExporter)], traceExporter }
      : {}),
    ...(metricExporter
      ? {
          metricReader: new PeriodicExportingMetricReader({
            exporter: metricExporter,
            exportIntervalMillis: metrics.exportIntervalMs,
          }),
        }
      : {}),
    ...(logExporter
      ? { logRecordProcessors: [new BatchLogRecordProcessor(logExporter)] }
      : {}),
    sampler: resolveSampler(traces.sampler, traces.sampleRate),
    ...(traces.idGenerator ? { idGenerator: traces.idGenerator } : {}),
  };

  const sdk = new opentelemetry.NodeSDK(sdkConfig as opentelemetry.NodeSDKConfiguration);

  sdk.start();

  process.on("SIGTERM", () => {
    sdk.shutdown();
  });

  return sdk;
}

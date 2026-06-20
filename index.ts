import { traceDecorator } from "./src/trace-decorator";
import { adotInit } from "./src/xray-instrumentation";
import { logger } from "./src/logger";
import { otelLogger } from "./src/otel-logger";
import { metrics } from "./src/metrics";
import { initTelemetry } from "./src/telemetry/init";
import * as presets from "./src/telemetry/presets";
import {
  resolveLogExporter,
  resolveMetricExporter,
  resolveTraceExporter,
} from "./src/telemetry/exporter-factory";
import { defaultInstrumentations } from "./src/telemetry/instrumentations";

export type {
  TelemetryOptions,
  TracesConfig,
  MetricsConfig,
  LogsConfig,
  OtlpTransport,
} from "./src/telemetry/types";
export type {
  AwsPresetArgs,
  HoneycombPresetArgs,
  LocalPresetArgs,
  OtlpPresetArgs,
} from "./src/telemetry/presets";

export {
  traceDecorator,
  adotInit,
  logger,
  otelLogger,
  metrics,
  initTelemetry,
  presets,
  resolveTraceExporter,
  resolveMetricExporter,
  resolveLogExporter,
  defaultInstrumentations,
};

import { W3CTraceContextPropagator } from "@opentelemetry/core";
import { AWSXRayPropagator } from "@opentelemetry/propagator-aws-xray";
import { AWSXRayIdGenerator } from "@opentelemetry/id-generator-aws-xray";

import { TelemetryOptions } from "./types";

// Vendor presets. Sidecar-first: every preset sends OTLP/gRPC to a local
// collector on :4317; vendor routing (Honeycomb vs X-Ray vs Tempo vs ...)
// is the collector's job. The preset's job is purely the app-side concerns
// the collector cannot fix retroactively: propagator and id-generator.
//
// X-Ray needs AWS-shaped trace IDs and the X-Ray propagation header, both
// generated inside the SDK before anything leaves the process — that's why
// `aws` differs from the others. Everything else is W3C trace context.

interface CommonPresetArgs {
  serviceName: string;
  // Override if your sidecar listens somewhere other than :4317.
  collectorEndpoint?: string;
  // Request path to skip in HTTP incoming-request traces.
  healthCheckPath?: string;
}

export type AwsPresetArgs = CommonPresetArgs;
export type OtlpPresetArgs = CommonPresetArgs;
// Aliases preserved so callers can self-document their intent. All three
// produce identical SDK config — actual vendor routing happens in the
// collector.
export type HoneycombPresetArgs = OtlpPresetArgs;
export type LocalPresetArgs = OtlpPresetArgs;

const DEFAULT_COLLECTOR = "http://localhost:4317";

// AWS X-Ray bits: propagator (X-Amzn-Trace-Id) and ID generator (AWS-shaped
// 128-bit IDs). The collector still needs the awsxray/awsemf exporters
// configured to actually land data in AWS.
export const aws = ({
  serviceName,
  collectorEndpoint = DEFAULT_COLLECTOR,
  healthCheckPath,
}: AwsPresetArgs): TelemetryOptions => ({
  serviceName,
  traces: {
    exporter: "otlp-grpc",
    endpoint: collectorEndpoint,
    propagator: new AWSXRayPropagator(),
    idGenerator: new AWSXRayIdGenerator(),
    ignoreIncomingPaths: healthCheckPath ? [healthCheckPath] : [],
  },
});

// Generic OTLP preset — W3C trace context, random IDs, OTLP/gRPC to a local
// collector. Use this for Honeycomb, Grafana Tempo, Jaeger, New Relic,
// Datadog (via collector), or any other OTLP-native backend the collector
// is configured to export to.
export const otlp = ({
  serviceName,
  collectorEndpoint = DEFAULT_COLLECTOR,
  healthCheckPath,
}: OtlpPresetArgs): TelemetryOptions => ({
  serviceName,
  traces: {
    exporter: "otlp-grpc",
    endpoint: collectorEndpoint,
    propagator: new W3CTraceContextPropagator(),
    ignoreIncomingPaths: healthCheckPath ? [healthCheckPath] : [],
  },
});

// Named aliases of `otlp` for documentation-level intent. They produce the
// same SDK config because the SDK doesn't know — or need to know — which
// vendor the collector routes to.
export const honeycomb = otlp;
export const local = otlp;

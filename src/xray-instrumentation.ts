import { AlwaysOnSampler } from "@opentelemetry/sdk-trace-base";

import { initTelemetry } from "./telemetry/init";
import { aws } from "./telemetry/presets";

/**
 * @deprecated AWS-only convenience kept for v1 callers. Prefer
 * `initTelemetry(presets.aws({...}))` (or any other preset) — the new API is
 * vendor-agnostic, supports metrics + logs in addition to traces, and exposes
 * the full TelemetryOptions surface.
 *
 * Planned removal: v2.0.0 (target 2026-08-01). See DEPRECATIONS.md.
 */
export function adotInit(
  resourceServiceName: string,
  healthCheckEndpointUrl: string,
  localhostConfig: { enable: boolean; endpoint: string }
): void {
  const options = aws({
    serviceName: resourceServiceName,
    healthCheckPath: healthCheckEndpointUrl,
    collectorEndpoint: localhostConfig.enable ? localhostConfig.endpoint : undefined,
  });

  // v1 always sampled 100%. initTelemetry now defaults to 10% head sampling
  // for cost — pin AlwaysOn here so existing adotInit callers don't see a
  // silent 90% trace drop on upgrade. New code should use initTelemetry
  // directly and configure sampling via traces.sampleRate.
  initTelemetry({
    ...options,
    traces: { ...options.traces, sampler: new AlwaysOnSampler() },
  });
}

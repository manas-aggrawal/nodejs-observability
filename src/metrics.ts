import {
  Counter,
  Gauge,
  Histogram,
  MetricOptions,
  UpDownCounter,
  metrics as metricsApi,
} from "@opentelemetry/api";

// Public metrics API. Thin wrapper over the OTel Metrics API: every call
// resolves to a singleton instrument scoped to a fixed meter name, cached so
// repeated calls with the same instrument name return the same instance.
//
// Designed for explicit, on-demand use:
//   const requests = metrics.counter("api.requests");
//   requests.add(1, { route: "/checkout", status: 200 });
//
//   const latency = metrics.histogram("db.query.duration_ms");
//   latency.record(elapsedMs, { table: "orders" });
//
// Consumers add metrics where they want them — neither initTelemetry nor
// traceDecorator emit anything implicitly. If initTelemetry hasn't run
// (or `metrics.exporter` was set to "none"), the underlying MeterProvider
// is the no-op default and these calls are safely discarded.

const METER_NAME = "telemetry-meter";

// Instruments are keyed by `kind:name`. Different instrument kinds with the
// same name are stored separately (OTel itself forbids this, but caching it
// here avoids surprising silent overwrites at the user level).
const cache = new Map<string, unknown>();

const memoize = <T>(kind: string, name: string, build: () => T): T => {
  const key = `${kind}:${name}`;
  const existing = cache.get(key) as T | undefined;
  return existing ?? (cache.set(key, build()), cache.get(key) as T);
};

const meter = () => metricsApi.getMeter(METER_NAME);

export const metrics = {
  // Monotonically increasing count. Use for "how many times has X happened?"
  counter: (name: string, options?: MetricOptions): Counter =>
    memoize("counter", name, () => meter().createCounter(name, options)),

  // Distribution of values. Use for durations, payload sizes, anything you
  // want p50/p95/p99 over.
  histogram: (name: string, options?: MetricOptions): Histogram =>
    memoize("histogram", name, () => meter().createHistogram(name, options)),

  // Counter that can go up *and* down. Use for in-flight requests, queue
  // depth, connection-pool size.
  upDownCounter: (name: string, options?: MetricOptions): UpDownCounter =>
    memoize("upDownCounter", name, () => meter().createUpDownCounter(name, options)),

  // Synchronous gauge — most recent value wins. Use for things like
  // "current memory usage" sampled at known points.
  gauge: (name: string, options?: MetricOptions): Gauge =>
    memoize("gauge", name, () => meter().createGauge(name, options)),
};

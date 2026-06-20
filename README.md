# nodejs-observability

A vendor-agnostic OpenTelemetry package for Node.js / NestJS / Express. Pluggable presets for AWS X-Ray + CloudWatch, Honeycomb, Jaeger / Tempo, or any OTLP-native backend. Ships traces, metrics, and logs through a single sidecar collector with cost-mindful defaults.

## Features

- 🔌 **Pluggable presets** — `presets.aws()`, `presets.honeycomb()`, `presets.otlp()`, `presets.local()`
- 🔍 **Auto-instrumentation** — HTTP, Express, NestJS, AWS SDK, Postgres
- 📊 **All three signals** — traces, metrics, logs through the same OTLP pipeline
- 🎯 **Method-level tracing** — `@traceDecorator` (NestJS-controller-safe)
- 💸 **Cost-mindful by default** — 10% head sampling, tunable per-deploy
- 🧩 **SOLID-shaped exporter factory** — bring your own SpanExporter / MetricExporter / LogExporter
- 🌐 **End-to-end correlation** — extracts W3C `traceparent` from incoming requests

## Installation

```bash
npm install nodejs-observability
```

## Quick Start

### 1. Initialize at process start

Import and call `initTelemetry` at the very top of your entry file, **before any other imports**. The SDK has to register hooks before the modules it patches are loaded.

```typescript
// main.ts
import { initTelemetry, presets } from "nodejs-observability";

initTelemetry(presets.honeycomb({
  serviceName: "checkout",
  healthCheckPath: "/health",
}));

// Other imports follow...
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
// ...
```

Pick a preset based on where your collector exports to:

| Preset | When to use |
|---|---|
| `presets.aws(...)` | Collector exports to AWS X-Ray / CloudWatch. Sets X-Ray propagator + ID generator. |
| `presets.honeycomb(...)` / `presets.otlp(...)` / `presets.local(...)` | Collector exports to Honeycomb, Tempo, Jaeger, or any OTLP-native backend. All three are aliases — W3C trace context + random IDs. Different names so call sites self-document intent. |

All presets send OTLP/gRPC to `localhost:4317` by default (sidecar pattern). Override with `collectorEndpoint` if your collector is elsewhere.

### 2. Trace methods with the decorator

```typescript
import { traceDecorator } from "nodejs-observability";

class OrderService {
  @traceDecorator
  async processOrder(orderId: string) {
    // automatically traced, nested under any active parent span
  }
}
```

The decorator composes with NestJS controller decorators — `@traceDecorator` can sit above `@Get()`, `@Post()`, `@UseGuards()`, etc. without breaking route registration. The decorator does **not** auto-emit logs or metrics; add those explicitly where you need them.

### 3. Add logs and metrics on demand

```typescript
import { otelLogger, metrics } from "nodejs-observability";

// Logs ride the same OTLP pipeline as traces.
// trace_id + span_id are attached natively; backend correlates automatically.
otelLogger.info("Order processed", "OrderService.processOrder", { orderId });

// Metrics are explicit. Memoized — repeat calls return the same instrument.
const ordersProcessed = metrics.counter("orders.processed");
ordersProcessed.add(1, { tier: "premium" });

const orderDuration = metrics.histogram("orders.duration_ms");
orderDuration.record(elapsedMs);
```

## Complete Example

A single Nest entrypoint that wires up all three signals:

```ts
// main.ts — initTelemetry MUST be the first non-type code in this file
import { initTelemetry, presets } from "nodejs-observability";

initTelemetry({
  ...presets.honeycomb({
    serviceName: "checkout",
    healthCheckPath: "/health",
  }),
  metrics: {
    exporter: "otlp-grpc",
    endpoint: "http://localhost:4317",
    exportIntervalMs: 60000,
  },
  logs: {
    exporter: "otlp-grpc",
    endpoint: "http://localhost:4317",
  },
});

// Imports below this line — they pick up the patched modules
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors({
    origin: ["https://your-frontend.example.com"],
    allowedHeaders: ["content-type", "authorization", "traceparent", "tracestate"],
  });
  await app.listen(3000);
}
bootstrap();
```

A service using the decorator + logger + metrics together:

```ts
// orders.service.ts
import { Injectable } from "@nestjs/common";
import { traceDecorator, otelLogger, metrics } from "nodejs-observability";

@Injectable()
export class OrdersService {
  private readonly invocations = metrics.counter("orders.processed");
  private readonly duration = metrics.histogram("orders.duration_ms");

  @traceDecorator
  async processOrder(orderId: string) {
    const start = Date.now();
    otelLogger.info("Processing order", "OrdersService.processOrder", { orderId });

    try {
      const result = await this.doWork(orderId);
      this.invocations.add(1, { status: "ok" });
      return result;
    } catch (err) {
      otelLogger.error("Failed to process", "OrdersService.processOrder", {
        orderId,
        error: (err as Error).message,
      });
      this.invocations.add(1, { status: "error" });
      throw err;
    } finally {
      this.duration.record(Date.now() - start, { handler: "processOrder" });
    }
  }

  private async doWork(orderId: string) { /* ... */ }
}
```

Correlation across signals is automatic — every log line and span in this request share the same `trace_id`, and metrics carry the `service.name` resource attribute so they group with the matching traces in the backend.

## API Reference

### `initTelemetry(options: TelemetryOptions)`

Single entry point. Returns the started `NodeSDK`.

```typescript
interface TelemetryOptions {
  serviceName: string;
  traces?: TracesConfig;
  metrics?: MetricsConfig;
  logs?: LogsConfig;
  extraInstrumentations?: Instrumentation[];
}

interface TracesConfig {
  exporter?: SpanExporter | "otlp-grpc" | "otlp-http" | "otlp-proto" | "none";
  endpoint?: string;
  headers?: Record<string, string>;
  sampler?: Sampler;
  sampleRate?: number;          // 0.0–1.0; default 0.1 (10%)
  propagator?: TextMapPropagator;
  idGenerator?: IdGenerator;
  instrumentations?: Instrumentation[];
  ignoreIncomingPaths?: string[];
}

interface MetricsConfig {
  exporter?: PushMetricExporter | OtlpTransport | "none";
  endpoint?: string;
  headers?: Record<string, string>;
  exportIntervalMs?: number;    // default 60s
}

interface LogsConfig {
  exporter?: LogRecordExporter | OtlpTransport | "none";
  endpoint?: string;
  headers?: Record<string, string>;
}
```

### `presets`

Pure factories returning a `TelemetryOptions`. Compose them with `initTelemetry()`.

#### `presets.aws(args)`

X-Ray propagator + X-Ray ID generator + OTLP gRPC to a local collector (typically the ADOT collector translating to AWS X-Ray / CloudWatch).

| Arg | Type | Default | Description |
|---|---|---|---|
| `serviceName` | `string` | required | Service name attached to every span, metric, and log record. |
| `collectorEndpoint` | `string` | `http://localhost:4317` | Where the SDK sends OTLP. Override for non-sidecar setups. |
| `healthCheckPath` | `string` | — | HTTP path to exclude from incoming-request traces. |

#### `presets.otlp(args)` &nbsp; *(aliases: `presets.honeycomb`, `presets.local`)*

W3C trace context propagator + random IDs + OTLP gRPC to a local collector. All three names produce identical SDK config — pick the alias that matches your intent (`honeycomb` for Honeycomb-bound collectors, `local` for dev, `otlp` as the neutral choice).

| Arg | Type | Default | Description |
|---|---|---|---|
| `serviceName` | `string` | required | Service name. |
| `collectorEndpoint` | `string` | `http://localhost:4317` | OTLP endpoint. |
| `healthCheckPath` | `string` | — | HTTP path to exclude from incoming-request traces. |

### `@traceDecorator`

Class method decorator. Wraps the method in an active span. Composes with NestJS / Express controller decorators in either order.

### `otelLogger`

```ts
otelLogger.debug(message: string, source: string, data?: Record<string, unknown>)
otelLogger.info(...)
otelLogger.warn(...)
otelLogger.error(...)
```

Emits OTel `LogRecord`s through the LoggerProvider configured by `initTelemetry`. Trace correlation is automatic.

### `metrics`

```ts
metrics.counter(name, options?): Counter
metrics.histogram(name, options?): Histogram
metrics.upDownCounter(name, options?): UpDownCounter
metrics.gauge(name, options?): Gauge
```

Memoized — repeat calls with the same instrument name return the same instance, so it's safe to call inline at the use site.

## Sampling

The package defaults to **10% head sampling** with `ParentBasedSampler(TraceIdRatioBasedSampler(0.1))`. Either the whole trace is sampled in, or the whole trace is dropped — never half a trace.

Per-service override:

```ts
initTelemetry({
  serviceName: "checkout",
  traces: { sampleRate: 0.05 },   // 5%
});
```

Or pass a full `Sampler` for richer strategies. For best results with the collector's tail sampling (see [Collector](#collector) below), bump SDK head sampling to `1.0` — that way every trace reaches the collector, and the tail processor decides what's worth exporting.

## Collector

The example collector config bundled in this package (`examples/collector-config.yaml`) ships a Honeycomb-targeted sidecar with:

- OTLP gRPC on `:4317`, HTTP on `:4318`
- `memory_limiter` → `tail_sampling` → `batch` processors
- Tail policies: keep all errors, keep slow (>1s), 10% probabilistic baseline
- Traces / metrics / logs pipelines all wired

`tail_sampling` requires `otelcol-contrib` (not the core `otelcol` binary).

For AWS X-Ray / CloudWatch, swap the `otlphttp/honeycomb` exporter for `awsxray` + `awsemf` + `awscloudwatchlogs` and adjust pipeline `exporters:` lists. App code doesn't change — vendor routing lives entirely in the collector.

## Local Development

Run a local OTel Collector or Jaeger:

```bash
docker run -d --name jaeger \
  -e COLLECTOR_OTLP_ENABLED=true \
  -p 16686:16686 -p 4317:4317 -p 4318:4318 \
  jaegertracing/all-in-one:latest
```

Point the SDK at it:

```ts
initTelemetry(presets.local({ serviceName: "my-service" }));
// `local` is an alias of `otlp` — both default to localhost:4317.
```

Open the Jaeger UI at http://localhost:16686.

## End-to-End Tracing (Frontend → Backend)

This package handles the backend half of a frontend-initiated trace automatically. The W3C trace context propagator (built into `presets.otlp()`) extracts the `traceparent` header from incoming HTTP requests, so spans created in your NestJS handlers become children of the frontend's root span — no extra backend code needed.

The frontend half is wired up in your React / React Native app using the official OTel browser SDKs (not this package — this package is Node-only).

### Architecture

```
┌───────────────────┐  traceparent  ┌───────────────────┐
│  React /          │ ────────────► │  NestJS           │
│  React Native     │  in HTTP      │  (this package)   │
│                   │  headers      │                   │
│ Browser OTel SDK  │               │ Auto-extracts +   │
│ creates root span │               │ continues trace   │
│ + child fetch     │               │                   │
│ span, injects     │               │                   │
│ traceparent       │               │                   │
└───────────────────┘               └───────────────────┘
       │                                     │
       └──────────► same backend ◄───────────┘
              (Honeycomb / X-Ray / etc.)
              stitches by trace_id
```

Trace correlation requires nothing but the `traceparent` header on the wire — no shared code between frontend and backend.

### React (web) setup

```bash
npm install @opentelemetry/api @opentelemetry/sdk-trace-web \
  @opentelemetry/exporter-trace-otlp-http \
  @opentelemetry/instrumentation-fetch \
  @opentelemetry/instrumentation-document-load \
  @opentelemetry/context-zone \
  @opentelemetry/resources @opentelemetry/semantic-conventions
```

```ts
// src/telemetry.ts — imported once at the entry point, before any fetch
import { WebTracerProvider, BatchSpanProcessor } from "@opentelemetry/sdk-trace-web";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { ZoneContextManager } from "@opentelemetry/context-zone";
import { registerInstrumentations } from "@opentelemetry/instrumentation";
import { FetchInstrumentation } from "@opentelemetry/instrumentation-fetch";
import { DocumentLoadInstrumentation } from "@opentelemetry/instrumentation-document-load";
import { resourceFromAttributes } from "@opentelemetry/resources";
import { ATTR_SERVICE_NAME } from "@opentelemetry/semantic-conventions";

const provider = new WebTracerProvider({
  resource: resourceFromAttributes({ [ATTR_SERVICE_NAME]: "checkout-web" }),
  spanProcessors: [
    new BatchSpanProcessor(
      new OTLPTraceExporter({
        url: import.meta.env.VITE_OTLP_ENDPOINT,
        headers: { "x-honeycomb-team": import.meta.env.VITE_HONEYCOMB_INGEST_KEY },
      })
    ),
  ],
});
provider.register({ contextManager: new ZoneContextManager() });

registerInstrumentations({
  instrumentations: [
    new DocumentLoadInstrumentation(),
    new FetchInstrumentation({
      // Browsers only inject traceparent on same-origin requests by default.
      // List your API origins here so cross-origin fetches carry the header.
      propagateTraceHeaderCorsUrls: [/https:\/\/api\.example\.com\/.*/],
    }),
  ],
});
```

### React Native setup

The same OTel JS SDKs work in RN — the fetch instrumentation hooks RN's polyfilled fetch. No first-class official OTel-RN SDK exists yet, so wiring is similar to web with a few differences:

- No `DocumentLoadInstrumentation` (no DOM).
- Use `@opentelemetry/context-async-hooks` instead of `ZoneContextManager`.
- The default in-memory batch buffer is lost when the app is backgrounded — consider a smaller `maxExportBatchSize` and shorter `scheduledDelayMillis` so spans flush promptly on visible state changes.

### CORS — the most common gotcha

For cross-origin frontend → backend calls, the browser only sends `traceparent` if the backend's CORS preflight allows it:

```ts
// main.ts
app.enableCors({
  origin: [...],
  allowedHeaders: [
    "content-type",
    "authorization",
    "traceparent",
    "tracestate",
    "baggage",   // only if you use baggage propagation
  ],
});
```

Without this, the browser strips the header and your trace fragments at the network boundary — every backend call shows up as a fresh root span.

### Where browser/RN traffic should land

| Option | How | When |
|---|---|---|
| **Direct to vendor** | OTLP/HTTP straight to Honeycomb (or another OTLP-native ingest) using a scoped ingest-only API key. | Simplest. Honeycomb supports this; AWS X-Ray does not. |
| **Public collector** | Run an internet-facing OTel Collector behind TLS, receiving OTLP/HTTP on `:4318`. Frontend posts to it. | When you want vendor changes to be a YAML edit, not a frontend redeploy. More surface to operate. |
| **Backend proxy** | Frontend POSTs to a NestJS route; backend forwards through its existing collector. | When the collector must stay private (compliance), or to reuse your auth layer. Adds latency. |

For AWS-side observability you'll typically need the public-collector or backend-proxy path — there's no public OTLP-to-X-Ray bridge equivalent to Honeycomb's ingest URL.

### Sampling for browsers — read before going to production

Browsers and mobile apps create spans cheaply and abundantly: every page load, every fetch, every navigation. Without sampling you can easily 10×–100× your trace volume and your vendor bill. Apply head-based sampling at the frontend SDK:

```ts
import { ParentBasedSampler, TraceIdRatioBasedSampler } from "@opentelemetry/sdk-trace-base";

new WebTracerProvider({
  sampler: new ParentBasedSampler({ root: new TraceIdRatioBasedSampler(0.1) }), // 10%
  // ...
});
```

`ParentBasedSampler` ensures that if the backend decides to sample a request in (or out), the frontend's child spans follow the same decision — and vice versa.

### Privacy

Browser auto-instrumentations capture full URLs (including query strings) and user agents. If any URL parameter carries PII, configure a span processor to redact attributes before export, or scrub at the collector.

## Migrating from v1.x

**Upgrading from `1.0.x` to `1.1.x` is non-breaking.** Your existing `adotInit(...)` and `logger.info(...)` calls keep working unchanged. You'll see soft `@deprecated` warnings in your IDE and a one-time `DeprecationWarning` on stderr when each deprecated function is first called. Migrate at your own pace; the deprecated symbols stay until v2.0.0 (target 2026-08-01).

One thing to be aware of while still on the deprecated `logger`: it writes JSON to stdout via Winston exactly as it did in v1.0.x. It does **not** auto-flow through the new OTLP logs pipeline — so if you want logs correlated with traces in your observability backend, swap the import to `otelLogger` (single-line change).

`adotInit` and the legacy Winston `logger` are deprecated. See [DEPRECATIONS.md](DEPRECATIONS.md) for full side-by-side migrations and the removal timeline (v2.0.0, target 2026-08-01).

Quick version:

```ts
// Before (v1.x)
import { adotInit, logger } from "nodejs-observability";

adotInit("checkout", "/health", { enable: true, endpoint: "http://localhost:4317" });
logger.info("…", "Source", { });

// After
import { initTelemetry, presets, otelLogger } from "nodejs-observability";

initTelemetry(presets.aws({
  serviceName: "checkout",
  healthCheckPath: "/health",
  collectorEndpoint: "http://localhost:4317",
}));
otelLogger.info("…", "Source", { });
```

## Before You Ship to Production

Quick checklist before deploying with this package:

- [ ] **Lower `sampleRate`** — the default is 10%. For high-traffic services, 1–5% is typical; for low-traffic services, 100% is often fine. Set it explicitly so cost doesn't surprise you in the first billing cycle.
- [ ] **Move the collector endpoint to env** — don't hardcode `localhost:4317`. Use `process.env.OTEL_COLLECTOR_ENDPOINT` (or your convention) so dev / staging / prod differ without a code change. **This value has to match what your collector binds** — it's the `receivers.otlp.protocols.grpc.endpoint` line in `examples/collector-config.yaml` (default in the example: `0.0.0.0:4317`). If the app side and the collector side disagree on host/port, the SDK silently fails to export.
- [ ] **Store vendor secrets outside code** — `HONEYCOMB_API_KEY`, AWS credentials, etc. go through your secret manager (AWS Secrets Manager, k8s Secret, Vault). Never commit them.
- [ ] **Verify CORS `allowedHeaders`** — if a browser frontend calls this service, NestJS `enableCors({ allowedHeaders: [..., "traceparent", "tracestate"] })`. Without this, trace continuity breaks at the network boundary and frontend / backend spans never join.
- [ ] **Tail sampling at the collector** — if you operate the collector yourself, enable the `tail_sampling` processor (see `examples/collector-config.yaml`). Keeps every error trace plus a percentage of normal traffic — usually cheaper *and* more useful than aggressive head sampling.
- [ ] **SIGTERM grace period** — the SDK auto-registers a SIGTERM handler that flushes the in-memory batch buffers (spans queued in `BatchSpanProcessor`, log records in `BatchLogRecordProcessor`, etc.) before the process exits. If your orchestrator kills the process too aggressively, the last few seconds of telemetry are lost. **The setting lives in your deployment config, not your app code.** Where to set it depending on your stack:

  | Stack | Field | Where |
  |---|---|---|
  | Kubernetes | `terminationGracePeriodSeconds: 30` | Pod / Deployment spec |
  | Docker Compose | `stop_grace_period: 30s` | per service |
  | `docker run` | `--stop-timeout 30` | CLI flag |
  | ECS task definition | `stopTimeout: 30` | container definition |
  | systemd | `TimeoutStopSec=30s` | unit file |
  | PM2 | `kill_timeout: 30000` | `ecosystem.config.js` |

  30 seconds is a safe floor. Increase it if your buffers are large or the network to the collector is high-latency.

## Troubleshooting

### Spans don't appear in the backend
- Confirm `initTelemetry` runs **before** any other import. Anything patched by an instrumentation (`http`, `express`, NestJS bootstrap) must load *after* the SDK registers its hooks.
- Check `traces.sampleRate` — at the 10% default, only 1 in 10 traces is sampled.
- Confirm the collector is reachable at the configured endpoint and has the right exporter wired.

### NestJS routes break after adding `@traceDecorator`
- Make sure you're on the current package version. Older versions had a decorator that dropped `descriptor.value`, breaking `@Get`/`@Post` metadata. Current decorator copies reflect-metadata onto the wrapper so it composes safely regardless of decorator order.

### CORS strips `traceparent` between frontend and backend
- Add `traceparent`, `tracestate`, `baggage` to NestJS `enableCors({ allowedHeaders: [...] })`.

### Tail sampling drops too much
- Tail sampling only sees what reaches the collector. If SDK head sampling is 10% and tail probabilistic is 10%, vendor sees ~1% of normal traffic. Either raise SDK head to `1.0`, raise the tail probabilistic percentage, or both.

### Logs don't show up in the observability backend
- Confirm `logs` is configured in `initTelemetry`. Without it, the LoggerProvider falls back to a no-op and `otelLogger` calls are silently discarded.
- Confirm the collector's `logs` pipeline has an exporter for your backend.

## Requirements

- Node.js >= 18.x
- TypeScript >= 5.x (decorators require `experimentalDecorators: true`)

## Roadmap

- [x] Pluggable exporter / propagator / id-generator
- [x] Metrics SDK
- [x] OTel Logs SDK
- [x] Cost-mindful sampling defaults
- [x] Tail-based sampling at the collector
- [x] End-to-end trace correlation across frontend / backend
- [ ] MongoDB instrumentation in the default set
- [ ] `TelemetryModule.forRoot(...)` for NestJS — Nest-shaped wrapper around `initTelemetry`, plus injectable `OtelLoggerService` / `metrics` providers
- [ ] Winston transport bridge so v1 `logger` users get OTLP for free during the deprecation window

## License

MIT — fork, customize, ship. See [LICENSE](LICENSE).

## Support

- Open an [issue](https://github.com/manas-aggrawal/nodejs-observability/issues)
- See [DEPRECATIONS.md](DEPRECATIONS.md) for migration guidance

---

Made with ❤️ for the Node.js community

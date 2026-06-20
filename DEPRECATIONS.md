# Deprecations

Things slated for removal in **v2.0.0** (target **2026-08-01**, ~2 months from the v1.x line freeze on 2026-05-31).

All deprecated APIs continue to work in v1.x — they emit JSDoc `@deprecated` warnings in TypeScript and IDEs. Migrate at your own pace; we won't remove anything before the target date.

---

## `adotInit(serviceName, healthCheckUrl, localhostConfig)`

The AWS-only one-liner from v1.0.x. Limited to traces, hardcodes the X-Ray propagator and ID generator, no way to point at non-AWS backends.

**Replacement:** `initTelemetry(options: TelemetryOptions)` plus a preset.

```ts
// Before
import { adotInit } from "nodejs-observability";
adotInit("checkout", "/health", { enable: true, endpoint: "http://localhost:4317" });

// After — AWS
import { initTelemetry, presets } from "nodejs-observability";
initTelemetry(presets.aws({
  serviceName: "checkout",
  healthCheckPath: "/health",
  collectorEndpoint: "http://localhost:4317",
}));

// After — Honeycomb / Jaeger / Tempo / any OTLP backend
initTelemetry(presets.otlp({ serviceName: "checkout", healthCheckPath: "/health" }));
```

`initTelemetry` also accepts `metrics` and `logs` sub-configs on the same options object; `adotInit` only ever set up traces.

---

## `logger` (Winston → stdout)

The v1.x logger writes JSON to stdout with the active X-Ray trace ID injected as a string field. Correlation with traces in the observability backend only works if a separate log shipper picks up stdout and ships it to the same backend the collector exports traces to. Two pipes, stitched together at the backend.

**Replacement:** `otelLogger`, which emits OTel `LogRecord`s through the OTLP logs pipeline. The backend correlates by `trace_id` + `span_id` automatically because those are attached natively to every record.

```ts
// Before
import { logger } from "nodejs-observability";
logger.info("Order processed", "OrderService.process", { orderId });

// After
import { otelLogger } from "nodejs-observability";
otelLogger.info("Order processed", "OrderService.process", { orderId });
```

The method signature is identical — migration is a one-line import swap. The new logger requires `initTelemetry` to have run with a `logs` config (or it falls back to a no-op LoggerProvider and quietly discards). Update your collector YAML to include a `logs` pipeline if you haven't already (see `examples/collector-config.yaml`).

---

## Removal mechanics

When v2.0.0 ships:
- `adotInit` will be removed from `index.ts`.
- The `Logger` class and the `logger` singleton will be removed from `index.ts` and `src/logger.ts` will be deleted.
- `typedi` and `winston` will leave `dependencies` in `package.json`.

If you have a hard dependency on either, pin to the latest v1.x release in `package.json` and migrate before upgrading to v2.

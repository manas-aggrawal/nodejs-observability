import { HttpInstrumentation } from "@opentelemetry/instrumentation-http";
import { ExpressInstrumentation } from "@opentelemetry/instrumentation-express";
import { NestInstrumentation } from "@opentelemetry/instrumentation-nestjs-core";
import { AwsInstrumentation } from "@opentelemetry/instrumentation-aws-sdk";
import { PgInstrumentation } from "@opentelemetry/instrumentation-pg";

// Default auto-instrumentations shipped with every preset. Callers can
// override entirely (TracesConfig.instrumentations) or extend via
// TelemetryOptions.extraInstrumentations.
//
// Return type is intentionally inferred. `InstrumentationOption` is a union
// whose `typeof InstrumentationBase` arm carries a private `_modules` field;
// naming that union pins the type to whichever physical copy of
// `@opentelemetry/instrumentation` this file imports, which then fails to
// assign into NodeSDKConfiguration when npm hoists a different copy under
// sdk-node. Letting TS infer keeps each element matched against the
// `Instrumentation` interface arm (structural), which works across copies.
export function defaultInstrumentations(ignoreIncomingPaths: string[] = []) {
  const ignoreSet = new Set(ignoreIncomingPaths);
  return [
    new HttpInstrumentation({
      ignoreIncomingRequestHook: (req) => ignoreSet.has(req.url ?? ""),
    }),
    new ExpressInstrumentation(),
    new NestInstrumentation(),
    new AwsInstrumentation({ suppressInternalInstrumentation: true }),
    new PgInstrumentation(),
  ];
}

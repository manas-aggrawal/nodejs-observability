import { Span, trace, SpanStatusCode } from "@opentelemetry/api";

// Active-span decorator. Wraps a class method in an OpenTelemetry span.
//
// Implemented as a TypeScript "experimentalDecorators" method decorator
// (target, propertyKey, descriptor). The wrapper replaces descriptor.value
// directly — older revisions used a getter/setter accessor, which:
//   1. dropped descriptor.value, breaking @Get/@Post/@UseGuards/etc. that
//      attach metadata via Reflect.defineMetadata(..., descriptor.value),
//   2. returned a fresh function on every property read, so reflect-metadata
//      keys defined against one read couldn't be found on the next.
// Reflect-metadata keys already attached to the original method are copied
// onto the wrapper so this decorator composes regardless of order.
//
// Intentionally does NOT auto-emit logs or metrics. The span carries the
// error status on throw — consumers add their own logger/metrics calls
// where they need them.
export function traceDecorator(
  target: any,
  propertyKey: string,
  descriptor: PropertyDescriptor
): PropertyDescriptor {
  const originalMethod = descriptor.value;
  const spanName = `${target.constructor.name}.${propertyKey}`;

  const wrapped = async function (this: unknown, ...args: unknown[]): Promise<unknown> {
    const tracer = trace.getTracer("telemetry-tracer");

    return tracer.startActiveSpan(spanName, async (span: Span) => {
      try {
        const result = await originalMethod.apply(this, args);
        span.setStatus({ code: SpanStatusCode.OK });
        return result;
      } catch (err) {
        span.setStatus({ code: SpanStatusCode.ERROR, message: (err as Error).message });
        span.recordException(err as Error);
        throw err;
      } finally {
        span.end();
      }
    });
  };

  copyMetadata(originalMethod, wrapped);
  Object.defineProperty(wrapped, "name", { value: originalMethod.name, configurable: true });

  descriptor.value = wrapped;
  return descriptor;
}

// Copy any reflect-metadata keys (NestJS PATH_METADATA, GUARDS_METADATA, etc.)
// from the original method onto the wrapper. Without this, a decorator order
// like `@traceDecorator` above `@Get('/foo')` would silently break routing.
function copyMetadata(from: Function, to: Function): void {
  const Reflect_: any = (globalThis as any).Reflect;
  if (!Reflect_ || typeof Reflect_.getMetadataKeys !== "function") return;
  const keys: unknown[] = Reflect_.getMetadataKeys(from) || [];
  for (const key of keys) {
    Reflect_.defineMetadata(key, Reflect_.getMetadata(key, from), to);
  }
}

import { Span, trace, SpanStatusCode, SpanKind } from "@opentelemetry/api";
import { logger } from "./logger";

// active span decorator
export function traceDecorator(target: any, key: string): any {
  let value = target[key];

  const descriptor: PropertyDescriptor = {
    configurable: true,
    enumerable: false,

    get() {
      const _propertyKey = key;

      const originalMethod = value;

      return async function (...args: unknown[]): Promise<unknown> {
        const tracer = trace.getTracer("telemetry-tracer");

        return tracer.startActiveSpan(
          `${target.constructor.name}.${_propertyKey}`,
          async (span: Span) => {
            logger.info("SPAN STARTS!", {
              source: `${target.constructor.name}.${_propertyKey}`,
            });

            try {
              const result = await originalMethod.apply(this, args);
              span.setStatus({ code: SpanStatusCode.OK });

              return result;
            } catch (err) {
              logger.error(err, {
                source: `${target.constructor.name}.${_propertyKey}`,
              });
              span.setStatus({
                code: SpanStatusCode.ERROR,
                message: err.message,
              });
              throw err;
            } finally {
              logger.info("SPAN ENDS!", {
                source: `${target.constructor.name}.${_propertyKey}`,
              });
              span.end();
            }
          }
        );
      };
    },

    set(newValue) {
      value = newValue;
    },
  };

  return descriptor;
}

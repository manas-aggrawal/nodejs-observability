import { Span, trace, SpanStatusCode } from "@opentelemetry/api";
import { logger } from "./logger";

//active span decorator
export function traceDecorator(target: any, key: string): any {
  let value = target[key];

  const descriptor: PropertyDescriptor = {
    configurable: true,
    enumerable: false,

    get() {
      const _propertyKey = key;

      const originalMethod = value;

      return async function (...args: unknown[]): Promise<unknown> {
        const tracer = trace.getTracer("global-tracer");

        return tracer.startActiveSpan(
          `${target.constructor.name} #${_propertyKey}`,
          async (span: Span) => {
            logger.info(
              `${target.constructor.name} #${_propertyKey} SPAN STARTS!`
            );

            try {
              const result = await originalMethod.apply(this, args);
              span.setStatus({ code: SpanStatusCode.OK });
              // span.setAttributes(result);
              return result;
            } catch (err) {
              logger.error(
                `ERROR IN - ${target.constructor.name} #${_propertyKey}`,
                {
                  err,
                }
              );
              span.setStatus({
                code: SpanStatusCode.ERROR,
                message: err.message,
              });
              throw err;
            } finally {
              logger.info(
                `${target.constructor.name} #${_propertyKey} SPAN ENDS!`
              );
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

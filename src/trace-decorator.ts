import { Span, trace, SpanStatusCode } from "@opentelemetry/api";
import { logger } from "./logger";

//active span decorator
export function traceDecorator() {
  return (
    _target: unknown,
    _propertyKey: string,
    descriptor: PropertyDescriptor
  ) => {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: unknown[]): Promise<unknown> {
      const tracer = trace.getTracer("global-tracer");

      return tracer.startActiveSpan(
        `${_target.constructor.name} #${_propertyKey}`,
        async (span: Span) => {
          logger.info(
            `${_target.constructor.name} #${_propertyKey} SPAN STARTS!`
          );

          try {
            const result = await originalMethod.apply(this, args);
            span.setStatus({ code: SpanStatusCode.OK });
            span.setAttributes(result);
            return result;
          } catch (err) {
            logger.error(
              `${_target.constructor.name} #${_propertyKey} - ERROR - ${err}`
            );
            span.setStatus({
              code: SpanStatusCode.ERROR,
              message: err.message,
            });
            throw err;
          } finally {
            logger.info(
              `${_target.constructor.name} #${_propertyKey} SPAN ENDS!`
            );
            span.end();
          }
        }
      );
    };

    return descriptor;
  };
}

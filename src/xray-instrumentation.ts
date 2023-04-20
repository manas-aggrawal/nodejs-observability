import process from "process";
import { Resource } from "@opentelemetry/resources";
import { SemanticResourceAttributes } from "@opentelemetry/semantic-conventions";
import { BatchSpanProcessor } from "@opentelemetry/sdk-trace-base";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-grpc";
import { AWSXRayPropagator } from "@opentelemetry/propagator-aws-xray";
import { AWSXRayIdGenerator } from "@opentelemetry/id-generator-aws-xray";
import * as opentelemetry from "@opentelemetry/sdk-node";
import { HttpInstrumentation } from "@opentelemetry/instrumentation-http";
import { AwsInstrumentation } from "@opentelemetry/instrumentation-aws-sdk";
import { PgInstrumentation } from "@opentelemetry/instrumentation-pg";
import { ExpressInstrumentation } from "@opentelemetry/instrumentation-express";

export function adotInit(
  resourceServiceName: string,
  healthCheckEndpointUrl: string
) {
  const traceExporter = new OTLPTraceExporter();

  const spanProcessor = new BatchSpanProcessor(traceExporter);
  const tracerConfig = {
    idGenerator: new AWSXRayIdGenerator(),
  };

  const sdk = new opentelemetry.NodeSDK({
    textMapPropagator: new AWSXRayPropagator(),
    instrumentations: [
      new HttpInstrumentation({
        ignoreIncomingRequestHook: (req) => {
          return req.url === healthCheckEndpointUrl;
        },
      }),
      new ExpressInstrumentation(),
      new AwsInstrumentation({
        suppressInternalInstrumentation: true,
      }),
      new PgInstrumentation(),
    ],
    resource: Resource.default().merge(
      new Resource({
        [SemanticResourceAttributes.SERVICE_NAME]: resourceServiceName,
      })
    ),
    spanProcessor,
    traceExporter,
  });
  sdk.configureTracerProvider(tracerConfig, spanProcessor);

  // this enables the API to record telemetry
  sdk.start();

  // gracefully shut down the SDK on process exit
  process.on("SIGTERM", () => {
    sdk.shutdown();
  });
}

import process from "process";
import { Resource } from "@opentelemetry/resources";
import { SemanticResourceAttributes } from "@opentelemetry/semantic-conventions";
import { BatchSpanProcessor } from "@opentelemetry/sdk-trace-base";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-grpc";
import { AWSXRayPropagator } from "@opentelemetry/propagator-aws-xray";
import { AWSXRayIdGenerator } from "@opentelemetry/id-generator-aws-xray";
import * as opentelemetry from "@opentelemetry/sdk-node";
import { getNodeAutoInstrumentations } from "@opentelemetry/auto-instrumentations-node";
import { AdotInitOptions } from "./type/adot-init";

export function adotInit(options: AdotInitOptions) {
  const traceExporter = new OTLPTraceExporter();

  const spanProcessor = new BatchSpanProcessor(traceExporter);
  const tracerConfig = {
    idGenerator: new AWSXRayIdGenerator(),
  };

  const sdk = new opentelemetry.NodeSDK({
    textMapPropagator: new AWSXRayPropagator(),
    instrumentations: [
      getNodeAutoInstrumentations({
        "@opentelemetry/instrumentation-http": {
          ignoreIncomingRequestHook: (request) => {
            return request.url.includes(options.healthCheckEndpointUrl);
          },
        },
        "@opentelemetry/instrumentation-aws-sdk": {
          suppressInternalInstrumentation: true,
        },
        "@opentelemetry/instrumentation-winston": {
          logHook: (span, record) => {
            record["resource.service.name"] = options.resourceServiceName;
          },
        },
      }),
    ],
    resource: Resource.default().merge(
      new Resource({
        [SemanticResourceAttributes.SERVICE_NAME]: options.resourceServiceName,
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

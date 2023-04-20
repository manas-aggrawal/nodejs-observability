This package enables **AWS XRay telemetry** in your project.
It uses *AWS Distro for Opentelemetry* to trace every request in your project.
Manual instrumentation of HTTP, DB, express etc services has been done.
TraceId have been injected in logs to co-relate logs and traces.
Logger instance also comes from this package itself you just have to import and use it.


**Installation**

1. Import `adotInit()` in server.ts of your project, on the top, before logger import. This will instrument the telemetry code and initialize the tracer for your project.
   

   ```
   import {adotInit} from "@studiographene/nodejs-telemetry";
      adotInit(<resourceServiceName>, <healthCheckEndpointUrl>);

   ```
2. Import traceDecorator, which is a method decorator, in all of the files where you want to trace your code.

   ```
   import {traceDecorator} from "@studiographene/nodejs-telemetry";
   ```

3. Apply `@traceDecorator` on top of the methods you want to trace. This decorator will start/end active spans for your method automatically.

   ```
   @traceDecorator
   public async someFn(){
      //some code
   }
   ```
4. This trace decorator will automatically create spans and subspans for continuous code and will automatically log any error encountered against that trace. You have to apply `@traceDecorator` on the subsequent methods as well, which are called within the previous method.

   ```
   // controller.ts file
   import {traceDecorator} from "@studiographene/nodejs-telemetry";

   @traceDecorator
   public async someFn(){
      await fn2();
   }

   // service.ts file
   import {traceDecorator} from "@studiographene/nodejs-telemetry";

   @traceDecorator
   public async fn2(){
      //some code.
   }
   ```
5. In logger there are 4 different types of severity levels - "info", "warning", "error" and "debug".

   logger options:
   1. level (required) - info|warning|error|debug
   2. message (string)(required)
   3. source (string)(required) - You can give name of the class and function where the logger is used
   4. data (Record<string, unknown>)(optional)

   Example of 'info' level log.
   ```
   import {logger} from "@studiographene/nodejs-telemetry";

   @traceDecorator
   public async someFn(){
      logger.info("some message", 
          "source_name", 
         {
            key: value
         }
      );
   }
   ```

And you are **Done**!

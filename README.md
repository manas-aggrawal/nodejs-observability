This package enables **AWS XRay telemetry** in your project.
It uses *AWS Distro for Opentelemetry* to trace every request in your project.
Manual instrumentation of HTTP, DB, express etc services has been done.
TraceId have been injected in logs to co-relate logs and traces.
Logger instance also comes from this package itself you just have to import and use it.


**Installation**

**For local:-**
   1. Make a .npmrc file in your project root- 
      ```
      engine-strict=true
      //npm.pkg.github.com/:_authToken=${NPM_TOKEN}
      @studiographene:registry=https://npm.pkg.github.com

      ```
   2. In your Dockerfile - add `ARG NPM_TOKEN` and `COPY .npmrc .npmrc` 

   3. In docker compose file - 
      ```
	   build:
         args:
            NPM_TOKEN: ${NPM_TOKEN}

      ```
   4. Make **Personal Access Token** (PAT) in github for your local use and replace `${NPM_TOKEN}` in .npmrc file with your token before installing the package and running docker build command.
   5. Then `npm i @studiographene/nodejs-telemetry`.

**For development environments:-**

   1. 1st & 2nd steps from above remain as it is.
   2. Use value of PAT created above to create github secret named `NPM_TOKEN`. 
   3. Add `NPM_TOKEN` in the AWS environment/parameter store.


**Getting Started**

1. Import `adotInit()` in server.ts of your project, on the top, before logger import. This will instrument the telemetry code and initialize the tracer for your project.
   

   ```
   import {adotInit} from "@studiographene/nodejs-telemetry";
      adotInit(<resourceServiceName>, <healthCheckEndpointUrl>, <localhostConfig>);

   ```
   "localhostConfig" has two options "enable" (boolean) and "endpoint" (localhost url with port, where you want to export the traces).
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
6. Also, Request context (i.e. request url, request method, and request id) and user context (i.e. user id) can also be passed in logs using below mentioned functions.
   ```
   contextData(ctx: Record<string, unknown>)

   userContext(usrCtx: Record<string, unknown>)

   ```
   contextData() must be called first using a middleware passing request data like url, method and request Id. After this you can call userContext() to pass some user context.

And you are **Done**!

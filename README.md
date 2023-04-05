This package enables **telemetry** in you project.
It uses *AWS Distro for Opentelemetry* to trace every request in your project.
Auto-instrumentation has been done to trace HTTP, DNS, DB, Winston etc services.
TraceId have been injected in logs to co-relate logs and traces.
Logger instance also comes from this package itself.

**Installation**

1. Import `adotInit()` in app.ts and call it in constructor of the class in this file. This will instrument the telemetry code and initialize the tracer for your project.
   

```
import {traceDecorator} from "nodejs-telemetry";
   class App{
      constructor(){
         adotInit(<resourceServiceName>, <healthCheckEndpointUrl>);
         // some other code.
      }
   }

```
2. Import traceDecorator(), which is a decorator function, in all of the files where you want to trace your code.

```
import {traceDecorator} from "nodejs-telemetry";
```

3. Apply `@traceDecorator()` on top of the methods you want to trace.

```
@traceDecorator()
public async someFn(){
   //some code
}
```
4. This trace decorator will automatically create spans and subspans for continuous code and will automatically log any error encountered against that trace. You just have to import logger as well, from the package, in whatever file you want to use the logger.

```
import {logger} from "nodejs-telemetry";
@traceDecorator()
public async someFn(){
   logger.info("some message");
   //some code

}
```

And you are **Done**!

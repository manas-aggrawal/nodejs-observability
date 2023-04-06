This package enables **telemetry** in you project.
It uses *AWS Distro for Opentelemetry* to trace every request in your project.
Auto-instrumentation has been done to trace HTTP, DNS, DB, Winston etc services.
TraceId have been injected in logs to co-relate logs and traces.
Logger instance also comes from this package itself.


**Installation**

1. Import `adotInit()` in app.ts and call it in constructor of the class in this file. This will instrument the telemetry code and initialize the tracer for your project.
   

```
import {traceDecorator} from "@studiographene/nodejs-telemetry";
   class App{
      constructor(){
         adotInit(<resourceServiceName>, <healthCheckEndpointUrl>);
         // some other code.
      }
   }

```
2. Import traceDecorator(), which is a decorator function, in all of the files where you want to trace your code.

```
import {traceDecorator} from "@studiographene/nodejs-telemetry";
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
import {logger} from "@studiographene/nodejs-telemetry";
@traceDecorator()
public async someFn(){
   logger.info("some message");
   //some code
}
```
5. In logger there are 4 different types of levels - "info", "warning", "error" and "debug". And you can use them like shown below.

```
import {logger} from "@studiographene/nodejs-telemetry";
@traceDecorator()
public async someFn(){
   logger.info("some message");
   //or
   logger.info("mssg",{key:value, key2:value});

   logger.debug("some message");
   //or
   logger.debug("mssg",{key:value, key2:value});

   logger.warn("some message");
   //or
   logger.warn("mssg", {key:value});

   logger.error("some message");
   //or
   logger.error("some mssg", {key:value});
   
}
```

And you are **Done**!

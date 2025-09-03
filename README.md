# nodejs-observability

A comprehensive AWS X-Ray telemetry package for Node.js applications using AWS Distro for OpenTelemetry (ADOT). This package provides automatic instrumentation, distributed tracing, and correlated logging with minimal configuration.

## Features

- 🔍 **Automatic Instrumentation** - HTTP, Database, Express and other services
- 📊 **Distributed Tracing** - Full request tracing with AWS X-Ray
- 📝 **Correlated Logging** - TraceId injection for log-trace correlation
- 🎯 **Method-level Tracing** - Decorator-based span creation
- 🛠️ **Built-in Logger** - Structured logging with severity levels
- 🏃 **Local Development** - Jaeger support for local testing

## Installation

```bash
npm install nodejs-observability
```

## Quick Start

### 1. Initialize Telemetry

Import `adotInit()` at the very top of your `server.ts` file, before any other imports:

```typescript
import { adotInit } from "nodejs-observability";

adotInit(
  "my-service-name",           // Service name for traces
  "/health",                    // Health check endpoint to exclude
  {                            // Local development config (optional)
    enable: true,
    endpoint: "http://localhost:4317"
  }
);

// Other imports follow...
import { logger } from "nodejs-observability";
```

### 2. Add Method Tracing

Use the `@traceDecorator` to automatically create spans for your methods:

```typescript
import { traceDecorator } from "nodejs-observability";

class UserService {
  @traceDecorator
  public async getUser(id: string) {
    // This method is now automatically traced
    const user = await db.findUser(id);
    return user;
  }
  
  @traceDecorator
  public async updateUser(id: string, data: any) {
    // Nested traces are automatically linked
    await this.validateUser(id);
    return await db.updateUser(id, data);
  }
  
  @traceDecorator
  private async validateUser(id: string) {
    // Creates a child span under updateUser
    // Errors are automatically captured
  }
}
```

### 3. Use the Logger

The built-in logger automatically includes TraceId for correlation:

```typescript
import { logger } from "nodejs-observability";

@traceDecorator
public async processOrder(orderId: string) {
  logger.info(
    "Processing order",
    "OrderService.processOrder",
    { orderId, status: "started" }
  );
  
  try {
    const result = await this.executeOrder(orderId);
    
    logger.info(
      "Order processed successfully",
      "OrderService.processOrder",
      { orderId, result }
    );
    
    return result;
  } catch (error) {
    logger.error(
      "Order processing failed",
      "OrderService.processOrder",
      { orderId, error: error.message }
    );
    throw error;
  }
}
```

### 4. Add Context Information

Enrich your logs with request and user context:

```typescript
import { contextData, userContext } from "nodejs-observability";

// Middleware to add request context
app.use((req, res, next) => {
  contextData({
    url: req.url,
    method: req.method,
    requestId: req.headers['x-request-id']
  });
  next();
});

// Add user context after authentication
app.use(authMiddleware, (req, res, next) => {
  if (req.user) {
    userContext({
      userId: req.user.id,
      role: req.user.role
    });
  }
  next();
});
```

## API Reference

### `adotInit(serviceName, healthCheckUrl, localhostConfig?)`

Initializes the telemetry system.

| Parameter | Type | Description |
|-----------|------|-------------|
| `serviceName` | `string` | Name of your service in traces |
| `healthCheckUrl` | `string` | Endpoint to exclude from tracing |
| `localhostConfig` | `object` | Optional local development configuration |
| `localhostConfig.enable` | `boolean` | Enable local tracing |
| `localhostConfig.endpoint` | `string` | Local collector endpoint |

### `@traceDecorator`

Method decorator that automatically creates spans.

```typescript
@traceDecorator
async myMethod() {
  // Automatically traced
}
```

### Logger Methods

All logger methods follow the pattern: `logger.level(message, source, data?)`

```typescript
logger.info(message: string, source: string, data?: Record<string, unknown>)
logger.warning(message: string, source: string, data?: Record<string, unknown>)
logger.error(message: string, source: string, data?: Record<string, unknown>)
logger.debug(message: string, source: string, data?: Record<string, unknown>)
```

### Context Methods

```typescript
contextData(ctx: Record<string, unknown>)  // Set request context
userContext(usrCtx: Record<string, unknown>)  // Set user context
```

## Local Development

For local development and testing, you can use Jaeger to visualize traces:

### 1. Start Jaeger

```bash
docker run -d --name jaeger \
  -e COLLECTOR_OTLP_ENABLED=true \
  -p 16686:16686 \
  -p 4317:4317 \
  -p 4318:4318 \
  jaegertracing/all-in-one:latest
```

### 2. Configure Local Tracing

```typescript
adotInit("my-service", "/health", {
  enable: true,
  endpoint: "http://localhost:4317"
});
```

### 3. View Traces

Open Jaeger UI at `http://localhost:16686` to view your traces.

## Best Practices

### 1. Trace Key Operations
Apply `@traceDecorator` to:
- API route handlers
- Database operations
- External API calls
- Business logic methods
- Error-prone operations

### 2. Use Structured Logging
```typescript
// Good
logger.info("User created", "UserService.create", {
  userId: user.id,
  email: user.email,
  timestamp: Date.now()
});

// Avoid
logger.info(`User ${user.id} created`);
```

### 3. Handle Errors Properly
```typescript
@traceDecorator
async riskyOperation() {
  try {
    return await externalApi.call();
  } catch (error) {
    logger.error("External API failed", "Service.riskyOperation", {
      error: error.message,
      code: error.code
    });
    throw error;  // Re-throw to maintain trace error status
  }
}
```

### 4. Create Trace Hierarchies
```typescript
@traceDecorator
async parentOperation() {
  await this.childOperation1();  // Apply decorator to create child span
  await this.childOperation2();  // Apply decorator to create child span
}
```

## Examples

### Express Application

```typescript
import { adotInit, traceDecorator, logger } from "nodejs-observability";

// Initialize at the very top
adotInit("express-api", "/health", {
  enable: process.env.NODE_ENV === 'development',
  endpoint: "http://localhost:4317"
});

import express from 'express';
const app = express();

class UserController {
  @traceDecorator
  async getUsers(req, res) {
    logger.info("Fetching users", "UserController.getUsers");
    const users = await userService.getAllUsers();
    res.json(users);
  }
}

app.get('/users', (req, res) => controller.getUsers(req, res));
```

### Error Tracking

```typescript
@traceDecorator
async processPayment(paymentData) {
  logger.info("Payment initiated", "PaymentService.process", {
    amount: paymentData.amount,
    currency: paymentData.currency
  });
  
  try {
    const result = await paymentGateway.charge(paymentData);
    logger.info("Payment successful", "PaymentService.process", {
      transactionId: result.id
    });
    return result;
  } catch (error) {
    // Error automatically linked to trace
    logger.error("Payment failed", "PaymentService.process", {
      error: error.message,
      paymentData
    });
    throw error;
  }
}
```

## Open Source & Contributing

This package is **completely free and open source**! Feel free to:
- 🍴 **Fork it** for your own use and modifications
- 🔧 **Customize it** to fit your specific needs  
- 🚀 **Use it** in your commercial or personal projects
- 💡 **Contribute back** if you've built something useful

### Want to Contribute?

We'd love your help making this package better! Here's how:

```bash
# 1. Fork the repo to your account
# 2. Clone your fork
git clone https://github.com/manas-aggrawal/nodejs-observability.git
cd nodejs-observability
npm install

# 3. Create a feature branch
git checkout -b your-awesome-feature

# 4. Make your changes and test
npm test
npm run lint

# 5. Push to your fork
git push origin your-awesome-feature

# 6. Open a Pull Request to our main repo
```

**All contributions are welcome:**
- 🐛 Bug fixes
- ✨ New features
- 📚 Documentation improvements
- 🎨 Code refactoring
- 💭 Ideas and suggestions

See [CONTRIBUTING.md](CONTRIBUTING.md) for detailed guidelines.

### Using in Your Project?

No need to ask permission! This is MIT licensed - just fork it and make it your own. If you build something cool with it, we'd love to hear about it!

## Troubleshooting

### Traces not appearing in AWS X-Ray
- Ensure AWS credentials are configured
- Check IAM permissions for X-Ray
- Verify service name doesn't contain invalid characters

### Local traces not showing in Jaeger
- Confirm Jaeger is running: `docker ps`
- Check endpoint configuration matches Jaeger port
- Verify `localhostConfig.enable` is `true`

### Decorator not creating spans
- Ensure `@traceDecorator` is applied to methods (not arrow functions)
- Verify `adotInit()` is called before decorator usage
- Check that decorated methods are actually being called

## Requirements

- Node.js >= 14.x
- TypeScript >= 4.x (for decorator support)
- AWS credentials configured (for X-Ray)

## License

MIT

## Support

For issues and questions:
- Open an [issue](https://github.com/manas-aggrawal/nodejs-observability/issues)
- Check [existing issues](https://github.com/manas-aggrawal/nodejs-observability/issues?q=is%3Aissue)
- See [CONTRIBUTING.md](CONTRIBUTING.md) for more details

## Roadmap

- [ ] Support for additional databases (MongoDB)
- [ ] Custom span attributes
- [ ] Sampling strategies configuration
- [ ] Metrics collection
- [ ] Support for other telemetry backends
- [ ] NestJS integration

---

Made with ❤️ for the Node.js community
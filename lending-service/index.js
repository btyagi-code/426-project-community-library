import express from 'express';
import { checkout } from './services/lending.js';
import {
  log,
  metricsHandler,
  requestMetricsMiddleware
} from './observability.js';

const app = express();
const port = process.env.PORT || 3003;

app.use(express.json());
app.use(requestMetricsMiddleware);

app.get('/health', (req, res) => {
  return res.json({
    status: 'ok',
    service: 'lending-service',
  });
});

app.get('/metrics', metricsHandler);

app.post('/loan', async (req, res) => {
  const start = Date.now();

  try {
    const result = await checkout(req.body);

    if (!result.ok) {
      const elapsedMs = Date.now() - start;

      log('warn', 'loan request rejected', {
        service: 'lending-service',
        method: req.method,
        path: req.originalUrl,
        status: result.status,
        responseTimeMs: elapsedMs,
        error: result.error
      });

      return res.status(result.status).json({ 
        error: result.error
      });
    }

    return res.json({
      loan: result.loan
    });

  } catch (error) {
    const elapsedMs = Date.now() - start; 

    // log each unexpected exception
    log('error', 'unable to place loan', {
      service: 'lending-service',
      method: req.method,
      path: req.originalUrl,
      responseTimeMs: elapsedMs,
      error: error.message
    });

    // response contains generic error message to conceal sensitive unhandled exception details
    return res.status(500).json({
      error: 'Unable to place loan'
    });
  }
});

app.listen(port, () => {
  log('info', 'lending-service started', {
    service: 'lending-service',
    port: Number(port)
  });
});
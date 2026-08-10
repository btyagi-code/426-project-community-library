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
  try {
    const result = await checkout(req.body);

    if (!result.ok) {
      return res.status(result.status).json({
        error: result.error
      });
    }

    return res.json({
      loan: result.loan
    });

  } catch (error) {
    log('error', 'unable to place loan', {
      service: 'lending-service',
      error: error.message
    });

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
import express from 'express';
import {
  log,
  metricsHandler,
  requestMetricsMiddleware
} from './observability.js';

const app = express();

const PORT = process.env.PORT || 3000;

const CATALOG_SERVICE_URL =
  process.env.CATALOG_SERVICE_URL ||
  'http://catalog-service:3000';

// Track request count, status, and response time
app.use(requestMetricsMiddleware);

// Health endpoint for this ambassador container
app.get('/health', (req, res) => {
  return res.json({
    status: 'ok',
    service: 'catalog-ambassador',
  });
});

// Prometheus metrics endpoint
app.get('/metrics', metricsHandler);

// Capture request bodies without interpreting them
app.use(
  express.raw({
    type: '*/*',
    limit: '1mb',
  })
);

// Catch-all proxy
app.use(async (req, res) => {
  const startTime = Date.now();

  const targetUrl =
    `${CATALOG_SERVICE_URL}${req.originalUrl}`;

  try {
    const headers = {};

    if (req.headers['content-type']) {
      headers['content-type'] =
        req.headers['content-type'];
    }

    if (req.headers.accept) {
      headers.accept = req.headers.accept;
    }

    const requestOptions = {
      method: req.method,
      headers,
    };

    if (
      req.method !== 'GET' &&
      req.method !== 'HEAD' &&
      req.body &&
      req.body.length > 0
    ) {
      requestOptions.body = req.body;
    }

    const upstreamResponse = await fetch(
      targetUrl,
      requestOptions
    );

    const responseBody =
      await upstreamResponse.text();

    const elapsedMs =
      Date.now() - startTime;

    log('info', 'proxied catalog request', {
      service: 'catalog-ambassador',
      method: req.method,
      path: req.originalUrl,
      upstreamStatus:
        upstreamResponse.status,
      upstreamResponseTimeMs:
        elapsedMs,
    });

    const contentType =
      upstreamResponse.headers.get(
        'content-type'
      );

    if (contentType) {
      res.set(
        'content-type',
        contentType
      );
    }

    return res
      .status(
        upstreamResponse.status
      )
      .send(responseBody);

  } catch (error) {
    const elapsedMs =
      Date.now() - startTime;

    log(
      'error',
      'catalog-service unreachable',
      {
        service:
          'catalog-ambassador',
        method: req.method,
        path: req.originalUrl,
        responseTimeMs:
          elapsedMs,
        error: error.message,
      }
    );

    return res
      .status(502)
      .json({
        error:
          'catalog-service unreachable',
      });
  }
});

app.listen(PORT, () => {
  log(
    'info',
    'catalog-ambassador started',
    {
      service:
        'catalog-ambassador',
      port: Number(PORT),
      upstream:
        CATALOG_SERVICE_URL,
    }
  );
});
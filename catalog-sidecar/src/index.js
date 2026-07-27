import express from 'express';

const app = express();

const PORT = process.env.PORT || 3000;

const CATALOG_SERVICE_URL =
  process.env.CATALOG_SERVICE_URL ||
  'http://catalog-service:3000';

/*
 * Capture request bodies without interpreting them.
 * The current catalog endpoint uses GET, but this keeps the proxy
 * ready for other HTTP methods without changing the sidecar.
 */
app.use(
  express.raw({
    type: '*/*',
    limit: '1mb',
  })
);

app.use(async (req, res) => {
  const startTime = Date.now();
  const targetUrl = `${CATALOG_SERVICE_URL}${req.originalUrl}`;

  try {
    const headers = {};

    if (req.headers['content-type']) {
      headers['content-type'] = req.headers['content-type'];
    }

    if (req.headers.accept) {
      headers.accept = req.headers.accept;
    }

    const requestOptions = {
      method: req.method,
      headers,
    };

    /*
     * GET and HEAD requests cannot include a request body.
     * Other methods forward the original request body when present.
     */
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

    const responseBody = await upstreamResponse.text();
    const elapsedMs = Date.now() - startTime;

    console.log(
      `[catalog-sidecar] ${req.method} ${req.originalUrl} ` +
        `-> ${upstreamResponse.status} (${elapsedMs}ms)`
    );

    const contentType =
      upstreamResponse.headers.get('content-type');

    if (contentType) {
      res.set('content-type', contentType);
    }

    return res
      .status(upstreamResponse.status)
      .send(responseBody);
  } catch (error) {
    const elapsedMs = Date.now() - startTime;

    console.error(
      `[catalog-sidecar] ${req.method} ${req.originalUrl} ` +
        `-> ERROR (${elapsedMs}ms): ${error.message}`
    );

    return res.status(502).json({
      error: 'catalog-service unreachable',
    });
  }
});

app.listen(PORT, () => {
  console.log(
    `catalog-sidecar listening on port ${PORT}`
  );
});
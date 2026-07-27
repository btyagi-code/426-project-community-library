import express from 'express';

const app = express();
const CATALOG_SERVICE_URL = process.env.CATALOG_SERVICE_URL || 'http://catalog-service:3000';

app.use(async (req, res) => {
  const start = Date.now();
  const targetUrl = `${CATALOG_SERVICE_URL}${req.originalUrl}`;

  try {
    const upstream = await fetch(targetUrl, { method: req.method });
    const elapsedMs = Date.now() - start;
    const body = await upstream.text();

    console.log(
      `[catalog-sidecar] ${req.method} ${req.originalUrl} -> ${upstream.status} (${elapsedMs}ms)`
    );

    res.status(upstream.status);
    res.set('content-type', upstream.headers.get('content-type') || 'application/json');
    res.send(body);
  } catch (err) {
    const elapsedMs = Date.now() - start;
    console.log(
      `[catalog-sidecar] ${req.method} ${req.originalUrl} -> ERROR (${elapsedMs}ms): ${err.message}`
    );
    res.status(502).json({ error: 'catalog-service unreachable' });
  }
});

app.listen(3000, () => console.log('catalog-sidecar listening on port 3000'));
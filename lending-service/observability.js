const DEFAULT_BUCKETS_MS = [
  5,
  10,
  25,
  50,
  100,
  250,
  500,
  750,
  1000,
  2000,
  5000,
];

const requests = new Map();
const histograms = new Map();

const escapeLabel = (value) =>
  String(value)
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n');

const labelKey = (method, path, status) =>
  `${method}\u0000${path}\u0000${status}`;

const labelsText = (method, path, status, extra = '') => {
  const base =
    `method="${escapeLabel(method)}",` +
    `path="${escapeLabel(path)}",` +
    `status="${escapeLabel(status)}"`;

  return extra ? `${base},${extra}` : base;
};

const observeRequest = (method, path, status, durationMs) => {
  const key = labelKey(method, path, status);

  // Request counter
  requests.set(key, (requests.get(key) || 0) + 1);

  // Response-time histogram
  let histogram = histograms.get(key);

  if (!histogram) {
    histogram = {
      count: 0,
      sum: 0,
      buckets: DEFAULT_BUCKETS_MS.map(() => 0),
    };

    histograms.set(key, histogram);
  }

  histogram.count += 1;
  histogram.sum += durationMs;

  DEFAULT_BUCKETS_MS.forEach((bucket, index) => {
    if (durationMs <= bucket) {
      histogram.buckets[index] += 1;
    }
  });
};

// Structured JSON logger
export const log = (level, message, fields = {}) => {
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...fields,
  };

  const line = JSON.stringify(entry);

  if (level === 'error') {
    console.error(line);
  } else if (level === 'warn') {
    console.warn(line);
  } else {
    console.log(line);
  }
};

// Middleware that measures every HTTP request
export const requestMetricsMiddleware = (req, res, next) => {
  const started = process.hrtime.bigint();

  const path =
    req.path ||
    req.originalUrl.split('?')[0] ||
    '/';

  res.on('finish', () => {
    const durationMs =
      Number(process.hrtime.bigint() - started) / 1e6;

    const method = req.method;
    const status = String(res.statusCode);

    observeRequest(
      method,
      path,
      status,
      durationMs
    );

    log('info', 'request completed', {
      method,
      path,
      status: res.statusCode,
      responseTimeMs: Number(durationMs.toFixed(3)),
    });
  });

  next();
};

// GET /metrics handler
export const metricsHandler = (req, res) => {
  const lines = [
    '# HELP http_requests_total Total number of HTTP requests received.',
    '# TYPE http_requests_total counter',
  ];

  for (const [key, count] of requests.entries()) {
    const [method, path, status] =
      key.split('\u0000');

    lines.push(
      `http_requests_total{${labelsText(
        method,
        path,
        status
      )}} ${count}`
    );
  }

  lines.push(
    '# HELP http_request_duration_ms HTTP request response time in milliseconds.',
    '# TYPE http_request_duration_ms histogram'
  );

  for (const [key, histogram] of histograms.entries()) {
    const [method, path, status] =
      key.split('\u0000');

    DEFAULT_BUCKETS_MS.forEach((bucket, index) => {
      lines.push(
        `http_request_duration_ms_bucket{${labelsText(
          method,
          path,
          status,
          `le="${bucket}"`
        )}} ${histogram.buckets[index]}`
      );
    });

    lines.push(
      `http_request_duration_ms_bucket{${labelsText(
        method,
        path,
        status,
        'le="+Inf"'
      )}} ${histogram.count}`
    );

    lines.push(
      `http_request_duration_ms_sum{${labelsText(
        method,
        path,
        status
      )}} ${histogram.sum}`
    );

    lines.push(
      `http_request_duration_ms_count{${labelsText(
        method,
        path,
        status
      )}} ${histogram.count}`
    );
  }

  res.set(
    'Content-Type',
    'text/plain; version=0.0.4; charset=utf-8'
  );

  res.status(200).send(`${lines.join('\n')}\n`);
};
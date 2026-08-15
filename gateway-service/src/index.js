import os from 'node:os';
import express from 'express';
import { createClient } from 'redis';
import {
  log,
  metricsHandler,
  requestMetricsMiddleware,
  observeCache
} from './observability.js';

const app = express();
const PORT = process.env.PORT || 3000;

const CATALOG_SERVICE_URL =
  process.env.CATALOG_SERVICE_URL ||
  'http://catalog-ambassador:3000';

const REDIS_URL =
  process.env.REDIS_URL ||
  'redis://redis:6379';

const INSTANCE_ID = os.hostname();
const CACHE_TTL_SECONDS = 5;

const redisClient = createClient({
  url: REDIS_URL
});

redisClient.on('error', (err) => {
  log('error', 'redis error', {
    service: 'gateway-service',
    instance: INSTANCE_ID,
    error: err.message
  });
});

await redisClient.connect();

const BRANCHES = [
  'Downtown',
  'North',
  'East'
];

const BRANCH_TIMEOUT_MS = 500;

const delay = (ms) =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

function ownProcessingLatency() {
  if (Math.random() < 0.95) {
    return 10 + Math.random() * 50;
  }

  return 75 + Math.random() * 75;
}

async function fetchBranch(title, branch) {
  const controller = new AbortController();

  const timeout = setTimeout(() => {
    controller.abort();
  }, BRANCH_TIMEOUT_MS);

  try {
    const searchParams =
      new URLSearchParams({
        title,
        branch,
      });

    const response = await fetch(
      `${CATALOG_SERVICE_URL}/catalog/search?${searchParams.toString()}`,
      {
        signal: controller.signal,
      }
    );

    if (!response.ok) {
      return {
        branch,
        ok: false,
        status: response.status,
        error: `catalog returned status ${response.status}`,
      };
    }

    const data = await response.json();

    return {
      branch,
      ok: true,
      results: Array.isArray(data.results)
        ? data.results
        : [],
    };
  } catch (error) {
    return {
      branch,
      ok: false,
      error:
        error.name === 'AbortError'
          ? 'timeout'
          : 'catalog unavailable',
    };
  } finally {
    clearTimeout(timeout);
  }
}

// Week 6 observability middleware
app.use(requestMetricsMiddleware);

app.get('/health', (req, res) => {
  return res.json({
    status: 'ok',
    service: 'gateway-service',
    instance: INSTANCE_ID,
  });
});

// Prometheus endpoint
app.get('/metrics', metricsHandler);

app.get('/availability', async (req, res) => {
  const title =
    typeof req.query.title === 'string'
      ? req.query.title.trim()
      : '';

  if (!title) {
    return res.status(400).json({
      error: 'title query parameter is required',
    });
  }

  const cacheKey =
    `availability:${title.toLowerCase()}`;

  try {
    const cached =
      await redisClient.get(cacheKey);

    if (cached) {
      log('info', 'cache hit', {
        service: 'gateway-service',
        instance: INSTANCE_ID,
        title,
        cacheKey
      });

      observeCache('hit');

      res.set('X-Cache', 'HIT');
      res.set(
        'X-Cache-Instance',
        INSTANCE_ID
      );

      return res.json({
        ...JSON.parse(cached),
        cache: 'HIT',
        instance: INSTANCE_ID,
      });
    }
  } catch (error) {
    log('error', 'redis GET failed', {
      service: 'gateway-service',
      instance: INSTANCE_ID,
      error: error.message
    });
  }

  log('info', 'cache miss', {
    service: 'gateway-service',
    instance: INSTANCE_ID,
    title,
    cacheKey
  });

  observeCache('hit');

  await delay(
    ownProcessingLatency()
  );

  const outcomes =
    await Promise.all(
      BRANCHES.map((branch) =>
        fetchBranch(title, branch)
      )
    );

  const branches = outcomes
    .filter(
      (outcome) => outcome.ok
    )
    .map((outcome) => {
      const availableCopies =
        outcome.results.reduce(
          (total, entry) =>
            total +
            Number(
              entry.available_copies ||
                0
            ),
          0
        );

      const formats =
        outcome.results.map(
          (entry) => ({
            format:
              entry.format,
            available_copies:
              Number(
                entry.available_copies ||
                  0
              ),
          })
        );

      return {
        branch: outcome.branch,
        available_copies:
          availableCopies,
        formats,
      };
    });

  const unavailable_branches =
    outcomes
      .filter(
        (outcome) => !outcome.ok
      )
      .map((outcome) => ({
        branch: outcome.branch,
        reason: outcome.error,
      }));

  const payload = {
    title,
    branches,
    unavailable_branches,
    partial_result:
      unavailable_branches.length > 0,
  };

  try {
    await redisClient.set(
      cacheKey,
      JSON.stringify(payload),
      {
        EX: CACHE_TTL_SECONDS,
      }
    );
  } catch (error) {
    log('error', 'redis SET failed', {
      service: 'gateway-service',
      instance: INSTANCE_ID,
      error: error.message
    });
  }

  res.set('X-Cache', 'MISS');
  res.set(
    'X-Cache-Instance',
    INSTANCE_ID
  );

  return res.json({
    ...payload,
    cache: 'MISS',
    instance: INSTANCE_ID,
  });
});

app.listen(PORT, () => {
  log(
    'info',
    'gateway-service started',
    {
      service: 'gateway-service',
      instance: INSTANCE_ID,
      port: Number(PORT),
      catalogServiceUrl:
        CATALOG_SERVICE_URL,
      redisUrl: REDIS_URL
    }
  );
});
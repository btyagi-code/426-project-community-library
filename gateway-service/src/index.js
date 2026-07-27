import express from 'express';

const app = express();
const PORT = process.env.PORT || 3000;

const CATALOG_SERVICE_URL =
  process.env.CATALOG_SERVICE_URL ||
  'http://catalog-ambassador:3000';

const BRANCHES = ['Downtown', 'North', 'East'];

// A branch request is stopped before it can cause the gateway
// to exceed the 700ms latency objective.
const BRANCH_TIMEOUT_MS = 500;

const delay = (ms) =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

function ownProcessingLatency() {
  // 95% of gateway processing completes between 10ms and 60ms.
  if (Math.random() < 0.95) {
    return 10 + Math.random() * 50;
  }

  // Simulate occasional additional gateway processing work.
  return 75 + Math.random() * 75;
}

async function fetchBranch(title, branch) {
  const controller = new AbortController();

  const timeout = setTimeout(() => {
    controller.abort();
  }, BRANCH_TIMEOUT_MS);

  try {
    const searchParams = new URLSearchParams({
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

app.get('/health', (req, res) => {
  return res.json({
    service: 'gateway-service',
    status: 'healthy',
  });
});

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

  await delay(ownProcessingLatency());

  // All branch calls run in parallel so their response times
  // are not added together.
  const outcomes = await Promise.all(
    BRANCHES.map((branch) =>
      fetchBranch(title, branch)
    )
  );

  const branches = outcomes
    .filter((outcome) => outcome.ok)
    .map((outcome) => {
      const availableCopies = outcome.results.reduce(
        (total, entry) =>
          total + Number(entry.available_copies || 0),
        0
      );

      const formats = outcome.results.map((entry) => ({
        format: entry.format,
        available_copies: Number(
          entry.available_copies || 0
        ),
      }));

      return {
        branch: outcome.branch,
        available_copies: availableCopies,
        formats,
      };
    });

  const unavailable_branches = outcomes
    .filter((outcome) => !outcome.ok)
    .map((outcome) => ({
      branch: outcome.branch,
      reason: outcome.error,
    }));

  return res.json({
    title,
    branches,
    unavailable_branches,
    partial_result: unavailable_branches.length > 0,
  });
});

app.listen(PORT, () => {
  console.log(`gateway-service listening on port ${PORT}`);
});
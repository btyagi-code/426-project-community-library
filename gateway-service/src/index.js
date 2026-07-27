import express from 'express';

const app = express();
const CATALOG_SERVICE_URL = process.env.CATALOG_SERVICE_URL || 'http://catalog-service:3000';

const BRANCHES = ['Downtown', 'North', 'East'];

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const ownProcessingLatency = () =>
  Math.random() < 0.9
    ? 15 + Math.random() * 60
    : 100 + Math.random() * 100;

const BRANCH_TIMEOUT_MS = 600;

async function fetchBranch(title, branch) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), BRANCH_TIMEOUT_MS);

  try {
    const url = `${CATALOG_SERVICE_URL}/catalog/search?title=${encodeURIComponent(title)}&branch=${encodeURIComponent(branch)}`;
    const response = await fetch(url, { signal: controller.signal });

    if (!response.ok) {
      return { branch, ok: false };
    }

    const data = await response.json();
    return { branch, ok: true, results: data.results };
  } catch (err) {
    return { branch, ok: false };
  } finally {
    clearTimeout(timeout);
  }
}

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.get('/availability', async (req, res) => {
  const { title } = req.query;

  if (!title) {
    return res.status(400).json({ error: 'title query parameter is required' });
  }

  await delay(ownProcessingLatency());

  const outcomes = await Promise.all(
    BRANCHES.map((branch) => fetchBranch(title, branch))
  );

  const branches = outcomes
    .filter((outcome) => outcome.ok)
    .map(({ branch, results }) => ({
      branch,
      available_copies: results.reduce((sum, entry) => sum + entry.available_copies, 0),
      formats: results.map(({ format, available_copies }) => ({ format, available_copies })),
    }));

  const unavailable_branches = outcomes
    .filter((outcome) => !outcome.ok)
    .map((outcome) => outcome.branch);

  res.json({ title, branches, unavailable_branches });
});

app.listen(3000, () => console.log('gateway-service listening on port 3000'));
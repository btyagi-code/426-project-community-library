import express from 'express';

const app = express();
const PORT = process.env.PORT || 3000;

const catalog = [
  {
    title: 'The Great Gatsby',
    isbn: '9780743273565',
    branch: 'Downtown',
    format: 'physical',
    available_copies: 2,
  },
  {
    title: 'The Great Gatsby',
    isbn: '9780743273565',
    branch: 'North',
    format: 'physical',
    available_copies: 0,
  },
  {
    title: 'The Great Gatsby',
    isbn: '9780743273565',
    branch: 'North',
    format: 'digital',
    available_copies: 3,
  },
  {
    title: 'Beloved',
    isbn: '9781400033416',
    branch: 'Downtown',
    format: 'physical',
    available_copies: 0,
  },
  {
    title: 'Beloved',
    isbn: '9781400033416',
    branch: 'East',
    format: 'physical',
    available_copies: 1,
  },
  {
    title: 'Beloved',
    isbn: '9781400033416',
    branch: 'East',
    format: 'digital',
    available_copies: 5,
  },
  {
    title: 'Educated',
    isbn: '9780399590504',
    branch: 'Downtown',
    format: 'physical',
    available_copies: 4,
  },
  {
    title: 'Educated',
    isbn: '9780399590504',
    branch: 'Downtown',
    format: 'digital',
    available_copies: 2,
  },
  {
    title: 'Educated',
    isbn: '9780399590504',
    branch: 'North',
    format: 'physical',
    available_copies: 0,
  },
  {
    title: 'Dune',
    isbn: '9780441172719',
    branch: 'East',
    format: 'physical',
    available_copies: 1,
  },
  {
    title: 'Dune',
    isbn: '9780441172719',
    branch: 'North',
    format: 'physical',
    available_copies: 3,
  },
];

const delay = (ms) =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

function getLatency() {
  // 95% of requests complete between 20ms and 150ms.
  if (Math.random() < 0.95) {
    return 20 + Math.random() * 130;
  }

  // 5% simulate slower database lookups.
  // The maximum simulated latency remains below 400ms.
  return 250 + Math.random() * 140;
}

app.get('/health', (req, res) => {
  return res.json({
    service: 'catalog-service',
    status: 'healthy',
  });
});

app.get('/catalog/search', async (req, res) => {
  const title =
    typeof req.query.title === 'string'
      ? req.query.title.trim()
      : '';

  const branch =
    typeof req.query.branch === 'string'
      ? req.query.branch.trim()
      : '';

  if (!title) {
    return res.status(400).json({
      error: 'title query parameter is required',
    });
  }

  await delay(getLatency());

  // Simulate a 0.5% temporary failure rate.
  // This gives the service margin above the 99% reliability SLO.
  if (Math.random() < 0.005) {
    return res.status(503).json({
      error: 'catalog temporarily unavailable',
    });
  }

  const normalizedTitle = title.toLowerCase();
  const normalizedBranch = branch.toLowerCase();

  const results = catalog.filter((entry) => {
    const titleMatches = entry.title
      .toLowerCase()
      .includes(normalizedTitle);

    const branchMatches =
      !branch ||
      entry.branch.toLowerCase() === normalizedBranch;

    return titleMatches && branchMatches;
  });

  return res.json({
    title,
    branch: branch || null,
    results,
  });
});

app.listen(PORT, () => {
  console.log(`catalog-service listening on port ${PORT}`);
});
import express from 'express';

const app = express();

const catalog = [
  { title: 'The Great Gatsby', isbn: '9780743273565', branch: 'Downtown', format: 'physical', available_copies: 2 },
  { title: 'The Great Gatsby', isbn: '9780743273565', branch: 'North', format: 'physical', available_copies: 0 },
  { title: 'The Great Gatsby', isbn: '9780743273565', branch: 'North', format: 'digital', available_copies: 3 },
  { title: 'Beloved', isbn: '9781400033416', branch: 'Downtown', format: 'physical', available_copies: 0 },
  { title: 'Beloved', isbn: '9781400033416', branch: 'East', format: 'physical', available_copies: 1 },
  { title: 'Beloved', isbn: '9781400033416', branch: 'East', format: 'digital', available_copies: 5 },
  { title: 'Educated', isbn: '9780399590504', branch: 'Downtown', format: 'physical', available_copies: 4 },
  { title: 'Educated', isbn: '9780399590504', branch: 'Downtown', format: 'digital', available_copies: 2 },
  { title: 'Educated', isbn: '9780399590504', branch: 'North', format: 'physical', available_copies: 0 },
  { title: 'Dune', isbn: '9780441172719', branch: 'East', format: 'physical', available_copies: 1 },
  { title: 'Dune', isbn: '9780441172719', branch: 'North', format: 'physical', available_copies: 3 },
];

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// mostly fast, occasionally slow -- keeps p95 close to our 400ms target
function getLatency() {
  if (Math.random() < 0.95) {
    return 20 + Math.random() * 130;
  }
  return 300 + Math.random() * 150;
}

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.get('/catalog/search', async (req, res) => {
  const { title } = req.query;

  if (!title) {
    return res.status(400).json({ error: 'title query parameter is required' });
  }

  await delay(getLatency());

  if (Math.random() < 0.01) {
    return res.status(503).json({ error: 'catalog temporarily unavailable' });
  }

  const needle = title.toLowerCase();
  const results = catalog.filter((entry) => entry.title.toLowerCase().includes(needle));

  res.json({ title, results });
});

app.listen(3000, () => console.log('catalog-service listening on port 3000'));
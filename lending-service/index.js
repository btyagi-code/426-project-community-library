import express from 'express';
import { checkout } from './services/lending.js';

const app = express();
const port = process.env.PORT || 3003;

app.use(express.json());

app.get('/health', (req, res) => {
  return res.json({
    service: 'lending-service',
    status: 'healthy',
  });
});

app.post('/loan', async (req, res) => {
  try {
    const result = await checkout(req.body);

    if (!result.ok) {
      return res.status(result.status).json({ error: result.error });
    } 

    return res.json({ loan: result.loan }); 
  } catch (error) {
    console.error('Unable to place loan:', error);
    res.status(500).json({ error: 'Unable to place loan' });
  }
});

app.listen(port, () => {
    console.log(`lending-service listening on port ${port}`);
});

import dotenv from 'dotenv';
import express from 'express';
import { mywaf } from './waf/waf.js';
dotenv.config({ quiet: true });
const app = express();
app.use(express.json({ limit: '48kb' }));
app.use(express.urlencoded({ extended: true, limit: '48kb' }));
const waf = mywaf({
  mode: process.env.WAF_MODE || 'hybrid',
  strict: 'normal',
  apiKey: process.env.SQLISHIELD_API_KEY,
  backendUrl: process.env.SQLISHIELD_BACKEND_URL || 'http://localhost:3000',
});
app.use(waf);
app.get('/health', (req, res) =>
  res.json({ status: 'ok', application: 'Protected sample app' })
);
app.get('/users', (req, res) =>
  res.json({ message: 'Request allowed by SQLiShield', query: req.query })
);
app.post('/login', (req, res) =>
  res.json({ message: 'Request allowed by SQLiShield' })
);
app.get('/products/:id', (req, res) => res.json({ productId: req.params.id }));
const server = app.listen(3001, '127.0.0.1', () =>
  console.log('Protected sample app: http://localhost:3001')
);
async function stop() {
  server.closeIdleConnections();
  server.close(async () => {
    await waf.close();
  });
}
process.once('SIGINT', () => void stop());
process.once('SIGTERM', () => void stop());

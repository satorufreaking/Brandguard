import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { initDatabase } from './db.js';
import { router as apiRouter } from './routes/api.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Security & Parsing Middleware
app.use(cors());
app.use(express.json());

// Mount API routes
app.use('/api', apiRouter);

// Serve frontend static assets in production if public directory exists
const publicDir = new URL('public', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1');
try {
  app.use(express.static(publicDir));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) return next();
    res.sendFile('index.html', { root: publicDir }, (err) => {
      if (err) next();
    });
  });
} catch (_) {}

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('[BrandGuard Server Error]:', err.stack);
  res.status(500).json({
    error: 'Internal Server Error',
    message: err.message,
  });
});

// Start Server and Initialize Database
async function start() {
  await initDatabase();
  app.listen(PORT, () => {
    console.log(`[BrandGuard AI Server] Running on http://localhost:${PORT}`);
  });
}

// Only listen if not imported by test suite
if (process.env.NODE_ENV !== 'test') {
  start();
}

export default app;

import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { initDatabase } from './db.js';
import { router as apiRouter } from './routes/api.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;
const allowedOrigins = new Set([
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:4173',
  'http://127.0.0.1:4173',
  ...(process.env.CORS_ORIGINS || '').split(',').map((origin) => origin.trim()).filter(Boolean),
]);

// Security & Parsing Middleware
app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.has(origin)) return callback(null, true);
    const error = new Error('Origin is not allowed by CORS.');
    error.status = 403;
    return callback(error);
  },
}));
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
  if (res.headersSent) return next(err);
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'Malformed JSON request body.' });
  }
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ error: 'Uploaded file exceeds the 10MB limit.' });
  }
  if (err.message === 'Origin is not allowed by CORS.') {
    return res.status(403).json({ error: 'Origin is not allowed.' });
  }
  const status = Number.isInteger(err.status) && err.status >= 400 && err.status < 500 ? err.status : 500;
  res.status(status).json({
    error: status === 500 ? 'Internal Server Error' : 'Request could not be processed.',
  });
});

// Start Server and Initialize Database
async function start() {
  await initDatabase();
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[BrandGuard AI Server] Listening on port ${PORT}`);
  });
}

// Only listen if not imported by test suite
if (process.env.NODE_ENV !== 'test') {
  start().catch((err) => {
    console.error(`[BrandGuard AI Server] Startup failed: ${err.message}`);
    process.exitCode = 1;
  });
}

export default app;

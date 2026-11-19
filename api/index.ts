import express from 'express';
import { apiRouter } from '../src/server/routes.ts';
import { initStorage, storage } from '../src/server/storage.ts';

const app = express();

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Initialize storage on Vercel serverless cold-start with retry capability
let initPromise: Promise<void> | null = null;
app.use(async (_req, _res, next) => {
  if (!storage.isPostgres()) {
    if (!initPromise) {
      initPromise = initStorage().finally(() => {
        initPromise = null;
      });
    }
    await initPromise;
  }
  next();
});

// Health check endpoint
app.get(['/api/health', '/health'], (_req, res) => {
  res.json({ status: 'ok', provider: 'vercel-serverless', db: storage.getDatabaseStatus(), timestamp: new Date().toISOString() });
});

// Mount API router on both /api and / so it works regardless of Vercel path rewrites
app.use('/api', apiRouter);
app.use('/', apiRouter);

export default app;

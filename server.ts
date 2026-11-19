import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { apiRouter } from './src/server/routes.ts';
import { initStorage } from './src/server/storage.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = process.env.PORT || 3000;

  // Initialize PostgreSQL / in-memory storage layer
  await initStorage();

  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ extended: true, limit: '50mb' }));

  // Mount API router
  app.use('/api', apiRouter);

  // Health check endpoint
  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', database: 'postgresql', timestamp: new Date().toISOString() });
  });

  // Setup Vite development server or static serving
  const distDir = path.resolve(__dirname, 'dist');
  const distHtmlPath = path.resolve(distDir, 'index.html');
  const hasDist = fs.existsSync(distHtmlPath);
  const isProd = process.env.NODE_ENV === 'production';

  if (isProd && hasDist) {
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      if (fs.existsSync(distHtmlPath)) {
        res.sendFile(distHtmlPath);
      } else {
        res.status(404).send('Not Found');
      }
    });
  } else {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);

    app.get('*', async (req, res, next) => {
      try {
        const rootHtmlPath = path.resolve(__dirname, 'index.html');
        if (fs.existsSync(rootHtmlPath)) {
          let template = fs.readFileSync(rootHtmlPath, 'utf-8');
          template = await vite.transformIndexHtml(req.originalUrl, template);
          return res.status(200).set({ 'Content-Type': 'text/html' }).end(template);
        }
        return next();
      } catch (e) {
        return next(e);
      }
    });
  }

  app.listen(Number(PORT), '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT} (PostgreSQL + Express)`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});

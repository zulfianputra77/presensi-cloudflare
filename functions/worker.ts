/**
 * Cloudflare Workers Entrypoint (Static Assets + API Router)
 * Digunakan saat deploy via Cloudflare Workers Builds (`npx wrangler deploy`),
 * meneruskan semua request `/api/*` ke `functions/api/[[path]].ts`
 * dan file statis SPA React (`dist/`) ke binding `ASSETS`.
 */

import { onRequest } from './api/[[path]].ts';
import type { PagesEnv } from './_lib/supabase.ts';

interface WorkerEnv extends PagesEnv {
  ASSETS?: {
    fetch(request: Request | string): Promise<Response>;
  };
}

export default {
  async fetch(request: Request, env: WorkerEnv): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === '/api' || url.pathname.startsWith('/api/')) {
      return onRequest({
        request,
        env,
        params: {},
      });
    }

    if (env.ASSETS) {
      return env.ASSETS.fetch(request);
    }

    return new Response('Not Found', { status: 404 });
  },
};

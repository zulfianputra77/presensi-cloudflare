import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema.ts';

declare global {
  var _postgresPool: Pool | undefined;
}

export const createPool = () => {
  if (!global._postgresPool) {
    const connectionString = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL;
    const host = process.env.SQL_HOST;
    const isSupabase = Boolean(connectionString?.includes('supabase') || host?.includes('supabase') || process.env.SQL_SSL === 'true');
    const ssl = isSupabase ? { rejectUnauthorized: false } : false;

    if (connectionString) {
      global._postgresPool = new Pool({
        connectionString,
        ssl,
        max: 10,
        connectionTimeoutMillis: 15000,
      });
    } else {
      global._postgresPool = new Pool({
        host: process.env.SQL_HOST,
        port: process.env.SQL_PORT ? parseInt(process.env.SQL_PORT) : 5432,
        user: process.env.SQL_USER,
        password: process.env.SQL_PASSWORD,
        database: process.env.SQL_DB_NAME,
        ssl,
        max: 10,
        connectionTimeoutMillis: 15000,
      });
    }

    global._postgresPool.on('error', (err) => {
      console.error('Unexpected error on idle SQL pool client:', err);
    });
  }
  return global._postgresPool;
};

let pool: Pool | undefined;
let db: any;

try {

  pool = createPool();
  db = drizzle(pool, { schema });
} catch {
  console.warn('[AI Studio] Database not connected — using mock');
  const noOp = {
    findMany: async () => [],
    findFirst: async () => null,
    findUnique: async () => null,
    create: async (d: any) => d?.data ?? {},
    update: async (d: any) => d?.data ?? {},
    delete: async () => ({})
  };
  db = new Proxy({}, {
    get: (_, prop) => prop === 'query'
      ? new Proxy({}, { get: () => noOp }) : async () => [],
  });
}

export { pool, db };


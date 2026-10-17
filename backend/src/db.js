import pg from 'pg';
import { config } from './config.js';

const { Pool } = pg;
export const pool = new Pool(config.databaseUrl ? { connectionString: config.databaseUrl } : {});

export async function initializeDatabase() {
  if (!config.databaseUrl) throw new Error('DATABASE_URL is missing. Copy backend/.env.example to backend/.env and configure PostgreSQL.');
  await pool.query(`
    CREATE EXTENSION IF NOT EXISTS "pgcrypto";
    CREATE TABLE IF NOT EXISTS users (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS analyses (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      filename TEXT NOT NULL,
      result JSONB NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS analyses_user_created_idx ON analyses(user_id, created_at DESC);
  `);
}

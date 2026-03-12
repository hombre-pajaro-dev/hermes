import { DatabaseSync } from 'node:sqlite';
import { applySchema } from './schema';

let db: DatabaseSync | null = null;

export function getDb(): DatabaseSync {
  if (!db) {
    const path = process.env.NODE_ENV === 'test'
      ? ':memory:'
      : (process.env.DB_PATH ?? (process.env.VERCEL ? '/tmp/hermes.db' : './hermes.db'));
    db = new DatabaseSync(path);
    applySchema(db);
  }
  return db;
}

export function resetDb(): void {
  if (db) {
    db.close();
    db = null;
  }
}

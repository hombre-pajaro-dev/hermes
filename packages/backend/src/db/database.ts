import Database from 'better-sqlite3';
import { applySchema } from './schema';

let db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!db) {
    const path = process.env.NODE_ENV === 'test' ? ':memory:' : './hermes.db';
    db = new Database(path);
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

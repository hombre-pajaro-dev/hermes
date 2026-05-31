import { World, IWorldOptions, setWorldConstructor } from '@cucumber/cucumber';
import supertest from 'supertest';
import { createApp } from '../../src/app';
import { getDb } from '../../src/db/database';

export class PosWorld extends World {
  agent: supertest.SuperTest<supertest.Test>;
  response!: supertest.Response;
  context: Record<string, unknown> = {};
  db!: Awaited<ReturnType<typeof getDb>>;

  constructor(options: IWorldOptions) {
    super(options);
    this.agent = supertest(createApp());
  }

  async getDb() {
    if (!this.db) this.db = await getDb();
    return this.db;
  }
}

setWorldConstructor(PosWorld);

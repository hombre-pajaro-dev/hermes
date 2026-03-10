import { World, IWorldOptions, setWorldConstructor } from '@cucumber/cucumber';
import supertest from 'supertest';
import { createApp } from '../../src/app';

export class PosWorld extends World {
  agent: supertest.SuperTest<supertest.Test>;
  response!: supertest.Response;
  context: Record<string, unknown> = {};

  constructor(options: IWorldOptions) {
    super(options);
    this.agent = supertest(createApp());
  }
}

setWorldConstructor(PosWorld);

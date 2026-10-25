import { afterEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import app from './index.js';
import { db, initDatabase } from './db.js';

const originalMongoUri = process.env.MONGODB_URI;
const originalRequireMongo = process.env.REQUIRE_MONGODB;

afterEach(() => {
  process.env.MONGODB_URI = originalMongoUri;
  process.env.REQUIRE_MONGODB = originalRequireMongo;
});

describe('production database requirements', () => {
  it('fails initialization instead of falling back when MongoDB is required but unconfigured', async () => {
    process.env.MONGODB_URI = '';
    process.env.REQUIRE_MONGODB = 'true';

    await expect(initDatabase()).rejects.toThrow('MONGODB_URI is not configured');
    expect(db.getMode()).toBe('uninitialized');
  });

  it('reports unhealthy while the required MongoDB connection is unavailable', async () => {
    process.env.MONGODB_URI = '';
    process.env.REQUIRE_MONGODB = 'true';

    const response = await request(app).get('/api/health');

    expect(response.status).toBe(503);
    expect(response.body).toMatchObject({
      status: 'unavailable',
      database: 'uninitialized',
    });
  });
});

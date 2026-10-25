import { afterAll } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

process.env.MONGODB_URI = '';
process.env.REQUIRE_MONGODB = 'false';

if (!process.env.BRANDGUARD_STORE_FILE) {
  const testDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'brandguard-vitest-'));
  const sourceStore = fileURLToPath(new URL('./server/data/brandguard_store.json', import.meta.url));
  const testStore = path.join(testDirectory, 'brandguard_store.json');
  if (fs.existsSync(sourceStore)) fs.copyFileSync(sourceStore, testStore);
  process.env.BRANDGUARD_STORE_FILE = testStore;
  afterAll(() => fs.rmSync(testDirectory, { recursive: true, force: true }));
}

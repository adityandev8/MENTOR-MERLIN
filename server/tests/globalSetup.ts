import { MongoMemoryReplSet } from 'mongodb-memory-server';

/**
 * One throw-away replica set for the whole run. Each test file uses its own database on it,
 * so files can run in parallel without seeing each other's data. Never touches a real DB.
 *
 * mongodb-memory-server downloads a mongod binary on first run (cached afterwards). To use an
 * existing binary instead, set MONGOMS_SYSTEM_BINARY=/path/to/mongod.
 */
let replSet: MongoMemoryReplSet | undefined;

export async function setup(): Promise<void> {
  replSet = await MongoMemoryReplSet.create({ replSet: { count: 1, storageEngine: 'wiredTiger' } });
  await replSet.waitUntilRunning();
  process.env.TEST_MONGO_URI = replSet.getUri();
}

export async function teardown(): Promise<void> {
  await replSet?.stop();
}

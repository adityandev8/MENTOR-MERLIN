/**
 * Zero-install local database for development: a single-node MongoDB replica set
 * (required for transactions) on 127.0.0.1:27017, with data persisted in ./.mongo-data.
 *
 * Uses mongodb-memory-server, which downloads a mongod binary on first run. If you already
 * have Docker or a local replica set, you don't need this — see README.
 */
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { MongoMemoryReplSet } from 'mongodb-memory-server';

const dbPath = resolve(process.cwd(), '.mongo-data');
mkdirSync(dbPath, { recursive: true });

const replSet = await MongoMemoryReplSet.create({
  replSet: { name: 'rs0', count: 1, storageEngine: 'wiredTiger' },
  instanceOpts: [{ port: 27017, dbPath }],
});
await replSet.waitUntilRunning();

console.log('MongoDB replica set running.');
console.log('MONGO_URI=mongodb://127.0.0.1:27017/hotel?replicaSet=rs0&directConnection=true');
console.log(`Data directory: ${dbPath}`);
console.log('Press Ctrl+C to stop.');

const stop = async (): Promise<void> => {
  await replSet.stop({ doCleanup: false });
  process.exit(0);
};
process.on('SIGINT', stop);
process.on('SIGTERM', stop);

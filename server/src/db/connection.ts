import mongoose from 'mongoose';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';

mongoose.set('strictQuery', true);

export async function connectDatabase(uri: string = env.MONGO_URI): Promise<typeof mongoose> {
  const conn = await mongoose.connect(uri, {
    maxPoolSize: env.MONGO_MAX_POOL_SIZE,
    serverSelectionTimeoutMS: 5_000,
    socketTimeoutMS: 30_000,
    // Indexes are created by `npm run db:indexes` (or on boot in dev/test). In production
    // building indexes from every API instance on start-up is avoided.
    autoIndex: env.NODE_ENV !== 'production',
    retryWrites: true,
  });
  logger.info({ db: conn.connection.name }, 'MongoDB connected');
  return conn;
}

export async function disconnectDatabase(): Promise<void> {
  await mongoose.disconnect();
}

export function isDatabaseReady(): boolean {
  return mongoose.connection.readyState === 1;
}

export async function pingDatabase(): Promise<boolean> {
  try {
    const db = mongoose.connection.db;
    if (!db) return false;
    await db.admin().command({ ping: 1 });
    return true;
  } catch {
    return false;
  }
}

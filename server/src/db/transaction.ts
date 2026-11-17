import mongoose, { type ClientSession } from 'mongoose';
import { AppError } from '../utils/AppError.js';
import { logger } from '../utils/logger.js';

export interface TransactionOptions {
  /** Total attempts including the first. Bounded so a hot spot can't pin a request forever. */
  maxAttempts?: number;
  /** Base for exponential backoff with full jitter (ms). */
  baseDelayMs?: number;
  label?: string;
}

interface MongoLikeError {
  code?: number;
  codeName?: string;
  keyPattern?: Record<string, unknown>;
  errorLabels?: string[] | Set<string>;
  hasErrorLabel?: (label: string) => boolean;
}

function hasLabel(err: MongoLikeError, label: string): boolean {
  if (typeof err.hasErrorLabel === 'function') return err.hasErrorLabel(label);
  const labels = err.errorLabels;
  if (!labels) return false;
  return Array.isArray(labels) ? labels.includes(label) : labels.has(label);
}

/**
 * Errors worth retrying the *whole* transaction for:
 *  - TransientTransactionError: write conflicts (another transaction touched the same
 *    room-night first), primary step-down, network blips.
 *  - WriteConflict (112) surfaced without the label by some driver paths.
 *  - Duplicate key on room_nights `_id`: two transactions lazily created the same night
 *    document; the retry will find it and take the normal update path.
 */
export function isRetryableTransactionError(error: unknown): boolean {
  if (!error || typeof error !== 'object' || error instanceof AppError) return false;
  const err = error as MongoLikeError;
  if (hasLabel(err, 'TransientTransactionError')) return true;
  if (err.code === 112 || err.codeName === 'WriteConflict') return true;
  const message = (error as { message?: unknown }).message;
  if (err.code === 11000 && typeof message === 'string' && message.includes('room_nights')) return true;
  return false;
}

function isUnknownCommitResult(error: unknown): boolean {
  return !!error && typeof error === 'object' && hasLabel(error as MongoLikeError, 'UnknownTransactionCommitResult');
}

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

/**
 * Runs `work` inside a MongoDB multi-document transaction with bounded, jittered retries.
 *
 * Why not `session.withTransaction()`? It retries transient errors for up to 120 s,
 * which under contention would hold HTTP requests far too long. Here we retry a few
 * times, then fail with a 503 BUSY_RETRY the client can safely retry (bookings are
 * idempotent via Idempotency-Key).
 *
 * `work` MUST pass `session` to every operation and MUST be safe to re-run from scratch.
 */
export async function runInTransaction<T>(
  work: (session: ClientSession) => Promise<T>,
  { maxAttempts = 5, baseDelayMs = 15, label = 'transaction' }: TransactionOptions = {},
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const session = await mongoose.startSession();
    try {
      session.startTransaction({
        readConcern: { level: 'snapshot' },
        writeConcern: { w: 'majority' },
        readPreference: 'primary',
      });
      const result = await work(session);
      await commitWithRetry(session);
      return result;
    } catch (error) {
      lastError = error;
      if (session.inTransaction()) {
        await session.abortTransaction().catch(() => undefined);
      }
      if (!isRetryableTransactionError(error) || attempt === maxAttempts) break;
      const delay = Math.random() * baseDelayMs * 2 ** (attempt - 1);
      logger.debug({ label, attempt, delay }, 'retrying transaction after transient error');
      await sleep(delay);
    } finally {
      await session.endSession();
    }
  }

  if (isRetryableTransactionError(lastError)) {
    logger.warn({ label, maxAttempts }, 'transaction gave up after repeated conflicts');
    throw new AppError(503, 'BUSY_RETRY', 'The system is busy processing other requests for these dates. Please retry.');
  }
  throw lastError;
}

async function commitWithRetry(session: ClientSession, attempts = 3): Promise<void> {
  for (let i = 1; ; i++) {
    try {
      await session.commitTransaction();
      return;
    } catch (error) {
      // Commit is idempotent for the same session/txnNumber: retrying is safe.
      if (isUnknownCommitResult(error) && i < attempts) continue;
      throw error;
    }
  }
}

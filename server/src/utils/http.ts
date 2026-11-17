import type { Response } from 'express';
import type { ApiSuccess, Paginated } from '@hotel/shared';

/** Single place that shapes successful responses so every endpoint is consistent. */
export function sendOk<T>(res: Response, data: T, status = 200): void {
  const body: ApiSuccess<T> = { success: true, data };
  res.status(status).json(body);
}

export function sendPage<T>(res: Response, page: Paginated<T>): void {
  const body: ApiSuccess<T[]> = { success: true, data: page.items, meta: page.meta };
  res.status(200).json(body);
}

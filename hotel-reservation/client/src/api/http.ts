import type { ApiResponse, ErrorCode, PaginationMeta } from '@hotel/shared';

/**
 * The one HTTP client the app uses. It unwraps the server's envelope, turns error
 * envelopes into typed ApiErrors and attaches the session token.
 */

const BASE = import.meta.env.VITE_API_BASE_URL ?? '';

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: ErrorCode | 'NETWORK_ERROR',
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }

  /** Field-level messages from a 400 VALIDATION_ERROR, keyed by field path. */
  fieldErrors(): Record<string, string> {
    if (!Array.isArray(this.details)) return {};
    const out: Record<string, string> = {};
    for (const d of this.details as { path?: unknown; message?: unknown }[]) {
      if (typeof d.path === 'string' && typeof d.message === 'string' && !out[d.path]) out[d.path] = d.message;
    }
    return out;
  }
}

type QueryValue = string | number | boolean | undefined | null;

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH';
  body?: unknown;
  query?: object;
  headers?: Record<string, string>;
  signal?: AbortSignal;
}

let tokenProvider: () => string | null = () => null;
let onUnauthenticated: () => void = () => undefined;

export function configureHttp(opts: { getToken: () => string | null; onUnauthenticated: () => void }): void {
  tokenProvider = opts.getToken;
  onUnauthenticated = opts.onUnauthenticated;
}

function buildUrl(path: string, query?: object): string {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries((query ?? {}) as Record<string, QueryValue>)) {
    if (v !== undefined && v !== null && v !== '') params.set(k, String(v));
  }
  const qs = params.toString();
  return `${BASE}/api${path}${qs ? `?${qs}` : ''}`;
}

async function send<T>(path: string, opts: RequestOptions): Promise<{ data: T; meta?: PaginationMeta }> {
  const token = tokenProvider();
  let res: Response;
  try {
    res = await fetch(buildUrl(path, opts.query), {
      method: opts.method ?? 'GET',
      headers: {
        Accept: 'application/json',
        ...(opts.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...opts.headers,
      },
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
      signal: opts.signal,
    });
  } catch (e) {
    if ((e as Error).name === 'AbortError') throw e;
    throw new ApiError(0, 'NETWORK_ERROR', 'Could not reach the server. Check your connection and try again.');
  }

  let payload: ApiResponse<T> | null = null;
  try {
    payload = (await res.json()) as ApiResponse<T>;
  } catch {
    // Non-JSON (e.g. a proxy error page).
  }
  if (!payload) throw new ApiError(res.status, 'INTERNAL_ERROR', `Unexpected response from server (${res.status})`);
  if (!payload.success) {
    if (res.status === 401 && token) onUnauthenticated();
    throw new ApiError(res.status, payload.error.code, payload.error.message, payload.error.details);
  }
  return { data: payload.data, meta: payload.meta };
}

export async function request<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  return (await send<T>(path, opts)).data;
}

export async function requestPage<T>(path: string, opts: RequestOptions = {}): Promise<{ items: T[]; meta: PaginationMeta }> {
  const { data, meta } = await send<T[]>(path, opts);
  if (!meta) throw new ApiError(500, 'INTERNAL_ERROR', 'Paginated response is missing metadata');
  return { items: data, meta };
}

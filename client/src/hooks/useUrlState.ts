import { useCallback } from 'react';
import { useSearchParams } from 'react-router';

/**
 * Filters and page number live in the URL, so a list can be refreshed, bookmarked or
 * shared and still show the same server page.
 */
export function useUrlState<K extends string>(keys: readonly K[]) {
  const [params, setParams] = useSearchParams();

  const values = Object.fromEntries(keys.map((k) => [k, params.get(k) ?? ''])) as Record<K, string>;
  const page = Math.max(1, Number(params.get('page')) || 1);

  const update = useCallback(
    (patch: Partial<Record<K | 'page', string | number | null>>) => {
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          for (const [k, v] of Object.entries(patch)) {
            if (v === null || v === undefined || v === '') next.delete(k);
            else next.set(k, String(v));
          }
          // Changing a filter always returns to the first page.
          if (!('page' in patch)) next.delete('page');
          return next;
        },
        { replace: true },
      );
    },
    [setParams],
  );

  return { values, page, update, setPage: (p: number) => update({ page: p } as Partial<Record<K | 'page', number>>) };
}

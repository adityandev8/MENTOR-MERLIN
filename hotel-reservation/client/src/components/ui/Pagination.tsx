import type { PaginationMeta } from '@hotel/shared';

/** Renders the page the server returned; it never slices data client-side. */
export function Pagination({ meta, onChange, busy }: { meta: PaginationMeta; onChange: (page: number) => void; busy?: boolean }) {
  if (meta.total === 0) return null;
  const from = (meta.page - 1) * meta.limit + 1;
  const to = Math.min(meta.total, meta.page * meta.limit);
  return (
    <nav className="pagination" aria-label="Pagination">
      <p className="pagination-summary">
        {from}–{to} of {meta.total}
      </p>
      <div className="pagination-controls">
        <button className="btn btn-secondary btn-sm" disabled={!meta.hasPrevPage || busy} onClick={() => onChange(meta.page - 1)}>
          Previous
        </button>
        <span aria-current="page">
          Page {meta.page} of {meta.totalPages}
        </span>
        <button className="btn btn-secondary btn-sm" disabled={!meta.hasNextPage || busy} onClick={() => onChange(meta.page + 1)}>
          Next
        </button>
      </div>
    </nav>
  );
}

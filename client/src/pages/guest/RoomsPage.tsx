import { RoomRow } from '../../components/RoomRow';
import { EmptyState, ErrorState, LoadingBlock } from '../../components/ui/Feedback';
import { Pagination } from '../../components/ui/Pagination';
import { SelectField } from '../../components/ui/Field';
import { useRoomTypes } from '../../hooks/queries';
import { useUrlState } from '../../hooks/useUrlState';
import type { RoomTypeSortField, SortOrder } from '@hotel/shared';

const SORTS: Record<string, { sortBy: RoomTypeSortField; sortOrder: SortOrder; label: string }> = {
  'price-asc': { sortBy: 'pricePerNight', sortOrder: 'asc', label: 'Price, lowest first' },
  'price-desc': { sortBy: 'pricePerNight', sortOrder: 'desc', label: 'Price, highest first' },
  'capacity-desc': { sortBy: 'capacity', sortOrder: 'desc', label: 'Sleeps most' },
};

export function RoomsPage() {
  const { values, page, update, setPage } = useUrlState(['sort'] as const);
  const sort = SORTS[values.sort] ?? SORTS['price-asc']!;
  const rooms = useRoomTypes({ page, limit: 6, sortBy: sort.sortBy, sortOrder: sort.sortOrder });

  return (
    <section className="section page-top">
      <div className="section-head">
        <h1>Rooms</h1>
        <div className="toolbar">
          <SelectField label="Sort" value={values.sort || 'price-asc'} onChange={(e) => update({ sort: e.target.value })}>
            {Object.entries(SORTS).map(([k, s]) => (
              <option key={k} value={k}>
                {s.label}
              </option>
            ))}
          </SelectField>
        </div>
      </div>
      {rooms.isPending ? (
        <LoadingBlock label="Loading rooms…" />
      ) : rooms.isError ? (
        <ErrorState error={rooms.error} onRetry={() => rooms.refetch()} />
      ) : rooms.data.items.length === 0 ? (
        <EmptyState title="No rooms are open for booking yet" />
      ) : (
        <>
          <div className={`room-list ${rooms.isPlaceholderData ? 'is-refreshing' : ''}`}>
            {rooms.data.items.map((r) => (
              <RoomRow key={r.id} room={r} to={`/rooms/${r.id}`} />
            ))}
          </div>
          <Pagination meta={rooms.data.meta} onChange={setPage} busy={rooms.isFetching} />
        </>
      )}
    </section>
  );
}

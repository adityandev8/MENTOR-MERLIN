import { useEffect, useState } from 'react';
import {
  RESERVATION_SORT_FIELDS,
  RESERVATION_STATUSES,
  RESERVATION_STATUS_LABELS,
  type ReservationListQuery,
  type ReservationSortField,
  type ReservationStatus,
} from '@hotel/shared';
import { useReservations, useRoomTypes } from '../../hooks/queries';
import { useUrlState } from '../../hooks/useUrlState';
import { EmptyState, ErrorState, LoadingBlock } from '../../components/ui/Feedback';
import { Pagination } from '../../components/ui/Pagination';
import { SelectField, TextField } from '../../components/ui/Field';
import { Button } from '../../components/ui/Button';
import { ReservationTable } from '../../components/ReservationTable';
import { isIsoDate } from '../../lib/format';

const FILTERS = ['status', 'q', 'roomTypeId', 'checkInFrom', 'checkInTo', 'stayDate', 'sortBy', 'sortOrder'] as const;
const SORT_LABELS: Record<ReservationSortField, string> = {
  createdAt: 'Booked date',
  checkIn: 'Check-in',
  checkOut: 'Check-out',
  totalAmount: 'Total',
};

function oneOf<T extends string>(list: readonly T[], v: string): T | undefined {
  return (list as readonly string[]).includes(v) ? (v as T) : undefined;
}

export function ReservationsPage() {
  const { values, page, update, setPage } = useUrlState(FILTERS);
  const roomTypes = useRoomTypes({ page: 1, limit: 50, includeInactive: true, sortBy: 'name', sortOrder: 'asc' });

  // Typed search box with a short debounce so we don't query on every keystroke.
  const [search, setSearch] = useState(values.q);
  useEffect(() => setSearch(values.q), [values.q]);
  useEffect(() => {
    const t = setTimeout(() => search !== values.q && update({ q: search.trim() || null }), 350);
    return () => clearTimeout(t);
  }, [search, values.q, update]);

  const query: ReservationListQuery = {
    page,
    limit: 10,
    status: oneOf<ReservationStatus>(RESERVATION_STATUSES, values.status),
    q: values.q || undefined,
    roomTypeId: values.roomTypeId || undefined,
    checkInFrom: isIsoDate(values.checkInFrom) ? values.checkInFrom : undefined,
    checkInTo: isIsoDate(values.checkInTo) ? values.checkInTo : undefined,
    stayDate: isIsoDate(values.stayDate) ? values.stayDate : undefined,
    sortBy: oneOf(RESERVATION_SORT_FIELDS, values.sortBy) ?? 'createdAt',
    sortOrder: values.sortOrder === 'asc' ? 'asc' : 'desc',
  };
  const list = useReservations(query);
  const hasFilters = FILTERS.some((k) => k !== 'sortBy' && k !== 'sortOrder' && values[k]);

  return (
    <section className="staff-page">
      <header className="staff-head">
        <h1>Reservations</h1>
        {list.data && <p className="muted">{list.data.meta.total} matching</p>}
      </header>

      <div className="filters" role="search">
        <TextField label="Reference or guest email" placeholder="HTL-2611 or name@" value={search} onChange={(e) => setSearch(e.target.value)} />
        <SelectField label="Status" value={values.status} onChange={(e) => update({ status: e.target.value || null })}>
          <option value="">Any status</option>
          {RESERVATION_STATUSES.map((s) => (
            <option key={s} value={s}>
              {RESERVATION_STATUS_LABELS[s]}
            </option>
          ))}
        </SelectField>
        <SelectField label="Room type" value={values.roomTypeId} onChange={(e) => update({ roomTypeId: e.target.value || null })}>
          <option value="">Any room type</option>
          {roomTypes.data?.items.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </SelectField>
        <TextField label="Check-in from" type="date" value={values.checkInFrom} onChange={(e) => update({ checkInFrom: e.target.value || null })} />
        <TextField label="Check-in to" type="date" value={values.checkInTo} onChange={(e) => update({ checkInTo: e.target.value || null })} />
        <TextField label="Staying on" type="date" value={values.stayDate} onChange={(e) => update({ stayDate: e.target.value || null })} />
        <SelectField
          label="Sort by"
          value={`${query.sortBy}:${query.sortOrder}`}
          onChange={(e) => {
            const [sortBy, sortOrder] = e.target.value.split(':');
            update({ sortBy: sortBy ?? null, sortOrder: sortOrder ?? null });
          }}
        >
          {RESERVATION_SORT_FIELDS.flatMap((f) => [
            <option key={`${f}:desc`} value={`${f}:desc`}>
              {SORT_LABELS[f]}, newest/highest first
            </option>,
            <option key={`${f}:asc`} value={`${f}:asc`}>
              {SORT_LABELS[f]}, oldest/lowest first
            </option>,
          ])}
        </SelectField>
        {hasFilters && (
          <Button
            variant="quiet"
            size="sm"
            onClick={() => {
              setSearch('');
              update({ status: null, q: null, roomTypeId: null, checkInFrom: null, checkInTo: null, stayDate: null });
            }}
          >
            Clear filters
          </Button>
        )}
      </div>

      {list.isPending ? (
        <LoadingBlock label="Loading reservations…" />
      ) : list.isError ? (
        <ErrorState error={list.error} onRetry={() => list.refetch()} />
      ) : list.data.items.length === 0 ? (
        <EmptyState title={hasFilters ? 'No reservations match these filters' : 'No reservations yet'}>
          {hasFilters ? 'Widen the date range or clear a filter.' : 'New bookings will appear here.'}
        </EmptyState>
      ) : (
        <>
          <ReservationTable rows={list.data.items} linkBase="/staff/reservations" actions={['CONFIRM', 'CHECK_IN', 'CHECK_OUT', 'CANCEL']} dim={list.isPlaceholderData} />
          <Pagination meta={list.data.meta} onChange={setPage} busy={list.isFetching} />
        </>
      )}
    </section>
  );
}

import { Link } from 'react-router';
import { RESERVATION_STATUSES, RESERVATION_STATUS_LABELS, type ReservationStatus } from '@hotel/shared';
import { useReservations } from '../../hooks/queries';
import { useUrlState } from '../../hooks/useUrlState';
import { EmptyState, ErrorState, LoadingBlock } from '../../components/ui/Feedback';
import { ButtonLink } from '../../components/ui/Button';
import { Pagination } from '../../components/ui/Pagination';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { ReservationActions } from '../../components/ReservationActions';
import { formatDate, formatMoney, plural } from '../../lib/format';

export function MyReservationsPage() {
  const { values, page, update, setPage } = useUrlState(['status'] as const);
  const status = (RESERVATION_STATUSES as readonly string[]).includes(values.status) ? (values.status as ReservationStatus) : undefined;
  const list = useReservations({ page, limit: 5, status, sortBy: 'createdAt', sortOrder: 'desc' });

  return (
    <section className="section page-top">
      <div className="section-head">
        <h1>My reservations</h1>
        <div className="chips" role="group" aria-label="Filter by status">
          <button className={!status ? 'chip is-on' : 'chip'} onClick={() => update({ status: null })}>
            All
          </button>
          {RESERVATION_STATUSES.map((s) => (
            <button key={s} className={status === s ? 'chip is-on' : 'chip'} onClick={() => update({ status: s })}>
              {RESERVATION_STATUS_LABELS[s]}
            </button>
          ))}
        </div>
      </div>

      {list.isPending ? (
        <LoadingBlock label="Loading your reservations…" />
      ) : list.isError ? (
        <ErrorState error={list.error} onRetry={() => list.refetch()} />
      ) : list.data.items.length === 0 ? (
        status ? (
          <EmptyState title={`No ${RESERVATION_STATUS_LABELS[status].toLowerCase()} reservations`} />
        ) : (
          <EmptyState title="No reservations yet" action={<ButtonLink to="/search">Find a room</ButtonLink>}>
            When you book a stay it will appear here.
          </EmptyState>
        )
      ) : (
        <>
          <ul className={`stay-list ${list.isPlaceholderData ? 'is-refreshing' : ''}`}>
            {list.data.items.map((r) => (
              <li key={r.id} className="stay-item">
                <div className="stay-item-dates">
                  <span>{formatDate(r.checkIn)}</span>
                  <span className="muted">to {formatDate(r.checkOut)}</span>
                </div>
                <div className="stay-item-main">
                  <Link to={`/my-reservations/${r.id}`} className="stay-item-title">
                    {r.roomType.name}
                  </Link>
                  <span className="muted">
                    {r.reference}, {plural(r.nights, 'night')}, {plural(r.guests, 'guest')}
                  </span>
                </div>
                <div className="stay-item-side">
                  <StatusBadge status={r.status} />
                  <span className="price-sm">{formatMoney(r.totalAmount, r.currency)}</span>
                  <ReservationActions reservation={r} />
                </div>
              </li>
            ))}
          </ul>
          <Pagination meta={list.data.meta} onChange={setPage} busy={list.isFetching} />
        </>
      )}
    </section>
  );
}

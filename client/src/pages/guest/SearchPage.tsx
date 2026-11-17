import { useNavigate } from 'react-router';
import { StaySentence, defaultStay, type StayValues } from '../../components/StaySentence';
import { RoomRow } from '../../components/RoomRow';
import { EmptyState, ErrorState, LoadingBlock } from '../../components/ui/Feedback';
import { ButtonLink } from '../../components/ui/Button';
import { Pagination } from '../../components/ui/Pagination';
import { useAvailability } from '../../hooks/queries';
import { useUrlState } from '../../hooks/useUrlState';
import { formatDate, formatMoney, isIsoDate, plural } from '../../lib/format';
import { toStayQuery } from './HomePage';

export function readStay(values: Record<'checkIn' | 'checkOut' | 'guests' | 'rooms', string>): StayValues | null {
  const guests = Number(values.guests);
  const rooms = Number(values.rooms || 1);
  if (!isIsoDate(values.checkIn) || !isIsoDate(values.checkOut) || !(guests > 0) || !(rooms > 0)) return null;
  return { checkIn: values.checkIn, checkOut: values.checkOut, guests, rooms };
}

export function SearchPage() {
  const navigate = useNavigate();
  const { values, page, setPage } = useUrlState(['checkIn', 'checkOut', 'guests', 'rooms'] as const);
  const stay = readStay(values);
  const results = useAvailability(stay ? { ...stay, page, limit: 5 } : null);

  return (
    <section className="section page-top">
      <h1>Availability</h1>
      <StaySentence
        key={stay ? toStayQuery(stay) : 'empty'}
        compact
        initial={stay ?? defaultStay()}
        submitLabel="Search"
        onSubmit={(v) => navigate(`/search?${toStayQuery(v)}`, { replace: true })}
      />

      {!stay ? (
        <EmptyState title="Choose your dates">Pick check-in and check-out dates to see which rooms are free for the whole stay.</EmptyState>
      ) : results.isPending ? (
        <LoadingBlock label="Checking every night of your stay…" />
      ) : results.isError ? (
        <ErrorState error={results.error} title="We couldn’t search those dates" />
      ) : results.data.items.length === 0 ? (
        <EmptyState title={`No room types fit ${plural(stay.guests, 'guest')} in ${plural(stay.rooms, 'room')}`}>
          Try adding a room, or contact the hotel for larger groups.
        </EmptyState>
      ) : (
        <>
          <p className="results-summary">
            {formatDate(stay.checkIn)} to {formatDate(stay.checkOut)}, {plural(results.data.items[0]!.nights, 'night')}
          </p>
          <div className={`room-list ${results.isPlaceholderData ? 'is-refreshing' : ''}`}>
            {results.data.items.map((item) => {
              const to = `/rooms/${item.roomType.id}?${toStayQuery(stay)}`;
              return (
                <RoomRow
                  key={item.roomType.id}
                  room={item.roomType}
                  to={to}
                  aside={
                    <>
                      <p className="price">
                        {formatMoney(item.totalPrice, item.roomType.currency)}
                        <span> total</span>
                      </p>
                      {item.isAvailable ? (
                        <>
                          <p className={item.availableRooms <= 2 ? 'avail avail-low' : 'avail'}>
                            {item.availableRooms <= 2 ? `Only ${plural(item.availableRooms, 'room')} left` : 'Available'}
                          </p>
                          <ButtonLink to={to} size="sm">
                            Reserve
                          </ButtonLink>
                        </>
                      ) : (
                        <p className="avail avail-none">
                          {item.availableRooms === 0 ? 'Sold out for these dates' : `Only ${plural(item.availableRooms, 'room')} left`}
                        </p>
                      )}
                    </>
                  }
                />
              );
            })}
          </div>
          <Pagination meta={results.data.meta} onChange={setPage} busy={results.isFetching} />
        </>
      )}
    </section>
  );
}

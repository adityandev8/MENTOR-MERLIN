import { useMemo } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { RoomImage } from '../../components/RoomImage';
import { StaySentence, defaultStay } from '../../components/StaySentence';
import { Alert, ErrorState, LoadingBlock, errorMessage } from '../../components/ui/Feedback';
import { Button } from '../../components/ui/Button';
import { useCreateReservation, useQuote, useRoomType } from '../../hooks/queries';
import { useUrlState } from '../../hooks/useUrlState';
import { useAuth } from '../../auth/AuthContext';
import { formatDate, formatMoney, plural } from '../../lib/format';
import { ApiError } from '../../api/http';
import { readStay } from './SearchPage';
import { toStayQuery } from './HomePage';

export function RoomDetailPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const { user, isStaff } = useAuth();
  const { values, update } = useUrlState(['checkIn', 'checkOut', 'guests', 'rooms'] as const);
  const stay = readStay(values);

  const room = useRoomType(id);
  const quote = useQuote(id, stay);
  const book = useCreateReservation();

  // One key per stay selection: double-clicks and retries of the same booking are deduplicated
  // by the server instead of creating two reservations.
  const idempotencyKey = useMemo(() => crypto.randomUUID(), [id, stay?.checkIn, stay?.checkOut, stay?.guests, stay?.rooms]);

  if (room.isPending) return <LoadingBlock label="Loading room…" />;
  if (room.isError) return <ErrorState error={room.error} title="Room not found" />;
  const rt = room.data;

  const reserve = () => {
    if (!stay) return;
    if (!user) {
      navigate(`/login?next=${encodeURIComponent(`/rooms/${id}?${toStayQuery(stay)}`)}`);
      return;
    }
    book.mutate(
      { input: { roomTypeId: id, ...stay }, idempotencyKey },
      { onSuccess: (r) => navigate(`/my-reservations/${r.id}`, { state: { justBooked: true } }) },
    );
  };

  return (
    <article className="room-detail page-top">
      <Link to={stay ? `/search?${toStayQuery(stay)}` : '/rooms'} className="back">
        Back to {stay ? 'results' : 'rooms'}
      </Link>
      <div className="room-detail-grid">
        <div>
          <RoomImage name={rt.name} imageUrl={rt.imageUrl} className="room-detail-image" />
          <h1>{rt.name}</h1>
          <p className="room-detail-desc">{rt.description}</p>
          <h2 className="small-h">In the room</h2>
          <ul className="facility-list">
            <li>Sleeps {rt.capacity}</li>
            {rt.facilities.map((f) => (
              <li key={f}>{f}</li>
            ))}
          </ul>
        </div>

        <aside className="booking-panel" aria-labelledby="book-h">
          <h2 id="book-h">
            {formatMoney(rt.pricePerNight, rt.currency)} <span className="muted">a night</span>
          </h2>
          <StaySentence
            key={stay ? toStayQuery(stay) : 'none'}
            compact
            initial={stay ?? defaultStay()}
            submitLabel="Update price"
            onSubmit={(v) => update({ checkIn: v.checkIn, checkOut: v.checkOut, guests: v.guests, rooms: v.rooms })}
          />

          {!stay ? (
            <p className="muted">Choose dates to see the total for your stay.</p>
          ) : quote.isPending ? (
            <LoadingBlock label="Calculating your price…" />
          ) : quote.isError ? (
            <Alert tone="error" title="These dates can’t be booked">
              {errorMessage(quote.error)}
            </Alert>
          ) : (
            <>
              <dl className="quote">
                <div>
                  <dt>Dates</dt>
                  <dd>
                    {formatDate(quote.data.checkIn)} – {formatDate(quote.data.checkOut)}
                  </dd>
                </div>
                <div>
                  <dt>Length</dt>
                  <dd>{plural(quote.data.nights, 'night')}</dd>
                </div>
                <div>
                  <dt>Party</dt>
                  <dd>
                    {plural(quote.data.guests, 'guest')}, {plural(quote.data.rooms, 'room')}
                  </dd>
                </div>
                <div className="quote-total">
                  <dt>Total</dt>
                  <dd>{formatMoney(quote.data.totalPrice, quote.data.currency)}</dd>
                </div>
              </dl>

              {book.isError && (
                <Alert tone="error" title={book.error instanceof ApiError && book.error.code === 'NO_AVAILABILITY' ? 'Someone just took the last room' : 'Reservation not made'}>
                  {errorMessage(book.error)}
                </Alert>
              )}

              {!quote.data.isAvailable ? (
                <Alert tone="warning">{quote.data.unavailableReason}</Alert>
              ) : isStaff ? (
                <Alert tone="info">Staff accounts can’t make guest reservations. Sign in as a guest to book.</Alert>
              ) : (
                <Button className="btn-block" onClick={reserve} busy={book.isPending}>
                  {user ? `Reserve for ${formatMoney(quote.data.totalPrice, quote.data.currency)}` : 'Sign in to reserve'}
                </Button>
              )}
              <p className="fine-print">Your rooms are held as soon as you reserve. The hotel confirms within a few hours.</p>
            </>
          )}
        </aside>
      </div>
    </article>
  );
}

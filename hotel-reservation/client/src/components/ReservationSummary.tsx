import { RESERVATION_STATUS_LABELS, type ReservationDTO } from '@hotel/shared';
import { formatDateTime, formatDateYear, formatMoney, plural } from '../lib/format';
import { StatusBadge } from './ui/StatusBadge';
import { ReservationActions } from './ReservationActions';

/** Full reservation view shared by the guest and staff detail pages. */
export function ReservationSummary({ reservation: r, showGuest }: { reservation: ReservationDTO; showGuest: boolean }) {
  return (
    <div className="summary">
      <header className="summary-head">
        <div>
          <p className="ref">{r.reference}</p>
          <h1>{r.roomType.name}</h1>
        </div>
        <StatusBadge status={r.status} />
      </header>

      <dl className="facts">
        <div>
          <dt>Check-in</dt>
          <dd>{formatDateYear(r.checkIn)}</dd>
        </div>
        <div>
          <dt>Check-out</dt>
          <dd>{formatDateYear(r.checkOut)}</dd>
        </div>
        <div>
          <dt>Party</dt>
          <dd>
            {plural(r.guests, 'guest')} in {plural(r.roomCount, 'room')}
          </dd>
        </div>
        {showGuest && (
          <div>
            <dt>Guest</dt>
            <dd>
              {r.guest.name}
              <span className="cell-sub">{r.guest.email}</span>
            </dd>
          </div>
        )}
      </dl>

      <div className="bill">
        <p>
          {formatMoney(r.pricePerNight, r.currency)} × {plural(r.nights, 'night')} × {plural(r.roomCount, 'room')}
        </p>
        <p className="bill-total">{formatMoney(r.totalAmount, r.currency)}</p>
      </div>

      <ReservationActions reservation={r} size="md" />

      <section className="history" aria-labelledby="history-h">
        <h2 id="history-h">History</h2>
        <ol>
          {r.statusHistory.map((h, i) => (
            <li key={i}>
              <span className="history-status">{RESERVATION_STATUS_LABELS[h.status]}</span>
              <span className="muted">
                {formatDateTime(h.at)} by {h.byRole === 'GUEST' ? 'guest' : h.byRole === 'SYSTEM' ? 'system' : 'staff'}
              </span>
              {h.note && <span className="history-note">{h.note}</span>}
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}

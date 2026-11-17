import { Link } from 'react-router';
import type { ReservationAction, ReservationDTO } from '@hotel/shared';
import { formatDate, formatMoney, plural } from '../lib/format';
import { StatusBadge } from './ui/StatusBadge';
import { ReservationActions } from './ReservationActions';

/** Staff table. Rows are exactly the server page; actions come from each row's allowedActions. */
export function ReservationTable({
  rows,
  linkBase,
  actions,
  dim,
}: {
  rows: ReservationDTO[];
  linkBase: string;
  actions?: ReservationAction[];
  dim?: boolean;
}) {
  return (
    <div className={`table-wrap ${dim ? 'is-refreshing' : ''}`}>
      <table className="table">
        <thead>
          <tr>
            <th scope="col">Reference</th>
            <th scope="col">Guest</th>
            <th scope="col">Room</th>
            <th scope="col">Stay</th>
            <th scope="col" className="num">
              Total
            </th>
            <th scope="col">Status</th>
            {actions && <th scope="col">Actions</th>}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id}>
              <td>
                <Link to={`${linkBase}/${r.id}`} className="ref">
                  {r.reference}
                </Link>
              </td>
              <td>
                <span className="cell-main">{r.guest.name}</span>
                <span className="cell-sub">{r.guest.email}</span>
              </td>
              <td>
                <span className="cell-main">{r.roomType.name}</span>
                <span className="cell-sub">
                  {plural(r.roomCount, 'room')}, {plural(r.guests, 'guest')}
                </span>
              </td>
              <td>
                <span className="cell-main nowrap">{formatDate(r.checkIn)} –</span>
                <span className="cell-main nowrap">{formatDate(r.checkOut)}</span>
                <span className="cell-sub">{plural(r.nights, 'night')}</span>
              </td>
              <td className="num">{formatMoney(r.totalAmount, r.currency)}</td>
              <td>
                <StatusBadge status={r.status} />
              </td>
              {actions && (
                <td>
                  <ReservationActions reservation={r} only={actions} />
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

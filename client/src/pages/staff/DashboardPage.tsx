import { Link } from 'react-router';
import { useDashboard } from '../../hooks/queries';
import { ErrorState, LoadingBlock } from '../../components/ui/Feedback';
import { formatDateYear } from '../../lib/format';

export function DashboardPage() {
  const q = useDashboard();
  if (q.isPending) return <LoadingBlock label="Loading today…" />;
  if (q.isError) return <ErrorState error={q.error} onRetry={() => q.refetch()} />;
  const d = q.data;

  return (
    <section className="staff-page">
      <header className="staff-head">
        <h1>Today</h1>
        <p className="muted">{formatDateYear(d.date)}, hotel time</p>
      </header>

      <div className="occupancy" aria-label={`Occupancy ${d.occupancyRate}%`}>
        <div className="occupancy-figures">
          <p className="occupancy-big">
            {d.occupiedRooms}
            <span> of {d.totalRooms} rooms occupied</span>
          </p>
          <p className="muted">{d.occupancyRate}% occupancy across {d.activeRoomTypes} open room types</p>
        </div>
        <div className="occupancy-bar" role="presentation">
          <span style={{ width: `${Math.min(100, d.occupancyRate)}%` }} />
        </div>
      </div>

      <div className="tally">
        <Link to="/staff/front-desk?view=arrivals" className="tally-item">
          <span className="tally-n">{d.arrivalsToday}</span>
          <span className="tally-label">Arriving today</span>
          <span className="tally-sub">{d.arrivalsPendingCheckIn} still to check in</span>
        </Link>
        <Link to="/staff/front-desk?view=departures" className="tally-item">
          <span className="tally-n">{d.departuresToday}</span>
          <span className="tally-label">Due to depart</span>
          <span className="tally-sub">Checked in, check-out today or earlier</span>
        </Link>
        <Link to="/staff/front-desk?view=in-house" className="tally-item">
          <span className="tally-n">{d.inHouseReservations}</span>
          <span className="tally-label">In-house reservations</span>
          <span className="tally-sub">{d.occupiedRooms} rooms</span>
        </Link>
        <Link to="/staff/reservations?status=PENDING" className="tally-item tally-attention">
          <span className="tally-n">{d.pendingReservations}</span>
          <span className="tally-label">Awaiting confirmation</span>
          <span className="tally-sub">Rooms are held until you confirm or cancel</span>
        </Link>
      </div>
    </section>
  );
}

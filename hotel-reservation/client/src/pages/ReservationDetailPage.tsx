import { Link, useLocation, useParams } from 'react-router';
import { useReservation } from '../hooks/queries';
import { Alert, ErrorState, LoadingBlock } from '../components/ui/Feedback';
import { ReservationSummary } from '../components/ReservationSummary';

/** Used by both guests (/my-reservations/:id) and staff (/staff/reservations/:id). */
export function ReservationDetailPage({ staff = false }: { staff?: boolean }) {
  const { id = '' } = useParams();
  const location = useLocation();
  const justBooked = (location.state as { justBooked?: boolean } | null)?.justBooked === true;
  const q = useReservation(id);

  return (
    <section className={staff ? 'staff-page' : 'section page-top narrow'}>
      <Link to={staff ? '/staff/reservations' : '/my-reservations'} className="back">
        All reservations
      </Link>
      {justBooked && (
        <Alert tone="success" title="Reservation received">
          Your rooms are held. You’ll see the status change here once the hotel confirms.
        </Alert>
      )}
      {q.isPending ? (
        <LoadingBlock label="Loading reservation…" />
      ) : q.isError ? (
        <ErrorState error={q.error} title="Reservation not found" />
      ) : (
        <ReservationSummary reservation={q.data} showGuest={staff} />
      )}
    </section>
  );
}

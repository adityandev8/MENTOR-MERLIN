import { RESERVATION_STATUS_LABELS, type ReservationStatus } from '@hotel/shared';

export function StatusBadge({ status }: { status: ReservationStatus }) {
  return <span className={`badge badge-${status.toLowerCase().replace('_', '-')}`}>{RESERVATION_STATUS_LABELS[status]}</span>;
}

import { useState } from 'react';
import { RESERVATION_ACTION_LABELS, type ReservationAction, type ReservationDTO } from '@hotel/shared';
import { useReservationAction } from '../hooks/queries';
import { Button } from './ui/Button';
import { errorMessage } from './ui/Feedback';

const VARIANT: Record<ReservationAction, 'primary' | 'secondary' | 'danger'> = {
  CONFIRM: 'primary',
  CHECK_IN: 'primary',
  CHECK_OUT: 'primary',
  CANCEL: 'danger',
};

const DONE: Record<ReservationAction, string> = {
  CONFIRM: 'Reservation confirmed',
  CANCEL: 'Reservation cancelled',
  CHECK_IN: 'Guest checked in',
  CHECK_OUT: 'Guest checked out',
};

/**
 * Renders exactly the actions the server says this viewer may take (`allowedActions`).
 * The component has no lifecycle rules of its own.
 */
export function ReservationActions({
  reservation,
  size = 'sm',
  only,
}: {
  reservation: ReservationDTO;
  size?: 'sm' | 'md';
  only?: ReservationAction[];
}) {
  const mutation = useReservationAction();
  const [pending, setPending] = useState<ReservationAction | null>(null);
  const [message, setMessage] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);

  // Forward actions first, cancellation last, so the primary next step is always leftmost.
  const actions = reservation.allowedActions
    .filter((a) => !only || only.includes(a))
    .sort((a, b) => Number(a === 'CANCEL') - Number(b === 'CANCEL'));
  if (actions.length === 0 && !message) return null;

  const run = (action: ReservationAction) => {
    if (action === 'CANCEL' && !window.confirm(`Cancel reservation ${reservation.reference}? This releases the room.`)) return;
    setPending(action);
    setMessage(null);
    mutation.mutate(
      { id: reservation.id, input: { action } },
      {
        onSuccess: () => setMessage({ tone: 'success', text: DONE[action] }),
        onError: (e) => setMessage({ tone: 'error', text: errorMessage(e) }),
        onSettled: () => setPending(null),
      },
    );
  };

  return (
    <div className="actions">
      {actions.map((a) => (
        <Button key={a} size={size} variant={VARIANT[a]} busy={pending === a} disabled={pending !== null} onClick={() => run(a)}>
          {a === 'CANCEL' && size === 'md' ? 'Cancel reservation' : RESERVATION_ACTION_LABELS[a]}
        </Button>
      ))}
      {message && (
        <span className={`action-msg action-msg-${message.tone}`} role={message.tone === 'error' ? 'alert' : 'status'}>
          {message.text}
        </span>
      )}
    </div>
  );
}

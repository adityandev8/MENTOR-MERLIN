import { useState, type FormEvent } from 'react';
import { addDaysIso, localToday } from '../lib/format';

export interface StayValues {
  checkIn: string;
  checkOut: string;
  guests: number;
  rooms: number;
}

export function defaultStay(): StayValues {
  const t = localToday();
  return { checkIn: addDaysIso(t, 1), checkOut: addDaysIso(t, 3), guests: 2, rooms: 1 };
}

/**
 * The stay search, written as a sentence. Validation here is only to keep the form
 * sensible while typing (e.g. check-out follows check-in); the server re-validates.
 */
export function StaySentence({
  initial,
  onSubmit,
  submitLabel = 'Check availability',
  compact = false,
}: {
  initial: StayValues;
  onSubmit: (v: StayValues) => void;
  submitLabel?: string;
  compact?: boolean;
}) {
  const [v, setV] = useState<StayValues>(initial);
  const today = localToday();

  const setCheckIn = (checkIn: string) =>
    setV((prev) => ({ ...prev, checkIn, checkOut: prev.checkOut <= checkIn ? addDaysIso(checkIn, 1) : prev.checkOut }));

  const submit = (e: FormEvent) => {
    e.preventDefault();
    onSubmit(v);
  };

  return (
    <form className={`stay-sentence ${compact ? 'stay-sentence-compact' : ''}`} onSubmit={submit} aria-label="Search for a stay">
      <p className="stay-words">
        <span>Stay from</span>
        <label>
          <span className="sr-only">Check-in date</span>
          <input type="date" required min={today} value={v.checkIn} onChange={(e) => setCheckIn(e.target.value)} />
        </label>
        <span>to</span>
        <label>
          <span className="sr-only">Check-out date</span>
          <input type="date" required min={v.checkIn ? addDaysIso(v.checkIn, 1) : today} value={v.checkOut} onChange={(e) => setV({ ...v, checkOut: e.target.value })} />
        </label>
        <span>with</span>
        <label>
          <span className="sr-only">Guests</span>
          <select value={v.guests} onChange={(e) => setV({ ...v, guests: Number(e.target.value), rooms: Math.min(v.rooms, Number(e.target.value)) })}>
            {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
              <option key={n} value={n}>
                {n} {n === 1 ? 'guest' : 'guests'}
              </option>
            ))}
          </select>
        </label>
        <span>in</span>
        <label>
          <span className="sr-only">Rooms</span>
          <select value={v.rooms} onChange={(e) => setV({ ...v, rooms: Number(e.target.value) })}>
            {Array.from({ length: 5 }, (_, i) => i + 1)
              .filter((n) => n <= v.guests)
              .map((n) => (
                <option key={n} value={n}>
                  {n} {n === 1 ? 'room' : 'rooms'}
                </option>
              ))}
          </select>
        </label>
      </p>
      <button type="submit" className="btn btn-primary">
        {submitLabel}
      </button>
    </form>
  );
}

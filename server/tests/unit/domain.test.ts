import { describe, expect, it } from 'vitest';
import { calculateStayPrice } from '../../src/domain/pricing.js';
import { addDays, eachNight, isValidIsoDate, nightsBetween, todayInTimeZone } from '../../src/domain/dates.js';
import { validateStay } from '../../src/domain/stay.js';
import { allowedActions, evaluateAction, type Actor, type LifecycleSubject } from '../../src/domain/lifecycle.js';
import { AppError } from '../../src/utils/AppError.js';

describe('pricing', () => {
  it('multiplies price snapshot × nights × rooms exactly', () => {
    expect(calculateStayPrice({ pricePerNight: 4500, nights: 3, rooms: 2 })).toBe(27_000);
  });
  it('rejects non-integer or negative inputs', () => {
    expect(() => calculateStayPrice({ pricePerNight: 99.5, nights: 1, rooms: 1 })).toThrow(RangeError);
    expect(() => calculateStayPrice({ pricePerNight: 100, nights: -1, rooms: 1 })).toThrow(RangeError);
  });
});

describe('dates', () => {
  it('validates real calendar dates only', () => {
    expect(isValidIsoDate('2026-02-28')).toBe(true);
    expect(isValidIsoDate('2026-02-30')).toBe(false);
    expect(isValidIsoDate('26-1-1')).toBe(false);
  });
  it('counts nights and lists each night (check-out exclusive)', () => {
    expect(nightsBetween('2026-12-30', '2027-01-02')).toBe(3);
    expect(eachNight('2026-12-30', '2027-01-02')).toEqual(['2026-12-30', '2026-12-31', '2027-01-01']);
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
  });
  it('computes "today" in the hotel time zone, not the server zone', () => {
    const instant = new Date('2026-11-03T20:00:00Z'); // 01:30 on Nov 4 in India
    expect(todayInTimeZone('Asia/Kolkata', instant)).toBe('2026-11-04');
    expect(todayInTimeZone('America/New_York', instant)).toBe('2026-11-03');
  });
});

describe('stay validation', () => {
  const rules = { today: '2026-11-03', maxStayNights: 30, bookingWindowDays: 365 };
  const code = (fn: () => unknown): string | undefined => {
    try {
      fn();
    } catch (e) {
      return e instanceof AppError ? e.code : 'other';
    }
    return undefined;
  };

  it('accepts a same-day check-in', () => {
    expect(validateStay('2026-11-03', '2026-11-05', rules)).toEqual({ checkIn: '2026-11-03', checkOut: '2026-11-05', nights: 2 });
  });
  it('rejects past check-in, check-out not after check-in, too-long and too-far stays', () => {
    expect(code(() => validateStay('2026-11-02', '2026-11-05', rules))).toBe('INVALID_DATES');
    expect(code(() => validateStay('2026-11-05', '2026-11-05', rules))).toBe('INVALID_DATES');
    expect(code(() => validateStay('2026-11-05', '2026-11-04', rules))).toBe('INVALID_DATES');
    expect(code(() => validateStay('2026-11-05', '2026-12-15', rules))).toBe('INVALID_DATES');
    expect(code(() => validateStay('2027-11-01', '2027-11-05', rules))).toBe('INVALID_DATES');
  });
});

describe('reservation lifecycle', () => {
  const guest: Actor = { userId: 'guest-1', role: 'GUEST' };
  const otherGuest: Actor = { userId: 'guest-2', role: 'GUEST' };
  const staff: Actor = { userId: 'staff-1', role: 'STAFF' };
  const base: LifecycleSubject = { status: 'PENDING', guestId: 'guest-1', checkIn: '2026-11-10', checkOut: '2026-11-12' };

  it('follows Pending → Confirmed → Checked-in → Checked-out for staff', () => {
    expect(evaluateAction(base, 'CONFIRM', staff, '2026-11-03')).toEqual({ ok: true, to: 'CONFIRMED' });
    const confirmed = { ...base, status: 'CONFIRMED' as const };
    expect(evaluateAction(confirmed, 'CHECK_IN', staff, '2026-11-10')).toEqual({ ok: true, to: 'CHECKED_IN' });
    expect(evaluateAction({ ...base, status: 'CHECKED_IN' }, 'CHECK_OUT', staff, '2026-11-12')).toEqual({ ok: true, to: 'CHECKED_OUT' });
  });

  it('rejects skipping states and acting on terminal states', () => {
    expect(evaluateAction(base, 'CHECK_IN', staff, '2026-11-10').ok).toBe(false);
    expect(evaluateAction({ ...base, status: 'CHECKED_OUT' }, 'CANCEL', staff, '2026-11-03').ok).toBe(false);
    expect(evaluateAction({ ...base, status: 'CANCELLED' }, 'CONFIRM', staff, '2026-11-03').ok).toBe(false);
  });

  it('does not allow check-in before the arrival date', () => {
    const r = evaluateAction({ ...base, status: 'CONFIRMED' }, 'CHECK_IN', staff, '2026-11-09');
    expect(r).toMatchObject({ ok: false });
  });

  it('lets a guest cancel only their own reservation, and only before check-in day', () => {
    expect(evaluateAction(base, 'CANCEL', guest, '2026-11-03').ok).toBe(true);
    expect(evaluateAction(base, 'CANCEL', otherGuest, '2026-11-03')).toMatchObject({ ok: false, forbidden: true });
    expect(evaluateAction({ ...base, status: 'CONFIRMED' }, 'CANCEL', guest, '2026-11-10').ok).toBe(false);
    expect(evaluateAction({ ...base, status: 'CONFIRMED' }, 'CANCEL', staff, '2026-11-10').ok).toBe(true);
  });

  it('never offers staff-only actions to guests', () => {
    expect(allowedActions(base, guest, '2026-11-03')).toEqual(['CANCEL']);
    expect(allowedActions(base, staff, '2026-11-03')).toEqual(['CONFIRM', 'CANCEL']);
  });
});

import {
  RESERVATION_ACTIONS,
  STAFF_ROLES,
  type IsoDate,
  type ReservationAction,
  type ReservationStatus,
  type Role,
} from '@hotel/shared';

/**
 * Reservation lifecycle (pure, no I/O so it is trivially unit-testable):
 *
 *   PENDING ──CONFIRM──▶ CONFIRMED ──CHECK_IN──▶ CHECKED_IN ──CHECK_OUT──▶ CHECKED_OUT
 *      │                    │
 *      └──────CANCEL────────┴──▶ CANCELLED
 *
 * Inventory is held from the moment a reservation is created (PENDING), so
 * confirming never needs a fresh availability check. CANCELLED and CHECKED_OUT
 * are terminal.
 */

export interface Actor {
  userId: string;
  role: Role;
}

export interface LifecycleSubject {
  status: ReservationStatus;
  guestId: string;
  checkIn: IsoDate;
  checkOut: IsoDate;
}

export type TransitionResult =
  | { ok: true; to: ReservationStatus }
  | { ok: false; reason: string; forbidden?: boolean };

interface TransitionRule {
  from: readonly ReservationStatus[];
  to: ReservationStatus;
  staffOnly: boolean;
}

export const TRANSITIONS: Record<ReservationAction, TransitionRule> = {
  CONFIRM: { from: ['PENDING'], to: 'CONFIRMED', staffOnly: true },
  CANCEL: { from: ['PENDING', 'CONFIRMED'], to: 'CANCELLED', staffOnly: false },
  CHECK_IN: { from: ['CONFIRMED'], to: 'CHECKED_IN', staffOnly: true },
  CHECK_OUT: { from: ['CHECKED_IN'], to: 'CHECKED_OUT', staffOnly: true },
};

export function isStaff(role: Role): boolean {
  return STAFF_ROLES.includes(role);
}

export function evaluateAction(
  subject: LifecycleSubject,
  action: ReservationAction,
  actor: Actor,
  today: IsoDate,
): TransitionResult {
  const rule = TRANSITIONS[action];
  const staff = isStaff(actor.role);

  if (rule.staffOnly && !staff) {
    return { ok: false, forbidden: true, reason: 'Only hotel staff can perform this action' };
  }
  if (!staff && subject.guestId !== actor.userId) {
    return { ok: false, forbidden: true, reason: 'You can only manage your own reservations' };
  }
  if (!rule.from.includes(subject.status)) {
    return {
      ok: false,
      reason: `Cannot ${action.toLowerCase().replace('_', '-')} a reservation that is ${subject.status}`,
    };
  }

  switch (action) {
    case 'CONFIRM':
      if (today >= subject.checkOut) return { ok: false, reason: 'The stay has already ended' };
      break;
    case 'CANCEL':
      // Guests may cancel up to the day before arrival; staff may cancel any open reservation
      // (e.g. no-shows) because they can see the operational context.
      if (!staff && today >= subject.checkIn) {
        return { ok: false, reason: 'Reservations can only be cancelled before the check-in date' };
      }
      break;
    case 'CHECK_IN':
      if (today < subject.checkIn) return { ok: false, reason: `Check-in opens on ${subject.checkIn}` };
      if (today >= subject.checkOut) return { ok: false, reason: 'The stay has already ended' };
      break;
    case 'CHECK_OUT':
      break;
  }
  return { ok: true, to: rule.to };
}

export function allowedActions(subject: LifecycleSubject, actor: Actor, today: IsoDate): ReservationAction[] {
  return RESERVATION_ACTIONS.filter((a) => evaluateAction(subject, a, actor, today).ok);
}

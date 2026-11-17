/**
 * Runtime constants shared by the API and the web client.
 * Kept deliberately small: business rules live on the server, the client only
 * needs the vocabulary (labels, enum values) to render what the server returns.
 */

export const ROLES = ['GUEST', 'STAFF', 'ADMIN'] as const;
export type Role = (typeof ROLES)[number];

/** Roles allowed into the staff dashboard. */
export const STAFF_ROLES: readonly Role[] = ['STAFF', 'ADMIN'];

export const RESERVATION_STATUSES = [
  'PENDING',
  'CONFIRMED',
  'CHECKED_IN',
  'CHECKED_OUT',
  'CANCELLED',
] as const;
export type ReservationStatus = (typeof RESERVATION_STATUSES)[number];

export const RESERVATION_STATUS_LABELS: Record<ReservationStatus, string> = {
  PENDING: 'Pending',
  CONFIRMED: 'Confirmed',
  CHECKED_IN: 'Checked in',
  CHECKED_OUT: 'Checked out',
  CANCELLED: 'Cancelled',
};

/** Actions that move a reservation through its lifecycle. */
export const RESERVATION_ACTIONS = ['CONFIRM', 'CANCEL', 'CHECK_IN', 'CHECK_OUT'] as const;
export type ReservationAction = (typeof RESERVATION_ACTIONS)[number];

export const RESERVATION_ACTION_LABELS: Record<ReservationAction, string> = {
  CONFIRM: 'Confirm',
  CANCEL: 'Cancel',
  CHECK_IN: 'Check in',
  CHECK_OUT: 'Check out',
};

export const RESERVATION_SORT_FIELDS = ['createdAt', 'checkIn', 'checkOut', 'totalAmount'] as const;
export type ReservationSortField = (typeof RESERVATION_SORT_FIELDS)[number];

export const ROOM_TYPE_SORT_FIELDS = ['pricePerNight', 'name', 'capacity', 'createdAt'] as const;
export type RoomTypeSortField = (typeof ROOM_TYPE_SORT_FIELDS)[number];

export const SORT_ORDERS = ['asc', 'desc'] as const;
export type SortOrder = (typeof SORT_ORDERS)[number];

export const FRONT_DESK_VIEWS = ['arrivals', 'in-house', 'departures'] as const;
export type FrontDeskView = (typeof FRONT_DESK_VIEWS)[number];

export const PAGINATION_DEFAULT_LIMIT = 10;
export const PAGINATION_MAX_LIMIT = 50;

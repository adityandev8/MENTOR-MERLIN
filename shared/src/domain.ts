import type {
  FrontDeskView,
  ReservationAction,
  ReservationSortField,
  ReservationStatus,
  Role,
  RoomTypeSortField,
  SortOrder,
} from './constants.js';

/** Calendar date string in hotel-local time, formatted YYYY-MM-DD. */
export type IsoDate = string;
/** ISO-8601 timestamp string. */
export type IsoDateTime = string;

// ---------- Users & auth ----------

export interface PublicUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  createdAt: IsoDateTime;
}

export interface RegisterInput {
  name: string;
  email: string;
  password: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface AuthResult {
  token: string;
  expiresIn: string;
  user: PublicUser;
}

// ---------- Room types ----------

export interface RoomTypeDTO {
  id: string;
  name: string;
  description: string;
  capacity: number;
  facilities: string[];
  /** Whole currency units (e.g. rupees). Integers only to avoid float drift. */
  pricePerNight: number;
  currency: string;
  totalInventory: number;
  isActive: boolean;
  imageUrl: string | null;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
}

export interface RoomTypeInput {
  name: string;
  description: string;
  capacity: number;
  facilities: string[];
  pricePerNight: number;
  totalInventory: number;
  isActive: boolean;
  imageUrl?: string | null;
}

export type RoomTypeUpdateInput = Partial<RoomTypeInput>;

export interface RoomTypeListQuery {
  page?: number;
  limit?: number;
  /** Staff only: include inactive room types. Ignored for guests. */
  includeInactive?: boolean;
  q?: string;
  sortBy?: RoomTypeSortField;
  sortOrder?: SortOrder;
}

// ---------- Availability ----------

export interface StayQuery {
  checkIn: IsoDate;
  checkOut: IsoDate;
  guests: number;
  rooms?: number;
}

export interface AvailabilityItem {
  roomType: RoomTypeDTO;
  /** Rooms free on every night of the stay (minimum across nights). */
  availableRooms: number;
  isAvailable: boolean;
  nights: number;
  roomsRequested: number;
  /** Server-calculated total for the requested rooms and nights. */
  totalPrice: number;
}

export interface Quote {
  roomTypeId: string;
  checkIn: IsoDate;
  checkOut: IsoDate;
  nights: number;
  guests: number;
  rooms: number;
  pricePerNight: number;
  totalPrice: number;
  currency: string;
  availableRooms: number;
  isAvailable: boolean;
  /** Present when the stay is not bookable (capacity, inactive, sold out). */
  unavailableReason: string | null;
}

// ---------- Reservations ----------

export interface ReservationStatusChange {
  status: ReservationStatus;
  at: IsoDateTime;
  byUserId: string | null;
  byRole: Role | 'SYSTEM';
  note: string | null;
}

export interface ReservationDTO {
  id: string;
  reference: string;
  guest: { id: string; name: string; email: string };
  roomType: { id: string; name: string };
  checkIn: IsoDate;
  checkOut: IsoDate;
  nights: number;
  guests: number;
  roomCount: number;
  pricePerNight: number;
  totalAmount: number;
  currency: string;
  status: ReservationStatus;
  statusHistory: ReservationStatusChange[];
  /** Actions the current viewer may perform right now, computed by the server. */
  allowedActions: ReservationAction[];
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
}

export interface CreateReservationInput {
  roomTypeId: string;
  checkIn: IsoDate;
  checkOut: IsoDate;
  guests: number;
  rooms: number;
}

export interface ReservationActionInput {
  action: ReservationAction;
  note?: string;
}

export interface ReservationListQuery {
  page?: number;
  limit?: number;
  status?: ReservationStatus;
  /** Free-text: reservation reference prefix or guest email prefix (staff only). */
  q?: string;
  roomTypeId?: string;
  checkInFrom?: IsoDate;
  checkInTo?: IsoDate;
  /** Reservations whose stay covers this night. */
  stayDate?: IsoDate;
  sortBy?: ReservationSortField;
  sortOrder?: SortOrder;
}

export interface FrontDeskQuery {
  view: FrontDeskView;
  page?: number;
  limit?: number;
}

// ---------- Dashboard ----------

export interface DashboardSummary {
  date: IsoDate;
  arrivalsToday: number;
  arrivalsPendingCheckIn: number;
  departuresToday: number;
  inHouseReservations: number;
  occupiedRooms: number;
  totalRooms: number;
  occupancyRate: number;
  pendingReservations: number;
  activeRoomTypes: number;
}

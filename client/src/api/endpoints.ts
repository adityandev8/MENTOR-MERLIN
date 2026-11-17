import type {
  AuthResult,
  AvailabilityItem,
  CreateReservationInput,
  DashboardSummary,
  FrontDeskQuery,
  LoginInput,
  Paginated,
  PublicUser,
  Quote,
  RegisterInput,
  ReservationActionInput,
  ReservationDTO,
  ReservationListQuery,
  RoomTypeDTO,
  RoomTypeInput,
  RoomTypeListQuery,
  RoomTypeUpdateInput,
  StayQuery,
} from '@hotel/shared';
import { request, requestPage } from './http';

/** Typed wrappers around every REST endpoint. Components never build URLs themselves. */

export const authApi = {
  login: (input: LoginInput) => request<AuthResult>('/auth/login', { method: 'POST', body: input }),
  register: (input: RegisterInput) => request<AuthResult>('/auth/register', { method: 'POST', body: input }),
  me: () => request<PublicUser>('/auth/me'),
};

export const roomTypesApi = {
  list: (q: RoomTypeListQuery): Promise<Paginated<RoomTypeDTO>> => requestPage<RoomTypeDTO>('/room-types', { query: q }),
  get: (id: string) => request<RoomTypeDTO>(`/room-types/${id}`),
  quote: (id: string, q: StayQuery) => request<Quote>(`/room-types/${id}/quote`, { query: q }),
  create: (input: RoomTypeInput) => request<RoomTypeDTO>('/room-types', { method: 'POST', body: input }),
  update: (id: string, input: RoomTypeUpdateInput) => request<RoomTypeDTO>(`/room-types/${id}`, { method: 'PATCH', body: input }),
};

export const availabilityApi = {
  search: (q: StayQuery & { page?: number; limit?: number }): Promise<Paginated<AvailabilityItem>> =>
    requestPage<AvailabilityItem>('/availability', { query: q }),
};

export const reservationsApi = {
  create: (input: CreateReservationInput, idempotencyKey: string) =>
    request<ReservationDTO>('/reservations', { method: 'POST', body: input, headers: { 'Idempotency-Key': idempotencyKey } }),
  list: (q: ReservationListQuery): Promise<Paginated<ReservationDTO>> => requestPage<ReservationDTO>('/reservations', { query: q }),
  get: (id: string) => request<ReservationDTO>(`/reservations/${id}`),
  act: (id: string, input: ReservationActionInput) =>
    request<ReservationDTO>(`/reservations/${id}/actions`, { method: 'POST', body: input }),
};

export const adminApi = {
  dashboard: () => request<DashboardSummary>('/admin/dashboard'),
  frontDesk: (q: FrontDeskQuery): Promise<Paginated<ReservationDTO>> => requestPage<ReservationDTO>('/admin/front-desk', { query: q }),
};

import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  CreateReservationInput,
  FrontDeskQuery,
  ReservationActionInput,
  ReservationListQuery,
  RoomTypeInput,
  RoomTypeListQuery,
  RoomTypeUpdateInput,
  StayQuery,
} from '@hotel/shared';
import { adminApi, availabilityApi, reservationsApi, roomTypesApi } from '../api/endpoints';

/**
 * All server state goes through TanStack Query: one cache, consistent loading/error
 * handling, and explicit invalidation after every mutation.
 */
export const keys = {
  roomTypes: (q: RoomTypeListQuery) => ['room-types', q] as const,
  roomType: (id: string) => ['room-types', 'one', id] as const,
  quote: (id: string, q: StayQuery) => ['quote', id, q] as const,
  availability: (q: object) => ['availability', q] as const,
  reservations: (q: ReservationListQuery) => ['reservations', q] as const,
  reservation: (id: string) => ['reservations', 'one', id] as const,
  frontDesk: (q: FrontDeskQuery) => ['front-desk', q] as const,
  dashboard: ['dashboard'] as const,
};

const keepPage = { placeholderData: keepPreviousData };

export const useRoomTypes = (q: RoomTypeListQuery) => useQuery({ queryKey: keys.roomTypes(q), queryFn: () => roomTypesApi.list(q), ...keepPage });

export const useRoomType = (id: string) => useQuery({ queryKey: keys.roomType(id), queryFn: () => roomTypesApi.get(id) });

export const useQuote = (id: string, q: StayQuery | null) =>
  useQuery({
    queryKey: keys.quote(id, q ?? { checkIn: '', checkOut: '', guests: 0 }),
    queryFn: () => roomTypesApi.quote(id, q!),
    enabled: q !== null,
    retry: false,
  });

export const useAvailability = (q: (StayQuery & { page: number; limit: number }) | null) =>
  useQuery({
    queryKey: keys.availability(q ?? {}),
    queryFn: () => availabilityApi.search(q!),
    enabled: q !== null,
    retry: false,
    ...keepPage,
  });

export const useReservations = (q: ReservationListQuery) =>
  useQuery({ queryKey: keys.reservations(q), queryFn: () => reservationsApi.list(q), ...keepPage });

export const useReservation = (id: string) => useQuery({ queryKey: keys.reservation(id), queryFn: () => reservationsApi.get(id) });

export const useFrontDesk = (q: FrontDeskQuery) =>
  useQuery({ queryKey: keys.frontDesk(q), queryFn: () => adminApi.frontDesk(q), ...keepPage });

export const useDashboard = () => useQuery({ queryKey: keys.dashboard, queryFn: adminApi.dashboard, refetchInterval: 60_000 });

/** Anything that changes inventory or status invalidates every view derived from it. */
function useInvalidateBookingViews() {
  const qc = useQueryClient();
  return () =>
    Promise.all(
      ['reservations', 'front-desk', 'dashboard', 'availability', 'quote', 'room-types'].map((k) =>
        qc.invalidateQueries({ queryKey: [k] }),
      ),
    );
}

export function useCreateReservation() {
  const invalidate = useInvalidateBookingViews();
  return useMutation({
    mutationFn: ({ input, idempotencyKey }: { input: CreateReservationInput; idempotencyKey: string }) =>
      reservationsApi.create(input, idempotencyKey),
    onSuccess: invalidate,
  });
}

export function useReservationAction() {
  const invalidate = useInvalidateBookingViews();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: ReservationActionInput }) => reservationsApi.act(id, input),
    onSuccess: invalidate,
  });
}

export function useSaveRoomType() {
  const invalidate = useInvalidateBookingViews();
  return useMutation({
    mutationFn: ({ id, input }: { id: string | null; input: RoomTypeInput | RoomTypeUpdateInput }) =>
      id ? roomTypesApi.update(id, input) : roomTypesApi.create(input as RoomTypeInput),
    onSuccess: invalidate,
  });
}

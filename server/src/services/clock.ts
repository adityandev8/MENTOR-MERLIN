import type { IsoDate } from '@hotel/shared';
import { env } from '../config/env.js';
import { todayInTimeZone } from '../domain/dates.js';
import type { StayRules } from '../domain/stay.js';

/** The hotel's current calendar date. Centralised so it can be faked in tests if needed. */
export function hotelToday(): IsoDate {
  return todayInTimeZone(env.HOTEL_TIMEZONE);
}

export function stayRules(today: IsoDate = hotelToday()): StayRules {
  return { today, maxStayNights: env.MAX_STAY_NIGHTS, bookingWindowDays: env.BOOKING_WINDOW_DAYS };
}

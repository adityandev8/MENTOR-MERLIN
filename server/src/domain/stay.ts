import type { IsoDate } from '@hotel/shared';
import { AppError } from '../utils/AppError.js';
import { addDays, isValidIsoDate, nightsBetween } from './dates.js';

export interface StayRules {
  today: IsoDate;
  maxStayNights: number;
  bookingWindowDays: number;
}

export interface ValidStay {
  checkIn: IsoDate;
  checkOut: IsoDate;
  nights: number;
}

/**
 * Date rules shared by availability search, quotes and booking.
 * Throws a 400 INVALID_DATES AppError describing the first rule that fails.
 */
export function validateStay(checkIn: string, checkOut: string, rules: StayRules): ValidStay {
  if (!isValidIsoDate(checkIn) || !isValidIsoDate(checkOut)) {
    throw AppError.badRequest('Dates must be valid calendar dates in YYYY-MM-DD format', undefined, 'INVALID_DATES');
  }
  if (checkIn < rules.today) {
    throw AppError.badRequest('Check-in date cannot be in the past', { today: rules.today }, 'INVALID_DATES');
  }
  if (checkOut <= checkIn) {
    throw AppError.badRequest('Check-out must be after check-in', undefined, 'INVALID_DATES');
  }
  const nights = nightsBetween(checkIn, checkOut);
  if (nights > rules.maxStayNights) {
    throw AppError.badRequest(
      `Stays are limited to ${rules.maxStayNights} nights`,
      { maxStayNights: rules.maxStayNights },
      'INVALID_DATES',
    );
  }
  const lastBookable = addDays(rules.today, rules.bookingWindowDays);
  if (checkOut > lastBookable) {
    throw AppError.badRequest(
      `Bookings open up to ${rules.bookingWindowDays} days in advance`,
      { latestCheckOut: lastBookable },
      'INVALID_DATES',
    );
  }
  return { checkIn, checkOut, nights };
}

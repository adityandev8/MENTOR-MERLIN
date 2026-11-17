export interface StayPriceInput {
  /** Price per room per night, whole currency units, taken from the server-side room type. */
  pricePerNight: number;
  nights: number;
  rooms: number;
}

/**
 * Total price of a stay. Prices are integers (whole currency units) so totals
 * are exact. This is the only place a total is computed; the browser never
 * supplies one.
 */
export function calculateStayPrice({ pricePerNight, nights, rooms }: StayPriceInput): number {
  for (const [name, value] of Object.entries({ pricePerNight, nights, rooms })) {
    if (!Number.isSafeInteger(value) || value < 0) {
      throw new RangeError(`${name} must be a non-negative integer, received ${value}`);
    }
  }
  const total = pricePerNight * nights * rooms;
  if (!Number.isSafeInteger(total)) throw new RangeError('Stay total exceeds safe integer range');
  return total;
}

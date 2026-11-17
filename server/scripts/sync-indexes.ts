/**
 * Creates/updates MongoDB indexes from the Mongoose schemas. In production autoIndex is off,
 * so run this as a deploy step (once, not from every API instance).
 */
import { connectDatabase, disconnectDatabase } from '../src/db/connection.js';
import { UserModel } from '../src/models/user.model.js';
import { RoomTypeModel } from '../src/models/roomType.model.js';
import { RoomNightModel } from '../src/models/roomNight.model.js';
import { ReservationModel } from '../src/models/reservation.model.js';

function report(name: string, dropped: string[]): void {
  console.log(`${name}: indexes in sync${dropped.length ? ` (dropped stale: ${dropped.join(', ')})` : ''}`);
}

await connectDatabase();
report('users', await UserModel.syncIndexes());
report('roomtypes', await RoomTypeModel.syncIndexes());
report('room_nights', await RoomNightModel.syncIndexes());
report('reservations', await ReservationModel.syncIndexes());
await disconnectDatabase();

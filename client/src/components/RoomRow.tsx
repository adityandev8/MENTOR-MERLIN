import type { ReactNode } from 'react';
import { Link } from 'react-router';
import type { RoomTypeDTO } from '@hotel/shared';
import { formatMoney, plural } from '../lib/format';
import { RoomImage } from './RoomImage';

/** Editorial row for a room type: picture, story, facts, and a slot for price/availability. */
export function RoomRow({ room, to, aside }: { room: RoomTypeDTO; to: string; aside?: ReactNode }) {
  return (
    <article className="room-row">
      <Link to={to} className="room-row-media" tabIndex={-1} aria-hidden="true">
        <RoomImage name={room.name} imageUrl={room.imageUrl} />
      </Link>
      <div className="room-row-body">
        <h3>
          <Link to={to}>{room.name}</Link>
        </h3>
        <p className="room-row-desc">{room.description}</p>
        <ul className="room-row-facts" aria-label="Room facts">
          <li className="sleeps">Sleeps {room.capacity}</li>
          {room.facilities.slice(0, 5).map((f) => (
            <li key={f}>{f}</li>
          ))}
        </ul>
      </div>
      <div className="room-row-aside">
        {aside ?? (
          <>
            <p className="price">
              {formatMoney(room.pricePerNight, room.currency)}
              <span> a night</span>
            </p>
            <p className="muted">{plural(room.totalInventory, 'room')} of this type</p>
          </>
        )}
      </div>
    </article>
  );
}

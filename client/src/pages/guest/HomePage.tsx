import { useNavigate } from 'react-router';
import { StaySentence, defaultStay, type StayValues } from '../../components/StaySentence';
import { RoomRow } from '../../components/RoomRow';
import { ErrorState, LoadingBlock, EmptyState } from '../../components/ui/Feedback';
import { ButtonLink } from '../../components/ui/Button';
import { useRoomTypes } from '../../hooks/queries';

export function toStayQuery(v: StayValues): string {
  return new URLSearchParams({ checkIn: v.checkIn, checkOut: v.checkOut, guests: String(v.guests), rooms: String(v.rooms) }).toString();
}

export function HomePage() {
  const navigate = useNavigate();
  const rooms = useRoomTypes({ page: 1, limit: 3, sortBy: 'pricePerNight', sortOrder: 'asc' });

  return (
    <>
      <section className="hero">
        <p className="eyebrow">Vembanad Lake · Kumarakom</p>
        <h1 className="hero-title">
          Mentor <em>Merlin</em>
        </h1>
        <p className="hero-lede">Lakeside rooms and two private villas on the edge of Vembanad Lake. Tell us when you’re coming.</p>
        <StaySentence initial={defaultStay()} onSubmit={(v) => navigate(`/search?${toStayQuery(v)}`)} />
      </section>

      <section className="pillars" aria-label="About the hotel">
        <div className="pillar">
          <h3>On the water</h3>
          <p>Lakeside rooms on the backwaters of Vembanad.</p>
        </div>
        <div className="pillar">
          <h3>Two private villas</h3>
          <p>Secluded, unhurried, made for longer stays.</p>
        </div>
        <div className="pillar">
          <h3>Easy arrivals</h3>
          <p>Check-in from 2 pm, check-out by 11 am.</p>
        </div>
      </section>

      <section className="section" aria-labelledby="rooms-h">
        <div className="section-head">
          <div>
            <p className="eyebrow">Accommodation</p>
            <h2 id="rooms-h">Rooms</h2>
          </div>
          <ButtonLink to="/rooms" variant="quiet">
            See all rooms
          </ButtonLink>
        </div>
        {rooms.isPending ? (
          <LoadingBlock label="Loading rooms…" />
        ) : rooms.isError ? (
          <ErrorState error={rooms.error} onRetry={() => rooms.refetch()} />
        ) : rooms.data.items.length === 0 ? (
          <EmptyState title="No rooms are open for booking yet">Check back soon.</EmptyState>
        ) : (
          <div className="room-list">
            {rooms.data.items.map((r) => (
              <RoomRow key={r.id} room={r} to={`/rooms/${r.id}`} />
            ))}
          </div>
        )}
      </section>
    </>
  );
}

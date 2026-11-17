/** Every room type uses the same hotel room photograph (served from client/public/images). */
const ROOM_PHOTO = '/images/room.png';

export function RoomImage({ name, className = '' }: { name: string; imageUrl?: string | null; className?: string }) {
  return <img className={`room-image ${className}`} src={ROOM_PHOTO} alt={name} loading="lazy" />;
}

import { useState } from 'react';
import type { RoomTypeDTO } from '@hotel/shared';
import { useRoomTypes, useSaveRoomType } from '../../hooks/queries';
import { useUrlState } from '../../hooks/useUrlState';
import { Alert, EmptyState, ErrorState, LoadingBlock, errorMessage } from '../../components/ui/Feedback';
import { Pagination } from '../../components/ui/Pagination';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { RoomTypeForm } from '../../components/RoomTypeForm';
import { formatMoney } from '../../lib/format';

export function RoomsAdminPage() {
  const { page, setPage } = useUrlState([] as const);
  const list = useRoomTypes({ page, limit: 10, includeInactive: true, sortBy: 'name', sortOrder: 'asc' });
  const toggle = useSaveRoomType();
  const [editing, setEditing] = useState<RoomTypeDTO | 'new' | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const setActive = (rt: RoomTypeDTO, isActive: boolean) =>
    toggle.mutate(
      { id: rt.id, input: { isActive } },
      { onSuccess: () => setNotice(`${rt.name} ${isActive ? 'is open for booking' : 'is closed to new bookings'}`) },
    );

  return (
    <section className="staff-page">
      <header className="staff-head">
        <h1>Rooms</h1>
        <Button onClick={() => setEditing('new')}>Add room type</Button>
      </header>
      {notice && (
        <Alert tone="success" onDismiss={() => setNotice(null)}>
          {notice}
        </Alert>
      )}
      {toggle.isError && <Alert tone="error">{errorMessage(toggle.error)}</Alert>}

      {list.isPending ? (
        <LoadingBlock label="Loading room types…" />
      ) : list.isError ? (
        <ErrorState error={list.error} onRetry={() => list.refetch()} />
      ) : list.data.items.length === 0 ? (
        <EmptyState title="No room types yet" action={<Button onClick={() => setEditing('new')}>Add the first room type</Button>} />
      ) : (
        <>
          <div className={`table-wrap ${list.isPlaceholderData ? 'is-refreshing' : ''}`}>
            <table className="table">
              <thead>
                <tr>
                  <th scope="col">Room type</th>
                  <th scope="col" className="num">
                    Sleeps
                  </th>
                  <th scope="col" className="num">
                    Price a night
                  </th>
                  <th scope="col" className="num">
                    Rooms
                  </th>
                  <th scope="col">Booking</th>
                  <th scope="col">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {list.data.items.map((rt) => (
                  <tr key={rt.id} className={rt.isActive ? '' : 'row-muted'}>
                    <td>
                      <span className="cell-main">{rt.name}</span>
                      <span className="cell-sub">{rt.facilities.slice(0, 3).join(', ')}</span>
                    </td>
                    <td className="num">{rt.capacity}</td>
                    <td className="num">{formatMoney(rt.pricePerNight, rt.currency)}</td>
                    <td className="num">{rt.totalInventory}</td>
                    <td>{rt.isActive ? <span className="badge badge-confirmed">Open</span> : <span className="badge badge-checked-out">Closed</span>}</td>
                    <td>
                      <div className="actions">
                        <Button size="sm" variant="secondary" onClick={() => setEditing(rt)}>
                          Edit
                        </Button>
                        <Button size="sm" variant="quiet" onClick={() => setActive(rt, !rt.isActive)} disabled={toggle.isPending}>
                          {rt.isActive ? 'Close' : 'Open'}
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination meta={list.data.meta} onChange={setPage} busy={list.isFetching} />
        </>
      )}

      <Modal open={editing !== null} title={editing === 'new' ? 'Add room type' : `Edit ${editing?.name ?? ''}`} onClose={() => setEditing(null)}>
        <RoomTypeForm
          roomType={editing === 'new' ? null : editing}
          onSaved={(rt) => {
            setEditing(null);
            setNotice(`${rt.name} saved`);
          }}
        />
      </Modal>
    </section>
  );
}

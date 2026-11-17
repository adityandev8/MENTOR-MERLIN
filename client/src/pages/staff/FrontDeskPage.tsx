import { FRONT_DESK_VIEWS, type FrontDeskView, type ReservationAction } from '@hotel/shared';
import { useFrontDesk } from '../../hooks/queries';
import { useUrlState } from '../../hooks/useUrlState';
import { EmptyState, ErrorState, LoadingBlock } from '../../components/ui/Feedback';
import { Pagination } from '../../components/ui/Pagination';
import { ReservationTable } from '../../components/ReservationTable';

const VIEWS: Record<FrontDeskView, { label: string; empty: string; actions: ReservationAction[] }> = {
  arrivals: { label: 'Arrivals', empty: 'No one is due to arrive. Late arrivals stay here until their stay ends.', actions: ['CONFIRM', 'CHECK_IN', 'CANCEL'] },
  'in-house': { label: 'In house', empty: 'No guests are checked in.', actions: ['CHECK_OUT'] },
  departures: { label: 'Departures', empty: 'No check-outs are due today.', actions: ['CHECK_OUT'] },
};

export function FrontDeskPage() {
  const { values, page, update, setPage } = useUrlState(['view'] as const);
  const view = (FRONT_DESK_VIEWS as readonly string[]).includes(values.view) ? (values.view as FrontDeskView) : 'arrivals';
  const q = useFrontDesk({ view, page, limit: 10 });
  const cfg = VIEWS[view];

  return (
    <section className="staff-page">
      <header className="staff-head">
        <h1>Front desk</h1>
      </header>
      <div className="tabs" role="tablist" aria-label="Front desk queues">
        {FRONT_DESK_VIEWS.map((v) => (
          <button key={v} role="tab" aria-selected={v === view} className={v === view ? 'tab is-on' : 'tab'} onClick={() => update({ view: v })}>
            {VIEWS[v].label}
          </button>
        ))}
      </div>
      {q.isPending ? (
        <LoadingBlock />
      ) : q.isError ? (
        <ErrorState error={q.error} onRetry={() => q.refetch()} />
      ) : q.data.items.length === 0 ? (
        <EmptyState title={`${cfg.label}: nothing to do`}>{cfg.empty}</EmptyState>
      ) : (
        <>
          <ReservationTable rows={q.data.items} linkBase="/staff/reservations" actions={cfg.actions} dim={q.isPlaceholderData} />
          <Pagination meta={q.data.meta} onChange={setPage} busy={q.isFetching} />
        </>
      )}
    </section>
  );
}

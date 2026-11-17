import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router';
import { useAuth } from '../auth/AuthContext';
import { LoadingBlock } from '../components/ui/Feedback';

/**
 * Route guard for UX only: it decides which screens to show. Every protected API call is
 * independently authorised by the server.
 */
export function RequireAuth({ staff = false, children }: { staff?: boolean; children: ReactNode }) {
  const { user, restoring, isStaff } = useAuth();
  const location = useLocation();

  if (restoring) return <LoadingBlock label="Restoring your session…" />;
  if (!user) return <Navigate to={`/login?next=${encodeURIComponent(location.pathname + location.search)}`} replace />;
  if (staff && !isStaff) return <Navigate to="/" replace />;
  if (!staff && isStaff && location.pathname.startsWith('/my-reservations')) return <Navigate to="/staff/reservations" replace />;
  return <>{children}</>;
}

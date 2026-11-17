import { Link, NavLink, Outlet } from 'react-router';
import { useAuth } from '../auth/AuthContext';

export function StaffLayout() {
  const { user, logout } = useAuth();
  return (
    <div className="staff-shell">
      <a href="#staff-main" className="skip-link">
        Skip to content
      </a>
      <aside className="staff-nav">
        <Link to="/staff" className="wordmark">
          Mentor Merlin
          <small aria-hidden="true">Kumarakom · Kerala</small>
        </Link>
        <p className="staff-nav-sub">Staff console</p>
        <nav aria-label="Staff">
          <NavLink to="/staff" end>
            Today
          </NavLink>
          <NavLink to="/staff/front-desk">Front desk</NavLink>
          <NavLink to="/staff/reservations">Reservations</NavLink>
          <NavLink to="/staff/rooms">Rooms</NavLink>
        </nav>
        <div className="staff-nav-foot">
          <p>
            {user?.name}
            <span className="cell-sub">{user?.role === 'ADMIN' ? 'Administrator' : 'Front desk'}</span>
          </p>
          <Link to="/">Guest site</Link>
          <button className="link-button" onClick={logout}>
            Sign out
          </button>
        </div>
      </aside>
      <main id="staff-main" className="staff-main">
        <Outlet />
      </main>
    </div>
  );
}

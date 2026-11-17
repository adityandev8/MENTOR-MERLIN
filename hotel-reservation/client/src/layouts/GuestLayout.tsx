import { Link, NavLink, Outlet } from 'react-router';
import { useAuth } from '../auth/AuthContext';

export function GuestLayout() {
  const { user, isStaff, logout } = useAuth();
  return (
    <div className="guest-shell">
      <a href="#main" className="skip-link">
        Skip to content
      </a>
      <header className="site-header">
        <Link to="/" className="wordmark" aria-label="Mentor Merlin, home">
          Mentor Merlin
          <small aria-hidden="true">Kumarakom · Kerala</small>
        </Link>
        <nav aria-label="Main">
          <NavLink to="/rooms">Rooms</NavLink>
          <NavLink to="/search">Availability</NavLink>
          {user && !isStaff && <NavLink to="/my-reservations">My reservations</NavLink>}
          {isStaff && <NavLink to="/staff">Staff console</NavLink>}
          {user ? (
            <button className="link-button" onClick={logout}>
              Sign out
            </button>
          ) : (
            <NavLink to="/login">Sign in</NavLink>
          )}
        </nav>
      </header>
      <main id="main" className="guest-main">
        <Outlet />
      </main>
      <footer className="site-footer">
        <div className="footer-inner">
          <div>
            <Link to="/" className="wordmark">
              Mentor Merlin
              <small aria-hidden="true">Kumarakom · Kerala</small>
            </Link>
            <p>Lakeside rooms and two private villas on the edge of Vembanad Lake.</p>
          </div>
          <div>
            <h2>Arrivals</h2>
            <p>Check-in from 2 pm</p>
            <p>Check-out by 11 am</p>
          </div>
          <div>
            <h2>Explore</h2>
            <p>
              <Link to="/rooms">Rooms &amp; villas</Link>
            </p>
            <p>
              <Link to="/search">Check availability</Link>
            </p>
          </div>
        </div>
        <p className="footer-base">Mentor Merlin · Kumarakom, Kerala</p>
      </footer>
    </div>
  );
}

import { createBrowserRouter, Link, RouterProvider } from 'react-router';
import { GuestLayout } from './layouts/GuestLayout';
import { StaffLayout } from './layouts/StaffLayout';
import { RequireAuth } from './layouts/RequireAuth';
import { HomePage } from './pages/guest/HomePage';
import { RoomsPage } from './pages/guest/RoomsPage';
import { SearchPage } from './pages/guest/SearchPage';
import { RoomDetailPage } from './pages/guest/RoomDetailPage';
import { LoginPage, RegisterPage } from './pages/guest/AuthPages';
import { MyReservationsPage } from './pages/guest/MyReservationsPage';
import { ReservationDetailPage } from './pages/ReservationDetailPage';
import { DashboardPage } from './pages/staff/DashboardPage';
import { FrontDeskPage } from './pages/staff/FrontDeskPage';
import { ReservationsPage } from './pages/staff/ReservationsPage';
import { RoomsAdminPage } from './pages/staff/RoomsAdminPage';
import { EmptyState } from './components/ui/Feedback';

function NotFound() {
  return (
    <section className="section page-top">
      <EmptyState title="This page doesn’t exist" action={<Link to="/">Go to the home page</Link>} />
    </section>
  );
}

const router = createBrowserRouter([
  {
    element: <GuestLayout />,
    children: [
      { index: true, element: <HomePage /> },
      { path: 'rooms', element: <RoomsPage /> },
      { path: 'rooms/:id', element: <RoomDetailPage /> },
      { path: 'search', element: <SearchPage /> },
      { path: 'login', element: <LoginPage /> },
      { path: 'register', element: <RegisterPage /> },
      { path: 'my-reservations', element: <RequireAuth><MyReservationsPage /></RequireAuth> },
      { path: 'my-reservations/:id', element: <RequireAuth><ReservationDetailPage /></RequireAuth> },
      { path: '*', element: <NotFound /> },
    ],
  },
  {
    path: 'staff',
    element: (
      <RequireAuth staff>
        <StaffLayout />
      </RequireAuth>
    ),
    children: [
      { index: true, element: <DashboardPage /> },
      { path: 'front-desk', element: <FrontDeskPage /> },
      { path: 'reservations', element: <ReservationsPage /> },
      { path: 'reservations/:id', element: <ReservationDetailPage staff /> },
      { path: 'rooms', element: <RoomsAdminPage /> },
    ],
  },
]);

export function App() {
  return <RouterProvider router={router} />;
}

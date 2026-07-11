import { FormEvent, useEffect, useMemo, useState } from 'react';
import { io } from 'socket.io-client';
import { MapContainer, Marker, TileLayer, Popup } from 'react-leaflet';
import L from 'leaflet';
import './styles.css';

const markerIcon = L.icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.5/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.5/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.5/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

type Role = 'STUDENT' | 'TEACHER' | 'DRIVER' | 'ADMIN';

type AppUser = {
  id: number;
  name: string;
  email: string;
  role: Role;
  schoolId?: string | null;
  isBlocked?: boolean;
};

type Bus = {
  id: number;
  name: string;
  route: string;
  availableSeats: number;
  locationLat: number;
  locationLng: number;
  driver?: { id: number; name: string } | null;
};

type Booking = {
  id: number;
  pickup: string;
  dropoff: string;
  date: string;
  time: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  bus: Bus;
};

type RegisterForm = {
  name: string;
  email: string;
  password: string;
  schoolId: string;
  role: 'STUDENT' | 'TEACHER';
};

const apiBase = 'http://localhost:4000/api';
const socket = io('http://localhost:4000', { withCredentials: true });

function apiRequest(path: string, options: RequestInit = {}) {
  return fetch(`${apiBase}${path}`, {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  }).then(async (res) => {
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.message || 'API error');
    return body;
  });
}

function App() {
  const [user, setUser] = useState<AppUser | null>(null);
  const [buses, setBuses] = useState<Bus[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [users, setUsers] = useState<AppUser[]>([]);
  const [activeView, setActiveView] = useState<'login' | 'register' | 'dashboard'>('login');
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<RegisterForm>({ name: '', email: '', password: '', schoolId: '', role: 'STUDENT' });
  const [bookingForm, setBookingForm] = useState({ busId: '', pickup: '', dropoff: '', date: '', time: '' });
  const [seatForm, setSeatForm] = useState({ busId: '', availableSeats: '' });
  const [roleForm, setRoleForm] = useState({ userId: '', role: 'DRIVER' as Role });
  const [passwordForm, setPasswordForm] = useState({ currentPassword: '', newPassword: '' });

  const isAuthenticated = useMemo(() => Boolean(user), [user]);

  const fetchUser = async () => {
    try {
      const { user } = await apiRequest('/users/me');
      setUser(user);
      setActiveView('dashboard');
    } catch (_err) {
      setUser(null);
      setActiveView('login');
    }
  };

  const fetchBuses = async () => {
    try {
      const { buses } = await apiRequest('/buses');
      setBuses(buses);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const fetchBookings = async () => {
    try {
      const { bookings } = await apiRequest('/bookings');
      setBookings(bookings);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const fetchUsers = async () => {
    if (user?.role !== 'ADMIN') return;
    try {
      const { users } = await apiRequest('/users');
      setUsers(users);
    } catch (err: any) {
      setError(err.message);
    }
  };

  useEffect(() => {
    fetchUser();
    fetchBuses();
    fetchBookings();

    socket.on('busUpdate', (updatedBus: Bus) => {
      setBuses((prev) => prev.map((bus) => (bus.id === updatedBus.id ? updatedBus : bus)));
    });

    socket.on('bookingUpdate', async () => {
      await fetchBookings();
    });

    return () => {
      socket.off('busUpdate');
      socket.off('bookingUpdate');
    };
  }, []);

  useEffect(() => {
    if (user?.role === 'ADMIN') {
      fetchUsers();
    }
  }, [user]);

  const handleRegister = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    try {
      const { user } = await apiRequest('/auth/register', {
        method: 'POST',
        body: JSON.stringify(form),
      });
      setUser(user);
      setActiveView('dashboard');
      await fetchBuses();
      await fetchBookings();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleLogin = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    try {
      const { user } = await apiRequest('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ identifier: form.email, password: form.password }),
      });
      setUser(user);
      setActiveView('dashboard');
      await fetchBuses();
      await fetchBookings();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleLogout = async () => {
    await apiRequest('/auth/logout');
    setUser(null);
    setActiveView('login');
  };

  const handleBookingSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    try {
      await apiRequest('/bookings', {
        method: 'POST',
        body: JSON.stringify({
          busId: bookingForm.busId,
          pickup: bookingForm.pickup,
          dropoff: bookingForm.dropoff,
          date: bookingForm.date,
          time: bookingForm.time,
        }),
      });
      setBookingForm({ busId: '', pickup: '', dropoff: '', date: '', time: '' });
      await fetchBookings();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleSeatUpdate = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    try {
      await apiRequest(`/buses/${seatForm.busId}/seats`, {
        method: 'PUT',
        body: JSON.stringify({ availableSeats: Number(seatForm.availableSeats) }),
      });
      setSeatForm({ busId: '', availableSeats: '' });
      await fetchBuses();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleRoleUpdate = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    try {
      await apiRequest(`/users/${roleForm.userId}/role`, {
        method: 'PUT',
        body: JSON.stringify({ role: roleForm.role }),
      });
      setRoleForm({ userId: '', role: 'DRIVER' });
      await fetchUsers();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleBlockUser = async (id: number, blocked: boolean) => {
    setError(null);
    try {
      await apiRequest(`/users/${id}/block`, {
        method: 'PUT',
        body: JSON.stringify({ blocked }),
      });
      await fetchUsers();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleChangePassword = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    try {
      await apiRequest('/auth/change-password', {
        method: 'POST',
        body: JSON.stringify(passwordForm),
      });
      setPasswordForm({ currentPassword: '', newPassword: '' });
      setError('Password changed successfully');
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleUpdateBooking = async (bookingId: number, status: 'APPROVED' | 'REJECTED') => {
    setError(null);
    try {
      await apiRequest(`/bookings/${bookingId}/status`, {
        method: 'PUT',
        body: JSON.stringify({ status }),
      });
      await fetchBookings();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleForgotPassword = async () => {
    const email = window.prompt('Enter your registered email');
    if (!email) return;
    try {
      await apiRequest('/auth/forgot-password', { method: 'POST', body: JSON.stringify({ email }) });
      setError('Password reset email sent.');
    } catch (err: any) {
      setError(err.message);
    }
  };

  const renderHeader = () => (
    <header className="header">
      <div>
        <h1>School Bus Tracker</h1>
        <p>Track buses, book passes, and manage roles with one platform.</p>
      </div>
      <div className="header-actions">
        {isAuthenticated && <button onClick={handleLogout}>Logout</button>}
      </div>
    </header>
  );

  const renderLogin = () => (
    <main className="auth-card">
      <h2>Login</h2>
      <form onSubmit={handleLogin}>
        <label>Student/Teacher ID or Email</label>
        <input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
        <label>Password</label>
        <input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required />
        <button type="submit">Login</button>
      </form>
      <div className="auth-actions">
        <button className="secondary" onClick={() => setActiveView('register')}>Create Account</button>
        <button className="secondary" onClick={() => (window.location.href = `${apiBase}/auth/google`)}>Login with Google</button>
        <button className="secondary" onClick={handleForgotPassword}>Forgot Password</button>
      </div>
      {error && <div className="error">{error}</div>}
    </main>
  );

  const renderRegister = () => (
    <main className="auth-card">
      <h2>Register</h2>
      <form onSubmit={handleRegister}>
        <label>Name</label>
        <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
        <label>Email</label>
        <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
        <label>Password</label>
        <input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required />
        <label>School / Teacher ID</label>
        <input value={form.schoolId} onChange={(e) => setForm({ ...form, schoolId: e.target.value })} />
        <label>Role</label>
        <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as 'STUDENT' | 'TEACHER' })}>
          <option value="STUDENT">Student</option>
          <option value="TEACHER">Teacher</option>
        </select>
        <button type="submit">Register</button>
      </form>
      <button className="secondary" onClick={() => setActiveView('login')}>Back to Login</button>
      {error && <div className="error">{error}</div>}
    </main>
  );

  const renderDashboard = () => (
    <main className="dashboard">
      <section className="panel">
        <h2>Live Bus Map</h2>
        <div className="map-panel">
          <MapContainer center={[12.9716, 77.5946]} zoom={13} scrollWheelZoom style={{ height: '320px', width: '100%' }}>
            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
            {buses.map((bus) => (
              <Marker key={bus.id} position={[bus.locationLat || 12.9716, bus.locationLng || 77.5946]} icon={markerIcon}>
                <Popup>
                  <strong>{bus.name}</strong><br />{bus.route}<br />Seats: {bus.availableSeats}
                </Popup>
              </Marker>
            ))}
          </MapContainer>
        </div>
      </section>

      <section className="panel">
        <div className="section-heading">
          <h2>Available Buses</h2>
          <button onClick={fetchBuses}>Refresh</button>
        </div>
        <div className="bus-grid">
          {buses.map((bus) => (
            <div key={bus.id} className="bus-card">
              <h3>{bus.name}</h3>
              <p>{bus.route}</p>
              <p><strong>Driver:</strong> {bus.driver?.name || 'Unassigned'}</p>
              <p><strong>Seats:</strong> {bus.availableSeats}</p>
              <p><strong>Location:</strong> {bus.locationLat.toFixed(4)}, {bus.locationLng.toFixed(4)}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="panel">
        <h2>Booking History</h2>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Bus</th>
                <th>Pickup</th>
                <th>Dropoff</th>
                <th>Date</th>
                <th>Time</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {bookings.map((booking) => (
                <tr key={booking.id}>
                  <td>{booking.bus.name}</td>
                  <td>{booking.pickup}</td>
                  <td>{booking.dropoff}</td>
                  <td>{booking.date}</td>
                  <td>{booking.time}</td>
                  <td>{booking.status}</td>
                  <td>
                    {(user?.role === 'ADMIN' || user?.role === 'DRIVER') && (
                      <div className="booking-actions">
                        <button onClick={() => handleUpdateBooking(booking.id, 'APPROVED')}>Approve</button>
                        <button onClick={() => handleUpdateBooking(booking.id, 'REJECTED')}>Reject</button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {user?.role !== 'ADMIN' && user?.role !== 'DRIVER' && (
        <section className="panel">
          <h2>Book a Pass</h2>
          <form onSubmit={handleBookingSubmit} className="grid-form">
            <label>Bus</label>
            <select value={bookingForm.busId} onChange={(e) => setBookingForm({ ...bookingForm, busId: e.target.value })} required>
              <option value="">Select a bus</option>
              {buses.map((bus) => (
                <option key={bus.id} value={bus.id}>{bus.name} - {bus.route}</option>
              ))}
            </select>
            <label>Pickup Location</label>
            <input value={bookingForm.pickup} onChange={(e) => setBookingForm({ ...bookingForm, pickup: e.target.value })} required />
            <label>Dropoff Location</label>
            <input value={bookingForm.dropoff} onChange={(e) => setBookingForm({ ...bookingForm, dropoff: e.target.value })} required />
            <label>Date</label>
            <input type="date" value={bookingForm.date} onChange={(e) => setBookingForm({ ...bookingForm, date: e.target.value })} required />
            <label>Time</label>
            <input type="time" value={bookingForm.time} onChange={(e) => setBookingForm({ ...bookingForm, time: e.target.value })} required />
            <button type="submit">Book Pass</button>
          </form>
        </section>
      )}

      {user?.role === 'DRIVER' && (
        <section className="panel">
          <h2>Driver Controls</h2>
          <form onSubmit={handleSeatUpdate} className="grid-form">
            <label>Bus ID</label>
            <input value={seatForm.busId} onChange={(e) => setSeatForm({ ...seatForm, busId: e.target.value })} required />
            <label>Available Seats</label>
            <input type="number" step="1" value={seatForm.availableSeats} onChange={(e) => setSeatForm({ ...seatForm, availableSeats: e.target.value })} required />
            <button type="submit">Update Seats</button>
          </form>
        </section>
      )}

      {user?.role === 'ADMIN' && (
        <section className="panel">
          <h2>Admin Panel</h2>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Blocked</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((item) => (
                  <tr key={item.id}>
                    <td>{item.id}</td>
                    <td>{item.name}</td>
                    <td>{item.email}</td>
                    <td>{item.role}</td>
                    <td>{item.isBlocked ? 'Yes' : 'No'}</td>
                    <td>
                      <button onClick={() => handleBlockUser(item.id, !item.isBlocked)}>{item.isBlocked ? 'Unblock' : 'Block'}</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <form onSubmit={handleRoleUpdate} className="grid-form admin-form">
            <label>User ID</label>
            <input value={roleForm.userId} onChange={(e) => setRoleForm({ ...roleForm, userId: e.target.value })} required />
            <label>Role</label>
            <select value={roleForm.role} onChange={(e) => setRoleForm({ ...roleForm, role: e.target.value as Role })}>
              <option value="STUDENT">Student</option>
              <option value="TEACHER">Teacher</option>
              <option value="DRIVER">Driver</option>
              <option value="ADMIN">Admin</option>
            </select>
            <button type="submit">Update Role</button>
          </form>
        </section>
      )}

      <section className="panel">
        <h2>Change Password</h2>
        <form onSubmit={handleChangePassword} className="grid-form">
          <label>Current Password</label>
          <input type="password" value={passwordForm.currentPassword} onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })} required />
          <label>New Password</label>
          <input type="password" value={passwordForm.newPassword} onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })} required />
          <button type="submit">Change Password</button>
        </form>
      </section>
      {error && <div className="error">{error}</div>}
    </main>
  );

  return (
    <div className="app-shell">
      {renderHeader()}
      {activeView === 'login' && renderLogin()}
      {activeView === 'register' && renderRegister()}
      {activeView === 'dashboard' && renderDashboard()}
    </div>
  );
}

export default App;

import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';
import passport from './passport';
import { authenticate, authorize, AuthRequest } from './middleware';
import nodemailer from 'nodemailer';

dotenv.config();

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: 'http://localhost:5173',
    credentials: true,
  },
});

const prisma = new PrismaClient();
const jwtSecret = process.env.JWT_SECRET || 'secret';
const adminEmail = process.env.ADMIN_EMAIL || 'starklab73@gmail.com';
const adminPassword = process.env.ADMIN_PASSWORD || '12345@';

app.use(cors({ origin: 'http://localhost:5173', credentials: true }));
app.use(express.json());
app.use(cookieParser());
app.use(passport.initialize());

async function createDefaultAdmin() {
  const existing = await prisma.user.findUnique({ where: { email: adminEmail } });
  if (!existing) {
    const hashed = await bcrypt.hash(adminPassword, 10);
    await prisma.user.create({
      data: {
        email: adminEmail,
        name: 'System Admin',
        role: 'ADMIN',
        password: hashed,
      },
    });
    console.log('Admin account created:', adminEmail);
  }
}

function signToken(user: { id: number; role: string }) {
  return jwt.sign({ userId: user.id, role: user.role }, jwtSecret, { expiresIn: '7d' });
}

function sendBusUpdate(bus: any) {
  io.emit('busUpdate', bus);
}

function sendBookingUpdate(booking: any) {
  io.emit('bookingUpdate', booking);
}

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.post('/api/auth/register', async (req, res) => {
  const { name, email, password, role, schoolId } = req.body;
  if (!name || !email || !password || !role) {
    return res.status(400).json({ message: 'Missing required fields' });
  }

  if (!['STUDENT', 'TEACHER'].includes(role)) {
    return res.status(400).json({ message: 'Invalid role for registration' });
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return res.status(400).json({ message: 'Email already registered' });

  const hashed = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({
    data: {
      name,
      email,
      password: hashed,
      role,
      schoolId,
    },
  });

  const token = signToken({ id: user.id, role: user.role });
  res.cookie('token', token, { httpOnly: true, sameSite: 'lax' });
  res.json({ user: { id: user.id, name: user.name, email: user.email, role: user.role } });
});

app.post('/api/auth/login', async (req, res) => {
  const { identifier, password } = req.body;
  if (!identifier || !password) {
    return res.status(400).json({ message: 'Missing credentials' });
  }

  const user = await prisma.user.findFirst({
    where: { OR: [{ email: identifier }, { schoolId: identifier }] },
  });
  if (!user || !user.password) return res.status(401).json({ message: 'Invalid credentials' });

  const valid = await bcrypt.compare(password, user.password);
  if (!valid) return res.status(401).json({ message: 'Invalid credentials' });
  if (user.isBlocked) return res.status(403).json({ message: 'User is blocked' });

  const token = signToken({ id: user.id, role: user.role });
  res.cookie('token', token, { httpOnly: true, sameSite: 'lax' });
  res.json({ user: { id: user.id, name: user.name, email: user.email, role: user.role } });
});

app.get('/api/auth/logout', (_req, res) => {
  res.clearCookie('token');
  res.json({ message: 'Logged out' });
});

app.post('/api/auth/forgot-password', async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ message: 'Email is required' });
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return res.status(404).json({ message: 'User not found' });

  const newPassword = Math.random().toString(36).slice(-10) + 'A1!';
  const hashed = await bcrypt.hash(newPassword, 10);
  await prisma.user.update({ where: { id: user.id }, data: { password: hashed } });

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: false,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  await transporter.sendMail({
    from: process.env.SMTP_USER,
    to: user.email,
    subject: 'Bus Tracker Password Reset',
    text: `Your new password is ${newPassword}`,
  });

  res.json({ message: 'Password reset email sent' });
});

app.post('/api/auth/change-password', authenticate, async (req, res) => {
  const authReq = req as AuthRequest;
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) {
    return res.status(400).json({ message: 'Missing password fields' });
  }
  const user = await prisma.user.findUnique({ where: { id: authReq.user!.userId } });
  if (!user || !user.password) return res.status(400).json({ message: 'User not found' });

  const valid = await bcrypt.compare(currentPassword, user.password);
  if (!valid) return res.status(401).json({ message: 'Current password is incorrect' });

  const hashed = await bcrypt.hash(newPassword, 10);
  await prisma.user.update({ where: { id: user.id }, data: { password: hashed } });
  res.json({ message: 'Password changed' });
});

app.get('/api/auth/google', passport.authenticate('google', { scope: ['profile', 'email'] }));

app.get('/api/auth/google/callback', passport.authenticate('google', { session: false, failureRedirect: '/login' }), async (req: any, res) => {
  const user = req.user;
  const token = signToken({ id: user.id, role: user.role });
  res.cookie('token', token, { httpOnly: true, sameSite: 'lax' });
  res.redirect('http://localhost:5173');
});

app.get('/api/users/me', authenticate, async (req, res) => {
  const authReq = req as AuthRequest;
  const user = await prisma.user.findUnique({
    where: { id: authReq.user!.userId },
    select: { id: true, name: true, email: true, role: true, schoolId: true, isBlocked: true },
  });
  res.json({ user });
});

app.get('/api/users', authenticate, authorize(['ADMIN']), async (_req, res) => {
  const users = await prisma.user.findMany({
    select: { id: true, name: true, email: true, role: true, schoolId: true, isBlocked: true, createdAt: true },
  });
  res.json({ users });
});

app.put('/api/users/:id/role', authenticate, authorize(['ADMIN']), async (req, res) => {
  const id = Number(req.params.id);
  const { role } = req.body;
  if (!['STUDENT', 'TEACHER', 'DRIVER', 'ADMIN'].includes(role)) {
    return res.status(400).json({ message: 'Invalid role' });
  }
  if (id <= 0) return res.status(400).json({ message: 'Invalid id' });

  const user = await prisma.user.update({ where: { id }, data: { role } });
  res.json({ user });
});

app.put('/api/users/:id/block', authenticate, authorize(['ADMIN']), async (req, res) => {
  const id = Number(req.params.id);
  const { blocked } = req.body;
  const user = await prisma.user.update({ where: { id }, data: { isBlocked: Boolean(blocked) } });
  res.json({ user });
});

app.get('/api/buses', authenticate, async (_req, res) => {
  const buses = await prisma.bus.findMany({ include: { driver: { select: { id: true, name: true, email: true } } } });
  res.json({ buses });
});

app.post('/api/buses', authenticate, authorize(['ADMIN']), async (req, res) => {
  const { name, route } = req.body;
  if (!name || !route) return res.status(400).json({ message: 'Missing bus fields' });
  const bus = await prisma.bus.create({ data: { name, route } });
  res.json({ bus });
});

app.put('/api/buses/:id/assign-driver', authenticate, authorize(['ADMIN']), async (req, res) => {
  const busId = Number(req.params.id);
  const { driverId } = req.body;
  const user = await prisma.user.findUnique({ where: { id: Number(driverId) } });
  if (!user || user.role !== 'DRIVER') {
    return res.status(400).json({ message: 'Driver user not found or role invalid' });
  }
  const bus = await prisma.bus.update({ where: { id: busId }, data: { driverId: user.id } });
  res.json({ bus });
});

app.put('/api/buses/:id/seats', authenticate, authorize(['ADMIN', 'DRIVER']), async (req, res) => {
  const authReq = req as AuthRequest;
  const busId = Number(req.params.id);
  const { availableSeats } = req.body;
  const bus = await prisma.bus.findUnique({ where: { id: busId } });
  if (!bus) return res.status(404).json({ message: 'Bus not found' });
  if (authReq.user!.role === 'DRIVER' && bus.driverId !== authReq.user!.userId) {
    return res.status(403).json({ message: 'Not allowed to update this bus' });
  }
  const updated = await prisma.bus.update({ where: { id: busId }, data: { availableSeats: Number(availableSeats) } });
  sendBusUpdate(updated);
  res.json({ bus: updated });
});

app.put('/api/buses/:id/location', authenticate, authorize(['ADMIN', 'DRIVER']), async (req, res) => {
  const authReq = req as AuthRequest;
  const busId = Number(req.params.id);
  const { locationLat, locationLng } = req.body;
  const bus = await prisma.bus.findUnique({ where: { id: busId } });
  if (!bus) return res.status(404).json({ message: 'Bus not found' });
  if (authReq.user!.role === 'DRIVER' && bus.driverId !== authReq.user!.userId) {
    return res.status(403).json({ message: 'Not allowed to update this bus' });
  }
  const updated = await prisma.bus.update({
    where: { id: busId },
    data: { locationLat: Number(locationLat), locationLng: Number(locationLng) },
  });
  sendBusUpdate(updated);
  res.json({ bus: updated });
});

app.get('/api/bookings', authenticate, async (req, res) => {
  const authReq = req as AuthRequest;
  const user = await prisma.user.findUnique({ where: { id: authReq.user!.userId } });
  if (!user) return res.status(404).json({ message: 'User not found' });
  if (['ADMIN', 'DRIVER'].includes(user.role)) {
    const bookings = await prisma.booking.findMany({ include: { user: true, bus: true } });
    return res.json({ bookings });
  }
  const bookings = await prisma.booking.findMany({ where: { userId: user.id }, include: { bus: true } });
  res.json({ bookings });
});

app.post('/api/bookings', authenticate, authorize(['STUDENT', 'TEACHER']), async (req, res) => {
  const authReq = req as AuthRequest;
  const { busId, pickup, dropoff, date, time } = req.body;
  if (!busId || !pickup || !dropoff || !date || !time) {
    return res.status(400).json({ message: 'Missing fields' });
  }

  const bus = await prisma.bus.findUnique({ where: { id: Number(busId) } });
  if (!bus) return res.status(404).json({ message: 'Bus not found' });

  const booking = await prisma.booking.create({
    data: {
      userId: authReq.user!.userId,
      busId: bus.id,
      pickup,
      dropoff,
      date,
      time,
    },
  });
  sendBookingUpdate({ ...booking, userId: authReq.user!.userId, busId: bus.id });
  res.json({ booking });
});

app.put('/api/bookings/:id/status', authenticate, authorize(['ADMIN', 'DRIVER']), async (req, res) => {
  const authReq = req as AuthRequest;
  const bookingId = Number(req.params.id);
  const { status } = req.body;
  if (!['APPROVED', 'REJECTED'].includes(status)) {
    return res.status(400).json({ message: 'Invalid status' });
  }

  const booking = await prisma.booking.findUnique({ where: { id: bookingId }, include: { bus: true } });
  if (!booking) return res.status(404).json({ message: 'Booking not found' });
  if (authReq.user!.role === 'DRIVER' && booking.bus.driverId !== authReq.user!.userId) {
    return res.status(403).json({ message: 'Not allowed to update this booking' });
  }

  const updated = await prisma.booking.update({ where: { id: bookingId }, data: { status } });
  sendBookingUpdate(updated);
  res.json({ booking: updated });
});

app.put('/api/users/:id/password-reset', authenticate, authorize(['ADMIN']), async (req, res) => {
  const id = Number(req.params.id);
  const { password } = req.body;
  if (!password) return res.status(400).json({ message: 'Password is required' });
  const hashed = await bcrypt.hash(password, 10);
  const user = await prisma.user.update({ where: { id }, data: { password: hashed } });
  res.json({ user });
});

io.on('connection', (socket) => {
  console.log('Client connected', socket.id);
  socket.on('disconnect', () => {
    console.log('Client disconnected', socket.id);
  });
});

const port = Number(process.env.PORT || 4000);

createDefaultAdmin().then(() => {
  server.listen(port, () => {
    console.log(`Backend running on http://localhost:${port}`);
  });
});

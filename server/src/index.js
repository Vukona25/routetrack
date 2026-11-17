require('dotenv').config();
const crypto = require('crypto');
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('./db');
const { requireAuth, requireRole } = require('./auth');

if (!process.env.JWT_SECRET) {
  console.error('JWT_SECRET is missing. Copy .env.example to .env and set it.');
  process.exit(1);
}

const app = express();
app.use(cors({ origin: process.env.CLIENT_ORIGIN || 'http://localhost:5173' }));
app.use(express.json());

const STATUSES = ['pending', 'in_transit', 'delivered'];
const NEXT_STATUS = { pending: 'in_transit', in_transit: 'delivered' };

const wrap = (fn) => (req, res, next) => fn(req, res, next).catch(next);

async function findDelivery(id) {
  const [rows] = await pool.query(
    `SELECT d.*, u.name AS driver_name
     FROM deliveries d
     LEFT JOIN users u ON u.id = d.driver_id
     WHERE d.id = ?`,
    [id]
  );
  return rows[0];
}

async function logEvent(deliveryId, status, userId, note) {
  await pool.query(
    'INSERT INTO delivery_events (delivery_id, status, changed_by, note) VALUES (?, ?, ?, ?)',
    [deliveryId, status, userId, note || null]
  );
}

function canSee(user, delivery) {
  return user.role === 'dispatcher' || delivery.driver_id === user.id;
}

// ---------- Health ----------
app.get('/api/health', (req, res) => res.json({ ok: true }));

// ---------- Auth ----------
app.post('/api/auth/login', wrap(async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  const [rows] = await pool.query('SELECT * FROM users WHERE email = ?', [email.toLowerCase().trim()]);
  const user = rows[0];
  if (!user || !(await bcrypt.compare(password, user.password_hash))) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }

  const payload = { id: user.id, name: user.name, email: user.email, role: user.role };
  const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '8h' });
  res.json({ token, user: payload });
}));

app.get('/api/auth/me', requireAuth, (req, res) => {
  const { id, name, email, role } = req.user;
  res.json({ user: { id, name, email, role } });
});

// ---------- Drivers (dispatcher only) ----------
app.get('/api/drivers', requireAuth, requireRole('dispatcher'), wrap(async (req, res) => {
  const [rows] = await pool.query(
    "SELECT id, name, email FROM users WHERE role = 'driver' ORDER BY name"
  );
  res.json(rows);
}));

app.post('/api/drivers', requireAuth, requireRole('dispatcher'), wrap(async (req, res) => {
  const { name, email, password } = req.body || {};
  if (!name?.trim() || !email?.trim() || !password || password.length < 6) {
    return res.status(400).json({ error: 'Name, email and a password of at least 6 characters are required' });
  }

  const hash = await bcrypt.hash(password, 10);
  try {
    const [result] = await pool.query(
      "INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, 'driver')",
      [name.trim(), email.toLowerCase().trim(), hash]
    );
    res.status(201).json({ id: result.insertId, name: name.trim(), email: email.toLowerCase().trim() });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'A user with that email already exists' });
    }
    throw err;
  }
}));

// ---------- Stats ----------
app.get('/api/stats', requireAuth, wrap(async (req, res) => {
  const params = [];
  let where = '';
  if (req.user.role === 'driver') {
    where = 'WHERE driver_id = ?';
    params.push(req.user.id);
  }

  const [rows] = await pool.query(
    `SELECT status, COUNT(*) AS count FROM deliveries ${where} GROUP BY status`,
    params
  );

  const stats = { pending: 0, in_transit: 0, delivered: 0 };
  rows.forEach((r) => { stats[r.status] = Number(r.count); });
  stats.total = stats.pending + stats.in_transit + stats.delivered;
  res.json(stats);
}));

// ---------- Deliveries ----------
app.get('/api/deliveries', requireAuth, wrap(async (req, res) => {
  const { status, driverId, search } = req.query;
  const where = [];
  const params = [];

  if (req.user.role === 'driver') {
    where.push('d.driver_id = ?');
    params.push(req.user.id);
  } else if (driverId === 'unassigned') {
    where.push('d.driver_id IS NULL');
  } else if (driverId) {
    where.push('d.driver_id = ?');
    params.push(Number(driverId));
  }

  if (status && STATUSES.includes(status)) {
    where.push('d.status = ?');
    params.push(status);
  }

  if (search) {
    where.push('(d.tracking_code LIKE ? OR d.customer_name LIKE ? OR d.dropoff_address LIKE ?)');
    const term = `%${search}%`;
    params.push(term, term, term);
  }

  const [rows] = await pool.query(
    `SELECT d.*, u.name AS driver_name
     FROM deliveries d
     LEFT JOIN users u ON u.id = d.driver_id
     ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
     ORDER BY d.updated_at DESC`,
    params
  );
  res.json(rows);
}));

app.post('/api/deliveries', requireAuth, requireRole('dispatcher'), wrap(async (req, res) => {
  const { customerName, customerPhone, pickupAddress, dropoffAddress, notes, driverId } = req.body || {};
  if (!customerName?.trim() || !pickupAddress?.trim() || !dropoffAddress?.trim()) {
    return res.status(400).json({ error: 'Customer name, pickup and drop-off address are required' });
  }

  let assignedId = null;
  if (driverId) {
    const [drivers] = await pool.query("SELECT id FROM users WHERE id = ? AND role = 'driver'", [driverId]);
    if (!drivers.length) return res.status(400).json({ error: 'Driver not found' });
    assignedId = drivers[0].id;
  }

  const code = 'DLV-' + crypto.randomBytes(3).toString('hex').toUpperCase();
  const [result] = await pool.query(
    `INSERT INTO deliveries
      (tracking_code, customer_name, customer_phone, pickup_address, dropoff_address, notes, driver_id, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      code,
      customerName.trim(),
      customerPhone?.trim() || null,
      pickupAddress.trim(),
      dropoffAddress.trim(),
      notes?.trim() || null,
      assignedId,
      req.user.id,
    ]
  );

  await logEvent(result.insertId, 'pending', req.user.id, 'Delivery created');
  res.status(201).json(await findDelivery(result.insertId));
}));

app.patch('/api/deliveries/:id/assign', requireAuth, requireRole('dispatcher'), wrap(async (req, res) => {
  const delivery = await findDelivery(req.params.id);
  if (!delivery) return res.status(404).json({ error: 'Delivery not found' });
  if (delivery.status === 'delivered') {
    return res.status(400).json({ error: 'Delivered orders cannot be reassigned' });
  }

  const { driverId } = req.body || {};
  let driver = null;

  if (driverId) {
    const [rows] = await pool.query("SELECT id, name FROM users WHERE id = ? AND role = 'driver'", [driverId]);
    driver = rows[0];
    if (!driver) return res.status(400).json({ error: 'Driver not found' });
  } else if (delivery.status === 'in_transit') {
    return res.status(400).json({ error: 'A delivery in transit must keep a driver' });
  }

  await pool.query('UPDATE deliveries SET driver_id = ? WHERE id = ?', [driver ? driver.id : null, delivery.id]);
  await logEvent(delivery.id, delivery.status, req.user.id, driver ? `Assigned to ${driver.name}` : 'Unassigned');
  res.json(await findDelivery(delivery.id));
}));

app.patch('/api/deliveries/:id/status', requireAuth, wrap(async (req, res) => {
  const delivery = await findDelivery(req.params.id);
  if (!delivery || !canSee(req.user, delivery)) {
    return res.status(404).json({ error: 'Delivery not found' });
  }

  const { status, note } = req.body || {};
  if (NEXT_STATUS[delivery.status] !== status) {
    return res.status(400).json({ error: `Cannot change status from ${delivery.status} to ${status}` });
  }
  if (!delivery.driver_id) {
    return res.status(400).json({ error: 'Assign a driver before updating the status' });
  }

  await pool.query('UPDATE deliveries SET status = ? WHERE id = ?', [status, delivery.id]);
  await logEvent(delivery.id, status, req.user.id, note?.trim() || null);
  res.json(await findDelivery(delivery.id));
}));

app.get('/api/deliveries/:id/events', requireAuth, wrap(async (req, res) => {
  const delivery = await findDelivery(req.params.id);
  if (!delivery || !canSee(req.user, delivery)) {
    return res.status(404).json({ error: 'Delivery not found' });
  }

  const [rows] = await pool.query(
    `SELECT e.id, e.status, e.note, e.created_at, u.name AS changed_by_name
     FROM delivery_events e
     JOIN users u ON u.id = e.changed_by
     WHERE e.delivery_id = ?
     ORDER BY e.created_at ASC, e.id ASC`,
    [delivery.id]
  );
  res.json(rows);
}));

// ---------- Errors ----------
app.use((req, res) => res.status(404).json({ error: 'Route not found' }));

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Something went wrong on the server' });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`RouteTrack API running on http://localhost:${PORT}`));

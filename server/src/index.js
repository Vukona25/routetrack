require('dotenv').config();
const crypto = require('crypto');
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { pool, ensureSchema } = require('./db');
const { requireAuth, requireRole } = require('./auth');
const { geocode, getRoute } = require('./geo');

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

const DELIVERY_SELECT = `
  SELECT d.*,
         u.name AS driver_name,
         u.last_lat AS driver_lat,
         u.last_lng AS driver_lng,
         u.location_updated_at AS driver_location_at
  FROM deliveries d
  LEFT JOIN users u ON u.id = d.driver_id`;

async function findDelivery(id) {
  const [rows] = await pool.query(`${DELIVERY_SELECT} WHERE d.id = ?`, [id]);
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

function pointOf(delivery, which) {
  const lat = delivery[`${which}_lat`];
  const lng = delivery[`${which}_lng`];
  return lat != null && lng != null ? { lat: Number(lat), lng: Number(lng) } : null;
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

// ---------- Drivers ----------
app.get('/api/drivers', requireAuth, requireRole('dispatcher'), wrap(async (req, res) => {
  const [rows] = await pool.query(
    `SELECT u.id, u.name, u.email, u.last_lat, u.last_lng, u.location_updated_at,
            SUM(d.status IN ('pending', 'in_transit')) AS active_count,
            SUM(d.status = 'delivered') AS delivered_count
     FROM users u
     LEFT JOIN deliveries d ON d.driver_id = u.id
     WHERE u.role = 'driver'
     GROUP BY u.id, u.name, u.email, u.last_lat, u.last_lng, u.location_updated_at
     ORDER BY u.name`
  );
  res.json(rows.map((r) => ({
    ...r,
    active_count: Number(r.active_count || 0),
    delivered_count: Number(r.delivered_count || 0),
  })));
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

// A driver's phone or laptop sends its position while location sharing is on
app.post('/api/me/location', requireAuth, requireRole('driver'), wrap(async (req, res) => {
  const lat = Number(req.body?.lat);
  const lng = Number(req.body?.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
    return res.status(400).json({ error: 'A valid latitude and longitude are required' });
  }
  await pool.query(
    'UPDATE users SET last_lat = ?, last_lng = ?, location_updated_at = NOW() WHERE id = ?',
    [lat, lng, req.user.id]
  );
  res.json({ ok: true });
}));

// ---------- Stats ----------
app.get('/api/stats', requireAuth, wrap(async (req, res) => {
  const params = [];
  let where = '';
  if (req.user.role === 'driver') {
    where = 'WHERE driver_id = ?';
    params.push(req.user.id);
  }

  const [[row]] = await pool.query(
    `SELECT COUNT(*) AS total,
            SUM(status = 'pending') AS pending,
            SUM(status = 'in_transit') AS in_transit,
            SUM(status = 'delivered') AS delivered,
            SUM(status = 'delivered' AND DATE(updated_at) = CURDATE()) AS delivered_today,
            SUM(status <> 'delivered' AND driver_id IS NULL) AS unassigned
     FROM deliveries ${where}`,
    params
  );

  const stats = {};
  for (const [key, value] of Object.entries(row)) stats[key] = Number(value || 0);
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

  if (status === 'active') {
    where.push("d.status IN ('pending', 'in_transit')");
  } else if (status && STATUSES.includes(status)) {
    where.push('d.status = ?');
    params.push(status);
  }

  if (search) {
    where.push('(d.tracking_code LIKE ? OR d.customer_name LIKE ? OR d.pickup_address LIKE ? OR d.dropoff_address LIKE ?)');
    const term = `%${search}%`;
    params.push(term, term, term, term);
  }

  const [rows] = await pool.query(
    `${DELIVERY_SELECT}
     ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
     ORDER BY FIELD(d.status, 'in_transit', 'pending', 'delivered'), d.updated_at DESC`,
    params
  );
  res.json(rows);
}));

app.get('/api/deliveries/:id', requireAuth, wrap(async (req, res) => {
  const delivery = await findDelivery(req.params.id);
  if (!delivery || !canSee(req.user, delivery)) {
    return res.status(404).json({ error: 'Delivery not found' });
  }
  res.json(delivery);
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

  // Put both addresses on the map. If one can't be found the delivery is still saved.
  const pickup = await geocode(pickupAddress.trim());
  const dropoff = await geocode(dropoffAddress.trim());

  const code = 'DLV-' + crypto.randomBytes(3).toString('hex').toUpperCase();
  const [result] = await pool.query(
    `INSERT INTO deliveries
      (tracking_code, customer_name, customer_phone,
       pickup_address, pickup_lat, pickup_lng,
       dropoff_address, dropoff_lat, dropoff_lng,
       notes, driver_id, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      code,
      customerName.trim(),
      customerPhone?.trim() || null,
      pickupAddress.trim(), pickup?.lat ?? null, pickup?.lng ?? null,
      dropoffAddress.trim(), dropoff?.lat ?? null, dropoff?.lng ?? null,
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

// Try the map lookup again (for example after an address was not found)
app.patch('/api/deliveries/:id/locate', requireAuth, requireRole('dispatcher'), wrap(async (req, res) => {
  const delivery = await findDelivery(req.params.id);
  if (!delivery) return res.status(404).json({ error: 'Delivery not found' });

  const pickup = pointOf(delivery, 'pickup') || await geocode(delivery.pickup_address, { fresh: true });
  const dropoff = pointOf(delivery, 'dropoff') || await geocode(delivery.dropoff_address, { fresh: true });

  await pool.query(
    'UPDATE deliveries SET pickup_lat = ?, pickup_lng = ?, dropoff_lat = ?, dropoff_lng = ? WHERE id = ?',
    [pickup?.lat ?? null, pickup?.lng ?? null, dropoff?.lat ?? null, dropoff?.lng ?? null, delivery.id]
  );

  if (!pickup || !dropoff) {
    const missing = !pickup && !dropoff ? 'either address' : !pickup ? 'the pickup address' : 'the drop-off address';
    return res.status(422).json({ error: `Still couldn't find ${missing} on the map. Try adding the suburb and city.` });
  }
  res.json(await findDelivery(delivery.id));
}));

// Driving route between pickup and drop-off (for the map line, distance and ETA)
app.get('/api/deliveries/:id/route', requireAuth, wrap(async (req, res) => {
  const delivery = await findDelivery(req.params.id);
  if (!delivery || !canSee(req.user, delivery)) {
    return res.status(404).json({ error: 'Delivery not found' });
  }

  const from = pointOf(delivery, 'pickup');
  const to = pointOf(delivery, 'dropoff');
  if (!from || !to) {
    return res.status(422).json({ error: 'This delivery is not on the map yet' });
  }
  res.json(await getRoute(from, to));
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
     ORDER BY e.created_at DESC, e.id DESC`,
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

ensureSchema()
  .then(() => {
    app.listen(PORT, () => console.log(`RouteTrack API running on http://localhost:${PORT}`));
  })
  .catch((err) => {
    console.error(`Could not prepare the database: ${err.message}`);
    process.exit(1);
  });

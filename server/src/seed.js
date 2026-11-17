require('dotenv').config();
const bcrypt = require('bcryptjs');
const { pool, ensureSchema } = require('./db');

// Approximate map positions for the demo addresses (Gauteng)
const PLACES = {
  'Tembisa Mall, Tembisa': [-25.9993, 28.2246],
  'Winnie Mandela, Tembisa': [-25.956, 28.237],
  'Mall of Africa, Midrand': [-26.0153, 28.1062],
  'Sandton City, Sandton': [-26.1076, 28.0526],
  'Kempton Park CBD': [-26.102, 28.231],
  'OR Tambo International Airport': [-26.1337, 28.242],
  'Ivory Park, Midrand': [-25.993, 28.188],
  'Rhodesfield, Kempton Park': [-26.125, 28.225],
};

const SAMPLES = [
  ['DLV-1001', 'Nomsa Dlamini', '0711234567', 'Tembisa Mall, Tembisa', 'Winnie Mandela, Tembisa', 'pending', null],
  ['DLV-1002', 'Kagiso Motsepe', '0829876543', 'Mall of Africa, Midrand', 'Sandton City, Sandton', 'in_transit', 'sipho@demo.com'],
  ['DLV-1003', 'Ayanda Khumalo', '0735551234', 'Kempton Park CBD', 'OR Tambo International Airport', 'delivered', 'lerato@demo.com'],
  ['DLV-1004', 'Pieter van Wyk', '0614447788', 'Ivory Park, Midrand', 'Rhodesfield, Kempton Park', 'pending', 'sipho@demo.com'],
];

// Where the demo drivers "are" so the live map has something to show
const DRIVER_POSITIONS = {
  'sipho@demo.com': [-26.0552, 28.0835], // on the N1 between Midrand and Sandton
  'lerato@demo.com': [-26.1105, 28.2338], // near Kempton Park
};

async function seed() {
  await ensureSchema();
  const hash = await bcrypt.hash('password123', 10);

  const users = [
    ['Thandi Dispatcher', 'dispatcher@demo.com', 'dispatcher'],
    ['Sipho Driver', 'sipho@demo.com', 'driver'],
    ['Lerato Driver', 'lerato@demo.com', 'driver'],
  ];

  for (const [name, email, role] of users) {
    await pool.query(
      `INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE name = VALUES(name)`,
      [name, email, hash, role]
    );
  }

  for (const [email, [lat, lng]] of Object.entries(DRIVER_POSITIONS)) {
    await pool.query(
      `UPDATE users SET last_lat = ?, last_lng = ?, location_updated_at = NOW()
       WHERE email = ? AND last_lat IS NULL`,
      [lat, lng, email]
    );
  }

  const [userRows] = await pool.query('SELECT id, email FROM users');
  const idOf = Object.fromEntries(userRows.map((u) => [u.email, u.id]));
  const dispatcherId = idOf['dispatcher@demo.com'];

  const [[{ count }]] = await pool.query('SELECT COUNT(*) AS count FROM deliveries');

  if (Number(count) === 0) {
    for (const [code, customer, phone, pickup, dropoff, status, driverEmail] of SAMPLES) {
      const driverId = driverEmail ? idOf[driverEmail] : null;
      const [pLat, pLng] = PLACES[pickup];
      const [dLat, dLng] = PLACES[dropoff];
      const [result] = await pool.query(
        `INSERT INTO deliveries
          (tracking_code, customer_name, customer_phone,
           pickup_address, pickup_lat, pickup_lng,
           dropoff_address, dropoff_lat, dropoff_lng,
           status, driver_id, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [code, customer, phone, pickup, pLat, pLng, dropoff, dLat, dLng, status, driverId, dispatcherId]
      );

      const id = result.insertId;
      const addEvent = (s, by, note) => pool.query(
        'INSERT INTO delivery_events (delivery_id, status, changed_by, note) VALUES (?, ?, ?, ?)',
        [id, s, by, note]
      );
      await addEvent('pending', dispatcherId, 'Delivery created');
      if (status !== 'pending') await addEvent('in_transit', driverId, 'Picked up, on the way');
      if (status === 'delivered') await addEvent('delivered', driverId, 'Signed by customer');
    }
    console.log('Sample deliveries added.');
  } else {
    // Database seeded by the first version: give the sample deliveries map positions
    let updated = 0;
    for (const [code, , , pickup, dropoff] of SAMPLES) {
      const [pLat, pLng] = PLACES[pickup];
      const [dLat, dLng] = PLACES[dropoff];
      const [result] = await pool.query(
        `UPDATE deliveries
         SET pickup_lat = ?, pickup_lng = ?, dropoff_lat = ?, dropoff_lng = ?
         WHERE tracking_code = ? AND (pickup_lat IS NULL OR dropoff_lat IS NULL)`,
        [pLat, pLng, dLat, dLng, code]
      );
      updated += result.affectedRows;
    }
    if (updated) console.log(`Added map positions to ${updated} sample deliveries.`);
  }

  console.log('Seed complete. Log in with dispatcher@demo.com / password123');
  await pool.end();
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});

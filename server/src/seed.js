require('dotenv').config();
const bcrypt = require('bcryptjs');
const pool = require('./db');

async function seed() {
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

  const [userRows] = await pool.query('SELECT id, email FROM users');
  const idOf = Object.fromEntries(userRows.map((u) => [u.email, u.id]));
  const dispatcherId = idOf['dispatcher@demo.com'];

  const [[{ count }]] = await pool.query('SELECT COUNT(*) AS count FROM deliveries');

  if (Number(count) === 0) {
    const samples = [
      ['DLV-1001', 'Nomsa Dlamini', '0711234567', 'Tembisa Mall, Tembisa', 'Winnie Mandela, Tembisa', 'pending', null],
      ['DLV-1002', 'Kagiso Motsepe', '0829876543', 'Mall of Africa, Midrand', 'Sandton City, Sandton', 'in_transit', 'sipho@demo.com'],
      ['DLV-1003', 'Ayanda Khumalo', '0735551234', 'Kempton Park CBD', 'OR Tambo International Airport', 'delivered', 'lerato@demo.com'],
      ['DLV-1004', 'Pieter van Wyk', '0614447788', 'Ivory Park, Midrand', 'Rhodesfield, Kempton Park', 'pending', 'sipho@demo.com'],
    ];

    for (const [code, customer, phone, pickup, dropoff, status, driverEmail] of samples) {
      const driverId = driverEmail ? idOf[driverEmail] : null;
      const [result] = await pool.query(
        `INSERT INTO deliveries
          (tracking_code, customer_name, customer_phone, pickup_address, dropoff_address, status, driver_id, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [code, customer, phone, pickup, dropoff, status, driverId, dispatcherId]
      );

      const id = result.insertId;
      await pool.query(
        'INSERT INTO delivery_events (delivery_id, status, changed_by, note) VALUES (?, ?, ?, ?)',
        [id, 'pending', dispatcherId, 'Delivery created']
      );
      if (status !== 'pending') {
        await pool.query(
          'INSERT INTO delivery_events (delivery_id, status, changed_by, note) VALUES (?, ?, ?, ?)',
          [id, 'in_transit', driverId, 'Picked up']
        );
      }
      if (status === 'delivered') {
        await pool.query(
          'INSERT INTO delivery_events (delivery_id, status, changed_by, note) VALUES (?, ?, ?, ?)',
          [id, 'delivered', driverId, 'Signed by customer']
        );
      }
    }
    console.log('Sample deliveries added.');
  }

  console.log('Seed complete. Log in with dispatcher@demo.com / password123');
  await pool.end();
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});

const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'routetrack',
  waitForConnections: true,
  connectionLimit: 10,
  decimalNumbers: true, // return map coordinates as numbers, not strings
});

// Columns added after the first version. Databases created from the old
// schema.sql get them automatically when the server starts.
const NEW_COLUMNS = {
  users: {
    last_lat: 'DECIMAL(10,7) NULL',
    last_lng: 'DECIMAL(10,7) NULL',
    location_updated_at: 'TIMESTAMP NULL',
  },
  deliveries: {
    pickup_lat: 'DECIMAL(10,7) NULL',
    pickup_lng: 'DECIMAL(10,7) NULL',
    dropoff_lat: 'DECIMAL(10,7) NULL',
    dropoff_lng: 'DECIMAL(10,7) NULL',
  },
};

async function ensureSchema() {
  for (const [table, columns] of Object.entries(NEW_COLUMNS)) {
    const [rows] = await pool.query(
      `SELECT COLUMN_NAME FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?`,
      [table]
    );
    if (!rows.length) {
      throw new Error(`Table "${table}" is missing. Run server/schema.sql first.`);
    }
    const existing = new Set(rows.map((r) => r.COLUMN_NAME));
    for (const [name, definition] of Object.entries(columns)) {
      if (!existing.has(name)) {
        await pool.query(`ALTER TABLE \`${table}\` ADD COLUMN \`${name}\` ${definition}`);
        console.log(`Database updated: added ${table}.${name}`);
      }
    }
  }
}

module.exports = { pool, ensureSchema };

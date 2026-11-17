CREATE DATABASE IF NOT EXISTS routetrack;
USE routetrack;

CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(150) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('dispatcher', 'driver') NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS deliveries (
  id INT AUTO_INCREMENT PRIMARY KEY,
  tracking_code VARCHAR(20) NOT NULL UNIQUE,
  customer_name VARCHAR(100) NOT NULL,
  customer_phone VARCHAR(20),
  pickup_address VARCHAR(255) NOT NULL,
  dropoff_address VARCHAR(255) NOT NULL,
  notes TEXT,
  status ENUM('pending', 'in_transit', 'delivered') NOT NULL DEFAULT 'pending',
  driver_id INT NULL,
  created_by INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (driver_id) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (created_by) REFERENCES users(id),
  INDEX idx_status (status),
  INDEX idx_driver (driver_id)
);

CREATE TABLE IF NOT EXISTS delivery_events (
  id INT AUTO_INCREMENT PRIMARY KEY,
  delivery_id INT NOT NULL,
  status ENUM('pending', 'in_transit', 'delivered') NOT NULL,
  note VARCHAR(255),
  changed_by INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (delivery_id) REFERENCES deliveries(id) ON DELETE CASCADE,
  FOREIGN KEY (changed_by) REFERENCES users(id)
);

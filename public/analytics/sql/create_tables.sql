-- ============================================================================
-- ParkPulse Analytics — Smart Parking Business Intelligence Platform
-- MySQL 8.0 Relational Schema Definition
-- File: analytics/sql/create_tables.sql
-- ============================================================================

-- Create Database
CREATE DATABASE IF NOT EXISTS parkpulse_analytics
CHARACTER SET utf8mb4
COLLATE utf8mb4_unicode_ci;

USE parkpulse_analytics;

-- Disable foreign key checks during schema construction
SET FOREIGN_KEY_CHECKS = 0;

-- ----------------------------------------------------------------------------
-- 1. Table: parking_locations
-- ----------------------------------------------------------------------------
DROP TABLE IF EXISTS parking_locations;
CREATE TABLE parking_locations (
    location_id VARCHAR(50) NOT NULL,
    location_code VARCHAR(20) NOT NULL,
    name VARCHAR(100) NOT NULL,
    address VARCHAR(255) NOT NULL,
    city VARCHAR(50) NOT NULL DEFAULT 'New Delhi',
    category ENUM('campus', 'mall', 'techpark', 'metro', 'hospital', 'hostel') NOT NULL DEFAULT 'campus',
    total_floors INT NOT NULL DEFAULT 1,
    total_capacity INT NOT NULL DEFAULT 0,
    base_rate_car DECIMAL(10,2) NOT NULL DEFAULT 40.00,
    base_rate_bike DECIMAL(10,2) NOT NULL DEFAULT 20.00,
    base_rate_ev DECIMAL(10,2) NOT NULL DEFAULT 50.00,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT pk_locations PRIMARY KEY (location_id),
    CONSTRAINT uq_location_code UNIQUE (location_code)
) ENGINE=InnoDB;

-- ----------------------------------------------------------------------------
-- 2. Table: customers
-- ----------------------------------------------------------------------------
DROP TABLE IF EXISTS customers;
CREATE TABLE customers (
    user_id VARCHAR(50) NOT NULL,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(120) NOT NULL,
    phone VARCHAR(25) NOT NULL,
    role ENUM('USER', 'ADMIN', 'GATEKEEPER') NOT NULL DEFAULT 'USER',
    reward_points INT NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT pk_customers PRIMARY KEY (user_id),
    CONSTRAINT uq_customer_email UNIQUE (email)
) ENGINE=InnoDB;

-- ----------------------------------------------------------------------------
-- 3. Table: bookings
-- ----------------------------------------------------------------------------
DROP TABLE IF EXISTS bookings;
CREATE TABLE bookings (
    booking_id VARCHAR(50) NOT NULL,
    user_id VARCHAR(50) NOT NULL,
    location_id VARCHAR(50) NOT NULL,
    slot_id VARCHAR(50) NOT NULL,
    vehicle_number VARCHAR(30) NOT NULL,
    vehicle_type ENUM('car', 'bike', 'ev', 'truck') NOT NULL DEFAULT 'car',
    start_time DATETIME NOT NULL,
    expected_end_time DATETIME NOT NULL,
    duration_hours DECIMAL(6,2) NOT NULL DEFAULT 1.00,
    base_amount DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    surge_multiplier DECIMAL(4,2) NOT NULL DEFAULT 1.00,
    surge_amount DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    convenience_fee DECIMAL(10,2) NOT NULL DEFAULT 10.00,
    total_amount DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    status ENUM('PENDING', 'CONFIRMED', 'ACTIVE', 'COMPLETED', 'CANCELLED', 'EXPIRED', 'NO_SHOW', 'OVERSTAYED') NOT NULL DEFAULT 'CONFIRMED',
    payment_status ENUM('pending', 'paid', 'refunded', 'failed') NOT NULL DEFAULT 'paid',
    check_in_time DATETIME NULL,
    check_out_time DATETIME NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT pk_bookings PRIMARY KEY (booking_id),
    CONSTRAINT fk_bookings_user FOREIGN KEY (user_id) REFERENCES customers(user_id) ON DELETE CASCADE,
    CONSTRAINT fk_bookings_location FOREIGN KEY (location_id) REFERENCES parking_locations(location_id) ON DELETE RESTRICT
) ENGINE=InnoDB;

-- ----------------------------------------------------------------------------
-- 4. Table: parking_sessions
-- ----------------------------------------------------------------------------
DROP TABLE IF EXISTS parking_sessions;
CREATE TABLE parking_sessions (
    session_id VARCHAR(50) NOT NULL,
    booking_id VARCHAR(50) NULL,
    slot_id VARCHAR(50) NOT NULL,
    user_id VARCHAR(50) NULL,
    vehicle_number VARCHAR(30) NOT NULL,
    entry_time DATETIME NOT NULL,
    exit_time DATETIME NULL,
    expected_exit_time DATETIME NOT NULL,
    duration_minutes INT NOT NULL DEFAULT 0,
    overstay_duration_minutes INT NOT NULL DEFAULT 0,
    overstay_fee DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    total_billed DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    status ENUM('ACTIVE', 'COMPLETED', 'OVERSTAYED', 'CANCELLED') NOT NULL DEFAULT 'ACTIVE',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT pk_parking_sessions PRIMARY KEY (session_id),
    CONSTRAINT fk_sessions_booking FOREIGN KEY (booking_id) REFERENCES bookings(booking_id) ON DELETE SET NULL,
    CONSTRAINT fk_sessions_user FOREIGN KEY (user_id) REFERENCES customers(user_id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- Re-enable foreign key checks
SET FOREIGN_KEY_CHECKS = 1;

-- ----------------------------------------------------------------------------
-- Performance Indexes for Syllabus Analytical Queries
-- ----------------------------------------------------------------------------
CREATE INDEX idx_bookings_user_id ON bookings(user_id);
CREATE INDEX idx_bookings_location_status ON bookings(location_id, status);
CREATE INDEX idx_bookings_start_time ON bookings(start_time);
CREATE INDEX idx_bookings_vehicle_type ON bookings(vehicle_type);
CREATE INDEX idx_sessions_entry_time ON parking_sessions(entry_time);
CREATE INDEX idx_sessions_status ON parking_sessions(status);

-- ----------------------------------------------------------------------------
-- Verification Query
-- ----------------------------------------------------------------------------
SHOW TABLES;
DESCRIBE parking_locations;
DESCRIBE customers;
DESCRIBE bookings;
DESCRIBE parking_sessions;

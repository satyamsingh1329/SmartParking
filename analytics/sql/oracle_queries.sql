-- ============================================================================
-- ParkPulse Analytics — Smart Parking Business Intelligence Platform
-- Tested Oracle Database 19c / 21c / 23ai Syllabus Practical Laboratory Suite
-- File: analytics/sql/oracle_queries.sql
-- ============================================================================
-- Notice on Oracle Syntax Differences from MySQL:
-- 1. Data Types: VARCHAR2 instead of VARCHAR, NUMBER(p,s) instead of DECIMAL/INT,
--    TIMESTAMP WITH LOCAL TIME ZONE instead of DATETIME.
-- 2. Limiting Rows: FETCH FIRST n ROWS ONLY instead of LIMIT n.
-- 3. String Concatenation: || operator instead of CONCAT() with multiple arguments.
-- 4. Null Handling: NVL() or COALESCE() instead of IFNULL().
-- 5. Date Operations: TO_CHAR() and NUMTODSINTERVAL() instead of DATE_FORMAT() / INTERVAL.
-- 6. Boolean Values: Represented as NUMBER(1) CHECK (col IN (0, 1)).
-- ============================================================================

-- ============================================================================
-- ORACLE DDL: SCHEMA CREATION
-- ============================================================================

-- 1. Table: parking_locations
BEGIN
   EXECUTE IMMEDIATE 'DROP TABLE parking_sessions CASCADE CONSTRAINTS';
   EXECUTE IMMEDIATE 'DROP TABLE bookings CASCADE CONSTRAINTS';
   EXECUTE IMMEDIATE 'DROP TABLE customers CASCADE CONSTRAINTS';
   EXECUTE IMMEDIATE 'DROP TABLE parking_locations CASCADE CONSTRAINTS';
EXCEPTION
   WHEN OTHERS THEN
      IF SQLCODE != -942 THEN
         RAISE;
      END IF;
END;
/

CREATE TABLE parking_locations (
    location_id VARCHAR2(50) NOT NULL,
    location_code VARCHAR2(20) NOT NULL,
    name VARCHAR2(100) NOT NULL,
    address VARCHAR2(255) NOT NULL,
    city VARCHAR2(50) DEFAULT 'New Delhi' NOT NULL,
    category VARCHAR2(20) DEFAULT 'campus' NOT NULL,
    total_floors NUMBER(3) DEFAULT 1 NOT NULL,
    total_capacity NUMBER(6) DEFAULT 0 NOT NULL,
    base_rate_car NUMBER(10,2) DEFAULT 40.00 NOT NULL,
    base_rate_bike NUMBER(10,2) DEFAULT 20.00 NOT NULL,
    base_rate_ev NUMBER(10,2) DEFAULT 50.00 NOT NULL,
    is_active NUMBER(1) DEFAULT 1 NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT pk_locations PRIMARY KEY (location_id),
    CONSTRAINT uq_location_code UNIQUE (location_code),
    CONSTRAINT chk_loc_category CHECK (category IN ('campus', 'mall', 'techpark', 'metro', 'hospital', 'hostel')),
    CONSTRAINT chk_loc_active CHECK (is_active IN (0, 1))
);

-- 2. Table: customers
CREATE TABLE customers (
    user_id VARCHAR2(50) NOT NULL,
    name VARCHAR2(100) NOT NULL,
    email VARCHAR2(120) NOT NULL,
    phone VARCHAR2(25) NOT NULL,
    role VARCHAR2(20) DEFAULT 'USER' NOT NULL,
    reward_points NUMBER(8) DEFAULT 0 NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT pk_customers PRIMARY KEY (user_id),
    CONSTRAINT uq_customer_email UNIQUE (email),
    CONSTRAINT chk_cust_role CHECK (role IN ('USER', 'ADMIN', 'GATEKEEPER'))
);

-- 3. Table: bookings
CREATE TABLE bookings (
    booking_id VARCHAR2(50) NOT NULL,
    user_id VARCHAR2(50) NOT NULL,
    location_id VARCHAR2(50) NOT NULL,
    slot_id VARCHAR2(50) NOT NULL,
    vehicle_number VARCHAR2(30) NOT NULL,
    vehicle_type VARCHAR2(20) DEFAULT 'car' NOT NULL,
    start_time TIMESTAMP NOT NULL,
    expected_end_time TIMESTAMP NOT NULL,
    duration_hours NUMBER(6,2) DEFAULT 1.00 NOT NULL,
    base_amount NUMBER(10,2) DEFAULT 0.00 NOT NULL,
    surge_multiplier NUMBER(4,2) DEFAULT 1.00 NOT NULL,
    surge_amount NUMBER(10,2) DEFAULT 0.00 NOT NULL,
    convenience_fee NUMBER(10,2) DEFAULT 10.00 NOT NULL,
    total_amount NUMBER(10,2) DEFAULT 0.00 NOT NULL,
    status VARCHAR2(20) DEFAULT 'CONFIRMED' NOT NULL,
    payment_status VARCHAR2(20) DEFAULT 'paid' NOT NULL,
    check_in_time TIMESTAMP NULL,
    check_out_time TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT pk_bookings PRIMARY KEY (booking_id),
    CONSTRAINT fk_bookings_user FOREIGN KEY (user_id) REFERENCES customers(user_id) ON DELETE CASCADE,
    CONSTRAINT fk_bookings_loc FOREIGN KEY (location_id) REFERENCES parking_locations(location_id),
    CONSTRAINT chk_vehicle_type CHECK (vehicle_type IN ('car', 'bike', 'ev', 'truck')),
    CONSTRAINT chk_booking_status CHECK (status IN ('PENDING', 'CONFIRMED', 'ACTIVE', 'COMPLETED', 'CANCELLED', 'EXPIRED', 'NO_SHOW', 'OVERSTAYED'))
);

-- 4. Table: parking_sessions
CREATE TABLE parking_sessions (
    session_id VARCHAR2(50) NOT NULL,
    booking_id VARCHAR2(50) NULL,
    slot_id VARCHAR2(50) NOT NULL,
    user_id VARCHAR2(50) NULL,
    vehicle_number VARCHAR2(30) NOT NULL,
    entry_time TIMESTAMP NOT NULL,
    exit_time TIMESTAMP NULL,
    expected_exit_time TIMESTAMP NOT NULL,
    duration_minutes NUMBER(8) DEFAULT 0 NOT NULL,
    overstay_duration_minutes NUMBER(8) DEFAULT 0 NOT NULL,
    overstay_fee NUMBER(10,2) DEFAULT 0.00 NOT NULL,
    total_billed NUMBER(10,2) DEFAULT 0.00 NOT NULL,
    status VARCHAR2(20) DEFAULT 'ACTIVE' NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT pk_sessions PRIMARY KEY (session_id),
    CONSTRAINT chk_session_status CHECK (status IN ('ACTIVE', 'COMPLETED', 'DISPUTED'))
);

-- ============================================================================
-- PART 1: DDL & DML DEMONSTRATION COMMANDS (ORACLE)
-- ============================================================================

-- 1.1 DDL: ALTER TABLE (Add audit flag column)
ALTER TABLE bookings ADD (audit_flag VARCHAR2(50) DEFAULT 'STANDARD');

-- 1.2 DDL: DROP COLUMN (Clean up demo column)
ALTER TABLE bookings DROP COLUMN audit_flag;

-- 1.3 DML: INSERT (Safe demonstration insertion)
INSERT INTO parking_locations (
    location_id, location_code, name, address, city, category, total_floors, total_capacity,
    base_rate_car, base_rate_bike, base_rate_ev, is_active
) VALUES (
    'LOC-999', 'TEST_HUB', 'Demonstration Sandbox Depot', 'Sector 62 Institutional Area',
    'Noida', 'campus', 2, 50, 30.00, 15.00, 40.00, 0
);

-- 1.4 DML: UPDATE
UPDATE parking_locations 
SET base_rate_car = 35.00, total_capacity = 60 
WHERE location_id = 'LOC-999';

-- 1.5 DML: DELETE
DELETE FROM parking_locations 
WHERE location_id = 'LOC-999';
COMMIT;


-- ============================================================================
-- PART 2: THE 10 MASTER SYLLABUS BUSINESS EXPERIMENTS (ORACLE SQL)
-- ============================================================================

-- ----------------------------------------------------------------------------
-- EXPERIMENT 1: Total Revenue by Parking Facility
-- Syllabus Topic: Aggregate Functions & Multi-Table Joins
-- ----------------------------------------------------------------------------
SELECT 
    l.location_id,
    l.name AS facility_name,
    l.city,
    COUNT(b.booking_id) AS total_bookings,
    SUM(CASE WHEN b.status = 'COMPLETED' THEN 1 ELSE 0 END) AS completed_bookings,
    ROUND(SUM(CASE WHEN b.status IN ('CONFIRMED', 'ACTIVE', 'COMPLETED') THEN b.total_amount ELSE 0 END), 2) AS total_revenue,
    ROUND(AVG(CASE WHEN b.status = 'COMPLETED' THEN b.total_amount ELSE NULL END), 2) AS avg_revenue_per_completed
FROM parking_locations l
LEFT JOIN bookings b ON l.location_id = b.location_id
GROUP BY l.location_id, l.name, l.city
ORDER BY total_revenue DESC;

-- ----------------------------------------------------------------------------
-- EXPERIMENT 2: Booking Count & Revenue by Vehicle Category
-- Syllabus Topic: GROUP BY, Conditional Aggregations & Sorting
-- ----------------------------------------------------------------------------
SELECT 
    vehicle_type,
    COUNT(*) AS total_reservations,
    SUM(CASE WHEN status = 'COMPLETED' THEN 1 ELSE 0 END) AS completed_reservations,
    ROUND(SUM(CASE WHEN status IN ('CONFIRMED', 'ACTIVE', 'COMPLETED') THEN total_amount ELSE 0 END), 2) AS gross_revenue,
    ROUND(AVG(duration_hours), 2) AS avg_duration_hours,
    ROUND(AVG(total_amount), 2) AS avg_ticket_size
FROM bookings
GROUP BY vehicle_type
ORDER BY gross_revenue DESC;

-- ----------------------------------------------------------------------------
-- EXPERIMENT 3: Average Parking Duration & Physical Dwell Analysis
-- Syllabus Topic: Single-Row Date Conversion & Mathematical Aggregation
-- ----------------------------------------------------------------------------
SELECT 
    COUNT(session_id) AS total_completed_sessions,
    ROUND(AVG(duration_minutes), 1) AS mean_duration_minutes,
    ROUND(AVG(duration_minutes) / 60, 2) AS mean_duration_hours,
    MIN(duration_minutes) AS min_duration_minutes,
    MAX(duration_minutes) AS max_duration_minutes,
    SUM(overstay_duration_minutes) AS total_overstay_minutes_billed,
    ROUND(SUM(overstay_fee), 2) AS total_overstay_penalties_collected
FROM parking_sessions
WHERE status = 'COMPLETED' AND exit_time IS NOT NULL;

-- ----------------------------------------------------------------------------
-- EXPERIMENT 4: Daily and Monthly Revenue Progression
-- Syllabus Topic: Time Series Grouping & Oracle Date Formatting (TO_CHAR)
-- ----------------------------------------------------------------------------
SELECT 
    TO_CHAR(start_time, 'YYYY-MM') AS booking_month,
    TO_CHAR(start_time, 'YYYY-MM-DD') AS booking_date,
    TRIM(TO_CHAR(start_time, 'DAY')) AS day_of_week,
    COUNT(booking_id) AS total_bookings_initiated,
    SUM(CASE WHEN status = 'COMPLETED' THEN 1 ELSE 0 END) AS completed_count,
    ROUND(SUM(CASE WHEN status IN ('CONFIRMED', 'ACTIVE', 'COMPLETED') THEN total_amount ELSE 0 END), 2) AS daily_revenue
FROM bookings
GROUP BY TO_CHAR(start_time, 'YYYY-MM'), TO_CHAR(start_time, 'YYYY-MM-DD'), TO_CHAR(start_time, 'DAY')
ORDER BY booking_date DESC
FETCH FIRST 10 ROWS ONLY;

-- ----------------------------------------------------------------------------
-- EXPERIMENT 5: Highest-Revenue Parking Facilities (Analytic Rank)
-- Syllabus Topic: Window Functions: RANK() OVER (ORDER BY ...)
-- ----------------------------------------------------------------------------
SELECT 
    l.location_id,
    l.name AS facility_name,
    l.city,
    l.total_capacity,
    ROUND(SUM(b.total_amount), 2) AS total_revenue,
    RANK() OVER (ORDER BY SUM(b.total_amount) DESC) AS revenue_rank
FROM parking_locations l
INNER JOIN bookings b ON l.location_id = b.location_id
WHERE b.status IN ('CONFIRMED', 'ACTIVE', 'COMPLETED')
GROUP BY l.location_id, l.name, l.city, l.total_capacity
ORDER BY revenue_rank ASC;

-- ----------------------------------------------------------------------------
-- EXPERIMENT 6: Facilities with Zero Bookings (Heartbeat Check)
-- Syllabus Topic: Outer Joins & IS NULL Filtering
-- ----------------------------------------------------------------------------
SELECT 
    l.location_id,
    l.location_code,
    l.name AS facility_name,
    l.city,
    l.total_capacity,
    l.is_active,
    l.created_at
FROM parking_locations l
LEFT JOIN bookings b ON l.location_id = b.location_id
WHERE b.booking_id IS NULL;

-- ----------------------------------------------------------------------------
-- EXPERIMENT 7: Customers Who Have Never Placed an Order/Booking
-- Syllabus Topic: Relational LEFT JOIN & CRM Acquisition Marketing
-- ----------------------------------------------------------------------------
SELECT 
    c.user_id,
    c.name,
    c.email,
    c.phone,
    c.reward_points,
    c.created_at
FROM customers c
LEFT JOIN bookings b ON c.user_id = b.user_id
WHERE b.booking_id IS NULL
ORDER BY c.created_at DESC;

-- ----------------------------------------------------------------------------
-- EXPERIMENT 8: Bookings Exceeding Selected Duration (Dwell Audit)
-- Syllabus Topic: Numeric Filtering & Row Limiting (FETCH FIRST)
-- ----------------------------------------------------------------------------
SELECT 
    booking_id,
    user_id,
    vehicle_number,
    vehicle_type,
    duration_hours,
    total_amount,
    status,
    start_time,
    expected_end_time
FROM bookings
WHERE duration_hours > 4.0
ORDER BY duration_hours DESC
FETCH FIRST 10 ROWS ONLY;

-- ----------------------------------------------------------------------------
-- EXPERIMENT 9: Comparative Revenue, Turnover & Attrition Benchmark
-- Syllabus Topic: Multi-Dimensional Metrics & Percentage Ratios
-- ----------------------------------------------------------------------------
SELECT 
    l.location_code,
    l.name AS facility_name,
    l.total_capacity,
    COUNT(b.booking_id) AS total_reservations,
    ROUND(SUM(CASE WHEN b.status IN ('CONFIRMED', 'ACTIVE', 'COMPLETED') THEN b.total_amount ELSE 0 END), 2) AS total_revenue,
    ROUND(SUM(CASE WHEN b.status = 'COMPLETED' THEN 1 ELSE 0 END) / l.total_capacity, 2) AS turnover_per_bay,
    ROUND((SUM(CASE WHEN b.status = 'CANCELLED' THEN 1 ELSE 0 END) / COUNT(b.booking_id)) * 100, 1) AS cancellation_rate_pct
FROM parking_locations l
INNER JOIN bookings b ON l.location_id = b.location_id
GROUP BY l.location_code, l.name, l.total_capacity
ORDER BY turnover_per_bay DESC;

-- ----------------------------------------------------------------------------
-- EXPERIMENT 10: Identification of Duplicate or Suspicious Records
-- Syllabus Topic: Relational Auditing, HAVING Clauses & UNION ALL
-- ----------------------------------------------------------------------------
SELECT 
    'OVERLAPPING_RESERVATION' AS audit_rule,
    booking_id AS record_id,
    vehicle_number,
    slot_id,
    start_time,
    total_amount,
    'Vehicle booked multiple active bays at identical start timestamp' AS audit_finding
FROM bookings
WHERE (vehicle_number, start_time) IN (
    SELECT vehicle_number, start_time
    FROM bookings
    GROUP BY vehicle_number, start_time
    HAVING COUNT(*) > 1
)

UNION ALL

SELECT 
    'EXTREME_FEE_SPIKE' AS audit_rule,
    booking_id AS record_id,
    vehicle_number,
    slot_id,
    start_time,
    total_amount,
    'Fee exceeds ₹2,000 threshold (Potential manual override or tariff error)' AS audit_finding
FROM bookings
WHERE total_amount > 2000.00;


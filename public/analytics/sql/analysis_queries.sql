-- ============================================================================
-- ParkPulse Analytics — Smart Parking Business Intelligence Platform
-- Tested MySQL 8.0 Comprehensive Syllabus Analytical Queries Suite
-- File: analytics/sql/analysis_queries.sql
-- ============================================================================

USE parkpulse_analytics;

-- ============================================================================
-- PART 1: DDL & DML DEMONSTRATION COMMANDS
-- ============================================================================

-- 1.1 DDL: ALTER TABLE (Add audit column and index)
ALTER TABLE bookings 
ADD COLUMN audit_flag VARCHAR(50) DEFAULT 'STANDARD';

-- 1.2 DDL: DROP COLUMN (Clean up demonstration column)
ALTER TABLE bookings 
DROP COLUMN audit_flag;

-- 1.3 DML: INSERT (Manual single record creation)
INSERT INTO parking_locations (location_id, location_code, name, address, city, category, total_floors, total_capacity, base_rate_car, base_rate_bike, base_rate_ev, is_active)
VALUES ('LOC-999', 'TEST_HUB', 'Demonstration Sandbox Depot', 'Sector 62 Institutional Area', 'Noida', 'campus', 2, 50, 30.00, 15.00, 40.00, FALSE);

-- 1.4 DML: UPDATE (Tariff adjustment)
UPDATE parking_locations 
SET base_rate_car = 35.00, total_capacity = 60 
WHERE location_id = 'LOC-999';

-- 1.5 DML: DELETE (Remove demonstration record)
DELETE FROM parking_locations 
WHERE location_id = 'LOC-999';


-- ============================================================================
-- PART 2: SELECT, WHERE, ORDER BY & LIMIT
-- ============================================================================

-- 2.1 Basic SELECT with WHERE filtering and Multi-Column Sorting
-- Question: Retrieve all completed Electric Vehicle reservations with fees > ₹100, ordered by total amount descending.
SELECT 
    booking_id,
    vehicle_number,
    vehicle_type,
    duration_hours,
    total_amount,
    status,
    start_time
FROM bookings
WHERE vehicle_type = 'ev' 
  AND status = 'COMPLETED'
  AND total_amount > 100.00
ORDER BY total_amount DESC, start_time ASC
LIMIT 10;


-- ============================================================================
-- PART 3: SINGLE-ROW & CONVERSION FUNCTIONS
-- ============================================================================

-- 3.1 Date formatting, string concatenation, and mathematical rounding
-- Demonstrates: DATE_FORMAT, TIMESTAMPDIFF, CONCAT, COALESCE, ROUND, UPPER
SELECT 
    booking_id,
    CONCAT(UPPER(vehicle_type), ' - ', vehicle_number) AS vehicle_descriptor,
    DATE_FORMAT(start_time, '%W, %d %b %Y') AS formatted_day,
    DATE_FORMAT(start_time, '%h:%i %p') AS ingress_time,
    TIMESTAMPDIFF(MINUTE, start_time, expected_end_time) AS scheduled_minutes,
    ROUND(total_amount, 0) AS rounded_fee,
    COALESCE(DATE_FORMAT(check_in_time, '%H:%i:%s'), 'No Physical Check-In') AS barrier_scan_status
FROM bookings
ORDER BY start_time DESC
LIMIT 10;


-- ============================================================================
-- PART 4: AGGREGATE FUNCTIONS
-- ============================================================================

-- 4.1 Global summary metrics
-- Demonstrates: COUNT, SUM, AVG, MIN, MAX, STDDEV_SAMP
SELECT 
    COUNT(*) AS total_bookings_logged,
    COUNT(DISTINCT user_id) AS unique_active_customers,
    COUNT(DISTINCT location_id) AS total_facilities_utilized,
    SUM(total_amount) AS gross_total_revenue,
    ROUND(AVG(total_amount), 2) AS average_ticket_size,
    MIN(total_amount) AS lowest_fare_charged,
    MAX(total_amount) AS peak_fare_charged,
    ROUND(STDDEV_SAMP(total_amount), 2) AS standard_deviation_fare
FROM bookings
WHERE status IN ('CONFIRMED', 'ACTIVE', 'COMPLETED');


-- ============================================================================
-- PART 5: GROUP BY AND HAVING CLAUSES
-- ============================================================================

-- 5.1 Vehicle Category Performance with Filter on Aggregated Volume
-- Question: Find vehicle classes generating over ₹5,000 in completed revenue.
SELECT 
    vehicle_type,
    COUNT(*) AS total_reservations,
    SUM(CASE WHEN status = 'COMPLETED' THEN 1 ELSE 0 END) AS completed_reservations,
    SUM(total_amount) AS total_gross_revenue,
    ROUND(AVG(total_amount), 2) AS average_revenue_per_booking
FROM bookings
GROUP BY vehicle_type
HAVING total_gross_revenue > 5000.00
ORDER BY total_gross_revenue DESC;


-- ============================================================================
-- PART 6: RELATIONAL JOINS (INNER JOIN & LEFT JOIN)
-- ============================================================================

-- 6.1 Multi-Table INNER JOIN
-- Question: Detailed audit joining Bookings, Locations, and Customers with calculated session dwell.
SELECT 
    b.booking_id,
    c.name AS customer_name,
    c.email AS customer_email,
    l.name AS facility_name,
    l.city AS facility_city,
    b.vehicle_number,
    b.vehicle_type,
    b.duration_hours,
    b.total_amount,
    b.status
FROM bookings b
INNER JOIN customers c ON b.user_id = c.user_id
INNER JOIN parking_locations l ON b.location_id = l.location_id
WHERE b.status = 'COMPLETED'
ORDER BY b.total_amount DESC
LIMIT 10;

-- 6.2 LEFT JOIN: SYLLABUS REQUIREMENT — "Customers with Zero Bookings"
-- Identifies registered users who haven't completed any transactions for retention marketing.
SELECT 
    c.user_id,
    c.name,
    c.email,
    c.phone,
    c.reward_points,
    COUNT(b.booking_id) AS bookings_count
FROM customers c
LEFT JOIN bookings b ON c.user_id = b.user_id
GROUP BY c.user_id, c.name, c.email, c.phone, c.reward_points
HAVING COUNT(b.booking_id) = 0
ORDER BY c.name ASC;


-- ============================================================================
-- PART 7: SUBQUERIES (SCALAR, IN-CLAUSE, CORRELATED)
-- ============================================================================

-- 7.1 Scalar Subquery in WHERE Clause
-- Question: Find bookings whose total amount exceeds the global average booking amount.
SELECT 
    booking_id,
    user_id,
    vehicle_type,
    total_amount,
    (SELECT ROUND(AVG(total_amount), 2) FROM bookings WHERE status = 'COMPLETED') AS global_average
FROM bookings
WHERE total_amount > (SELECT AVG(total_amount) FROM bookings WHERE status = 'COMPLETED')
  AND status = 'COMPLETED'
ORDER BY total_amount DESC
LIMIT 10;

-- 7.2 Subquery with IN Operator
-- Question: Identify all customers who have booked at the 'Central City Mall & Multiplex' facility.
SELECT 
    user_id,
    name,
    email,
    reward_points
FROM customers
WHERE user_id IN (
    SELECT DISTINCT user_id 
    FROM bookings 
    WHERE location_id = (SELECT location_id FROM parking_locations WHERE location_code = 'MALL')
)
ORDER BY name ASC
LIMIT 10;

-- 7.3 Correlated Subquery
-- Question: Find customers whose highest single booking was above the average booking for their primary facility.
SELECT 
    c.user_id,
    c.name,
    b.booking_id,
    b.location_id,
    b.total_amount
FROM bookings b
INNER JOIN customers c ON b.user_id = c.user_id
WHERE b.total_amount > (
    SELECT AVG(b2.total_amount) 
    FROM bookings b2 
    WHERE b2.location_id = b.location_id
)
ORDER BY b.total_amount DESC
LIMIT 10;


-- ============================================================================
-- PART 8: SET OPERATORS (UNION & UNION ALL)
-- ============================================================================

-- 8.1 UNION ALL: Combined Activity Timeline (Reservations + Walk-In Sessions)
SELECT 
    booking_id AS reference_id,
    vehicle_number,
    'ONLINE_RESERVATION' AS interaction_source,
    total_amount AS billed_amount,
    created_at AS event_timestamp
FROM bookings
WHERE created_at >= NOW() - INTERVAL 7 DAY

UNION ALL

SELECT 
    session_id AS reference_id,
    vehicle_number,
    'GATE_BARRIER_SCAN' AS interaction_source,
    total_billed AS billed_amount,
    created_at AS event_timestamp
FROM parking_sessions
WHERE booking_id IS NULL AND created_at >= NOW() - INTERVAL 7 DAY
ORDER BY event_timestamp DESC
LIMIT 15;


-- ============================================================================
-- PART 9: CORE BUSINESS INTELLIGENCE ANALYTICAL QUESTIONS
-- ============================================================================

-- 9.1 Location-Wise Revenue, Turnover & Average Yield
-- Question: Rank all parking facilities by total collected revenue and average booking fare.
SELECT 
    l.location_id,
    l.location_code,
    l.name AS facility_name,
    l.city,
    l.total_capacity,
    COUNT(b.booking_id) AS total_bookings_count,
    SUM(CASE WHEN b.status = 'COMPLETED' THEN 1 ELSE 0 END) AS completed_count,
    ROUND(SUM(CASE WHEN b.status IN ('CONFIRMED', 'ACTIVE', 'COMPLETED') THEN b.total_amount ELSE 0 END), 2) AS total_revenue,
    ROUND(AVG(CASE WHEN b.status = 'COMPLETED' THEN b.total_amount ELSE NULL END), 2) AS avg_revenue_per_completed,
    ROUND(SUM(CASE WHEN b.status = 'COMPLETED' THEN 1 ELSE 0 END) / l.total_capacity, 2) AS bay_turnover_ratio
FROM parking_locations l
LEFT JOIN bookings b ON l.location_id = b.location_id
GROUP BY l.location_id, l.location_code, l.name, l.city, l.total_capacity
ORDER BY total_revenue DESC;

-- 9.2 Peak-Hour Ingress Velocity & Traffic Density (0 to 23 Hours)
-- Question: Breakdown ingress traffic density by hour of day for operator staffing.
SELECT 
    HOUR(start_time) AS hour_of_day,
    CONCAT(LPAD(HOUR(start_time), 2, '0'), ':00 - ', LPAD(HOUR(start_time) + 1, 2, '0'), ':00') AS time_window,
    COUNT(*) AS total_reservations_initiated,
    ROUND(SUM(total_amount), 2) AS revenue_generated,
    ROUND(AVG(duration_hours), 1) AS avg_duration_hours,
    CASE 
        WHEN HOUR(start_time) IN (9, 10, 11) THEN '🌅 Morning Commuter Surge'
        WHEN HOUR(start_time) IN (17, 18, 19, 20) THEN '🌆 Evening Retail Surge'
        WHEN HOUR(start_time) BETWEEN 0 AND 5 THEN '🌙 Low Traffic / Off-Peak'
        ELSE '☀️ Normal Daytime Traffic'
    END AS operational_period
FROM bookings
GROUP BY HOUR(start_time)
ORDER BY hour_of_day ASC;

-- 9.3 Weekday vs. Weekend Demand Analysis
-- Question: Compare weekday vs weekend booking volumes, cancellation rates, and revenue.
SELECT 
    CASE 
        WHEN DAYOFWEEK(start_time) IN (1, 7) THEN 'Weekend (Sat-Sun)'
        ELSE 'Weekday (Mon-Fri)'
    END AS day_type,
    COUNT(*) AS total_reservations,
    ROUND(SUM(CASE WHEN status IN ('CONFIRMED', 'ACTIVE', 'COMPLETED') THEN total_amount ELSE 0 END), 2) AS total_revenue,
    ROUND(AVG(total_amount), 2) AS average_fare,
    ROUND((SUM(CASE WHEN status = 'CANCELLED' THEN 1 ELSE 0 END) / COUNT(*)) * 100, 2) AS cancellation_rate_pct
FROM bookings
GROUP BY day_type;

-- 9.4 Facility Cancellation & No-Show Attrition Analysis
-- Question: Identify facilities with abnormally high attrition.
SELECT 
    l.location_code,
    l.name AS facility_name,
    COUNT(*) AS total_reservations,
    SUM(CASE WHEN b.status = 'COMPLETED' THEN 1 ELSE 0 END) AS completed_count,
    SUM(CASE WHEN b.status = 'CANCELLED' THEN 1 ELSE 0 END) AS cancelled_count,
    SUM(CASE WHEN b.status = 'NO_SHOW' THEN 1 ELSE 0 END) AS no_show_count,
    ROUND((SUM(CASE WHEN b.status = 'CANCELLED' THEN 1 ELSE 0 END) / COUNT(*)) * 100, 1) AS cancellation_rate_pct,
    ROUND((SUM(CASE WHEN b.status = 'NO_SHOW' THEN 1 ELSE 0 END) / COUNT(*)) * 100, 1) AS no_show_rate_pct
FROM bookings b
INNER JOIN parking_locations l ON b.location_id = l.location_id
GROUP BY l.location_code, l.name
ORDER BY cancellation_rate_pct DESC;

-- 9.5 Average Parking Duration & Overstay Yield by Vehicle Type
-- Question: Measure dwell time and overstay penalty fees collected across vehicle classes.
SELECT 
    b.vehicle_type,
    COUNT(s.session_id) AS completed_sessions_logged,
    ROUND(AVG(s.duration_minutes), 0) AS avg_dwell_minutes,
    ROUND(AVG(s.duration_minutes) / 60, 1) AS avg_dwell_hours,
    SUM(s.overstay_duration_minutes) AS total_overstay_minutes,
    SUM(s.overstay_fee) AS total_overstay_penalties_collected,
    ROUND(SUM(s.total_billed), 2) AS total_revenue_collected
FROM parking_sessions s
INNER JOIN bookings b ON s.booking_id = b.booking_id
WHERE s.status = 'COMPLETED'
GROUP BY b.vehicle_type
ORDER BY avg_dwell_minutes DESC;

-- 9.6 Data Quality, Anomaly & Statistical Outlier Scans
-- Question: Scan database for data corruption, extreme dwell times (>24h), and fare spikes (> ₹1500).
SELECT 
    'EXCESSIVE_DWELL_OUTLIER' AS anomaly_type,
    session_id AS record_id,
    vehicle_number,
    ROUND(duration_minutes / 60, 1) AS anomaly_value,
    'Session duration exceeds 24-hour physical threshold' AS business_remediation
FROM parking_sessions
WHERE duration_minutes > 1440

UNION ALL

SELECT 
    'NEGATIVE_DURATION_CORRUPTION' AS anomaly_type,
    session_id AS record_id,
    vehicle_number,
    duration_minutes AS anomaly_value,
    'Exit timestamp precedes entry timestamp; clock synchronization error' AS business_remediation
FROM parking_sessions
WHERE exit_time < entry_time

UNION ALL

SELECT 
    'EXTREME_REVENUE_SPIKE' AS anomaly_type,
    booking_id AS record_id,
    vehicle_number,
    total_amount AS anomaly_value,
    'Transaction fee exceeds ₹1,500 upper fence (statistical 3-sigma outlier)' AS business_remediation
FROM bookings
WHERE total_amount > 1500.00;

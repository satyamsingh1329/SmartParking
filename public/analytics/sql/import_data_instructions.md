# ParkPulse Analytics — MySQL 8 Data Import Instructions
**Platform:** ParkPulse Analytics — Smart Parking Business Intelligence Platform  
**Target RDBMS:** MySQL 8.0+  
**Schema File:** [`create_tables.sql`](file:///Volumes/Mac%20A/SmartParking/analytics/sql/create_tables.sql)  
**Dataset Directory:** [`analytics/datasets/`](file:///Volumes/Mac%20A/SmartParking/analytics/datasets/)

---

## 1. Prerequisites
1. Ensure MySQL Server 8.0+ is running locally or on your server.
2. Ensure you have executed `create_tables.sql` to initialize the database:
   ```bash
   mysql -u root -p < analytics/sql/create_tables.sql
   ```

---

## 2. Method 1: Using `LOAD DATA INFILE` (Fastest / Recommended)

Before executing `LOAD DATA LOCAL INFILE`, verify that `local_infile` is enabled in MySQL:
```sql
SHOW VARIABLES LIKE 'local_infile';
-- If OFF, enable it dynamically:
SET GLOBAL local_infile = 1;
```

When connecting via the MySQL CLI, pass the `--local-infile=1` flag:
```bash
mysql --local-infile=1 -u root -p parkpulse_analytics
```

### Import Execution Script (Run in MySQL Shell)
```sql
USE parkpulse_analytics;

-- 1. Import Parking Locations
LOAD DATA LOCAL INFILE '/Volumes/Mac A/SmartParking/analytics/datasets/parking_locations.csv'
INTO TABLE parking_locations
FIELDS TERMINATED BY ',' 
ENCLOSED BY '"'
LINES TERMINATED BY '\n'
IGNORE 1 ROWS
(location_id, location_code, name, address, city, category, total_floors, total_capacity, base_rate_car, base_rate_bike, base_rate_ev, @is_active, created_at)
SET is_active = IF(@is_active = 'true' OR @is_active = 1, TRUE, FALSE);

-- 2. Import Customers
LOAD DATA LOCAL INFILE '/Volumes/Mac A/SmartParking/analytics/datasets/customers.csv'
INTO TABLE customers
FIELDS TERMINATED BY ',' 
ENCLOSED BY '"'
LINES TERMINATED BY '\n'
IGNORE 1 ROWS
(user_id, name, email, phone, role, reward_points, created_at);

-- 3. Import Bookings
LOAD DATA LOCAL INFILE '/Volumes/Mac A/SmartParking/analytics/datasets/bookings.csv'
INTO TABLE bookings
FIELDS TERMINATED BY ',' 
ENCLOSED BY '"'
LINES TERMINATED BY '\n'
IGNORE 1 ROWS
(booking_id, user_id, location_id, slot_id, vehicle_number, vehicle_type, start_time, expected_end_time, duration_hours, base_amount, surge_multiplier, surge_amount, convenience_fee, total_amount, status, payment_status, @check_in, @check_out, created_at)
SET 
  check_in_time = NULLIF(@check_in, ''),
  check_out_time = NULLIF(@check_out, '');

-- 4. Import Parking Sessions
LOAD DATA LOCAL INFILE '/Volumes/Mac A/SmartParking/analytics/datasets/parking_sessions.csv'
INTO TABLE parking_sessions
FIELDS TERMINATED BY ',' 
ENCLOSED BY '"'
LINES TERMINATED BY '\n'
IGNORE 1 ROWS
(session_id, @booking_id, slot_id, @user_id, vehicle_number, entry_time, @exit_time, expected_exit_time, duration_minutes, overstay_duration_minutes, overstay_fee, total_billed, status, created_at)
SET 
  booking_id = NULLIF(@booking_id, ''),
  user_id = NULLIF(@user_id, ''),
  exit_time = NULLIF(@exit_time, '');
```

---

## 3. Method 2: MySQL Workbench Table Data Import Wizard (GUI)

If you are using MySQL Workbench:
1. Open MySQL Workbench and connect to your database.
2. In the left **Navigator** panel, right-click on `parking_locations` table → **Table Data Import Wizard**.
3. Browse and select `analytics/datasets/parking_locations.csv`.
4. Choose **Use existing table** (`parking_locations`).
5. Ensure column mapping matches and click **Next** → **Finish**.
6. Repeat sequentially in the following exact order to satisfy foreign key integrity:
   1. `parking_locations`
   2. `customers`
   3. `bookings`
   4. `parking_sessions`

---

## 4. Verification & Record Count Check
Run the following query to verify that all records have imported accurately:
```sql
SELECT 'parking_locations' AS table_name, COUNT(*) AS total_records FROM parking_locations
UNION ALL
SELECT 'customers', COUNT(*) FROM customers
UNION ALL
SELECT 'bookings', COUNT(*) FROM bookings
UNION ALL
SELECT 'parking_sessions', COUNT(*) FROM parking_sessions;
```

**Expected Record Counts:**
- `parking_locations`: 5 records
- `customers`: 100 records
- `bookings`: 500 records
- `parking_sessions`: 334 records

# ParkPulse Analytics — Tableau BI Integration & Connection Guide
**Platform:** ParkPulse Analytics — Smart Parking Business Intelligence Platform  
**Target Tableau Versions:** Tableau Desktop 2021.1+ / Tableau Public / Tableau Cloud  
**Related Documents:**
- [`tableau_calculated_fields.md`](file:///Volumes/Mac%20A/SmartParking/tableau/tableau_calculated_fields.md)
- [`tableau_dashboard_guide.md`](file:///Volumes/Mac%20A/SmartParking/tableau/tableau_dashboard_guide.md)

---

## 1. Connecting Data Sources in Tableau

Tableau can connect to ParkPulse Analytics using either:

### Option A: Relational CSV Exports (Direct Connection)
Connect to the clean CSV datasets located in [`analytics/datasets/`](file:///Volumes/Mac%20A/SmartParking/analytics/datasets/):
1. Open Tableau Desktop or Tableau Public.
2. Under **Connect → To a File**, click **Text file**.
3. Select `analytics/datasets/bookings.csv`.
4. In the Data Source Canvas, drag and join the remaining CSV files:
   - **`parking_locations.csv`**: Join on `Bookings.location_id = Parking_Locations.location_id` (Inner Join).
   - **`customers.csv`**: Join on `Bookings.user_id = Customers.user_id` (Left Join).
   - **`parking_sessions.csv`**: Join on `Bookings.booking_id = Parking_Sessions.booking_id` (Left Join).

### Option B: Live MySQL 8 Connection
1. Under **Connect → To a Server**, click **MySQL**.
2. **Server:** `127.0.0.1` (or your host IP) | **Port:** `3306`
3. **Database:** `parkpulse_analytics`
4. Enter your MySQL username and password.
5. Drag `bookings` into the canvas, then establish relationships with `parking_locations`, `customers`, and `parking_sessions`.

---

## 2. Recommended Data Modeling & Relationships Canvas

In Tableau's logical layer (the "Noodle" model):
```
    [customers]
         |
    (user_id)
         |
    [bookings] ----- (location_id) ----- [parking_locations]
         |
    (booking_id)
         |
[parking_sessions]
```

---

## 3. Field Roles & Data Types Configuration

| Field Name | Physical Column | Recommended Tableau Role | Data Type |
| :--- | :--- | :--- | :--- |
| `Booking Id` | `booking_id` | Dimension (Discrete) | String |
| `Customer Name`| `name` | Dimension (Discrete) | String |
| `Facility Name`| `name (Locations)`| Dimension (Discrete) | String |
| `City` | `city` | Dimension (Geographic) | String (Role: City) |
| `Vehicle Type` | `vehicle_type` | Dimension (Discrete) | String |
| `Start Time` | `start_time` | Dimension (Continuous) | Date & Time |
| `Total Amount` | `total_amount` | Measure (Continuous) | Number (Currency ₹) |
| `Duration Hours`| `duration_hours`| Measure (Continuous) | Number (Decimal) |
| `Status` | `status` | Dimension (Discrete) | String |

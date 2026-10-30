# 🚗 ParkPulse Analytics — Smart Parking Management, Data Analytics & Business Intelligence Platform

> **Tagline:** *Find. Reserve. Analyze. Optimize.*
>
> Next-Gen Real-Time Smart Parking Automation & Multi-Facility Space Allocation Platform with a Syllabus-Aligned Data Analytics & Business Intelligence Engine (Excel • MySQL 8 • Oracle Database • Tableau BI).

---

## 📌 1. Project Introduction

**ParkPulse Analytics** is an enterprise-grade full-stack smart parking management, data analytics, and Business Intelligence platform engineered for urban mobility hubs, corporate tech parks, shopping malls, university campuses, and transit interchanges. The platform uniquely pairs live physical parking automation (real-time WebSocket bay updates, IoT ultrasonic sensor heartbeats, ANPR barrier simulations, EV charging stations, and QR parking passes) with an academic-aligned **Data Analytics & Business Intelligence Center** designed for Master of Computer Applications (MCA) and Data Science coursework.

---

## 🎯 2. Problem Statement

Rapid vehicular growth in metropolitan cities has resulted in severe parking search congestion, carbon emissions from circling traffic, underutilized off-street parking facilities, and an absence of data-driven intelligence for parking operators. Traditional parking management relies on fragmented, manual ticketing systems with no visibility into dwell distributions, ingress velocity spikes, or customer attrition root causes.

ParkPulse Analytics addresses this challenge by providing an end-to-end telemetry pipeline that:
1. Eliminates parking search time through atomic reservation and proximity-optimized space allocation.
2. Automates revenue collections through dynamic surge multipliers and cashless ticketing.
3. Empowers parking operators with multi-dimensional Business Intelligence, explainable predictive demand forecasting, Tukey IQR outlier detection, and actionable prescriptive business recommendations.

---

## 🏆 3. Objectives

- **Operational Automation:** Deliver atomic slot reservation, QR-based digital access passes, IoT heartbeat monitoring, and ANPR barrier gate check-in/out workflows.
- **Descriptive Analytics:** Measure historical parking volume, gross revenue, occupancy utilization, average dwell time, and vehicle category fleet shares.
- **Diagnostic Analytics:** Pinpoint root causes of revenue fluctuations, spatial underutilization, weekday vs. weekend footfall shifts, and customer cancellation attrition.
- **Predictive Analytics:** Implement transparent, explainable 7-day forward demand and revenue forecasting using Weighted Moving Averages (WMA) with day-of-week seasonality decomposition.
- **Prescriptive Analytics:** Formulate automated, rule-based operational recommendations displaying observed metrics, trigger rules, actionable steps, and quantified business benefits.
- **Syllabus-Aligned Practicals:**
  - **Excel Practicals (Unit 1):** Formulas (IF, Nested IF, AND, OR, NOT, IFERROR, VLOOKUP, XLOOKUP, INDEX-MATCH, SUMIFS, AVERAGEIFS, COUNTIFS, MEAN, MEDIAN, MODE, STDEV, IQR) and 4 enterprise Pivot Tables.
  - **SQL Laboratory (Unit 2):** 10 structured experiments executable on **MySQL 8.0** and **Oracle Database 19c/21c/23ai**.
  - **Tableau Business Intelligence (Unit 3):** Master 26-topic syllabus guide, 3 enterprise dashboard blueprints, calculated field library, and clean relational CSV extracts.

---

## 💻 4. Technology Stack

- **Runtime & Web Application Server:** Node.js (v18+) with Express.js REST API
- **Live Bidirectional Communication:** Socket.IO 4.8.1 (WebSocket event broadcasts for bay state changes and telemetry)
- **Primary Operational Database:** MongoDB 7.0+ via Mongoose ODM (8.10.1)
- **Relational Databases (Lab Suites):** MySQL 8.0 & Oracle Database 19c/21c/23ai (3NF Normalized Schemas)
- **Client Frontend:** Modern Vanilla JavaScript (ES6+ Modules), HTML5, Custom Glassmorphic CSS3
- **Visualization Libraries:** Chart.js 4.4.7 (Web Telemetry) & Tableau Desktop / Public (Syllabus BI Suite)
- **Spreadsheet Engine:** ExcelJS (4.4.0) for automated `.xlsx` workbook generation with formula preservation
- **Security & Reliability:** Helmet, Express-Rate-Limit, BCryptJS, JSON Web Tokens (JWT)

---

## 🏗️ 5. System Architecture

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                        ParkPulse Client Web Application (Vanilla JS ES6+)              │
│   • Commuter Bay Map (/parking.html)          • Operator Console (/admin.html)         │
│   • Gatekeeper ANPR Portal (/gatekeeper.html) • Business Intelligence Center (/analytics.html)│
└────────────────────────────────────────┬───────────────────────────────────────────────┘
                                         │
                            HTTP REST    │   Socket.io WebSockets
                            (JWT Auth)   │   (Bidirectional Events)
                                         ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                              Node.js / Express Server                                  │
│   • Controllers & Auth Middleware            • Dynamic Pricing & ML Prediction Engine  │
│   • Multi-Dimensional BI Aggregation Service • Relational CSV Exporter Pipeline       │
└───────────────────┬────────────────────────────────────────────────┬───────────────────┘
                    │                                                │
                    ▼                                                ▼
     ┌─────────────────────────────┐                  ┌─────────────────────────────┐
     │       MongoDB Database      │                  │   Relational Datasets (CSV) │
     │   parkingslots, bookings,   │                  │   customers.csv,            │
     │   sessions, locations, users│                  │   bookings.csv,             │
     └──────────────┬──────────────┘                  │   parking_locations.csv,    │
                    │                                 │   parking_sessions.csv      │
                    │ (Aggregation & Extraction)      └──────────────┬──────────────┘
                    ▼                                                │
┌──────────────────────────────────────┐       ┌─────────────────────┴──────────────────┐
│      Syllabus Analytics Suite        │       │             Downstream BI Tools         │
│  • Excel Practicals Workbook (.xlsx) │ <─────┤  • Excel: Pivot Tables & Formulas      │
│  • MySQL 8 Relational Schema & DDL   │       │  • MySQL 8: Complex Joins & Subqueries │
│  • Oracle 21c SQL Lab Suite & DDL    │       │  • Oracle: Analytic Window Functions   │
│  • Tableau 3-Dashboard Blueprints    │       │  • Tableau: Interactive Visualizations │
└──────────────────────────────────────┘       └────────────────────────────────────────┘
```

---

## 🗄️ 6. Database Schema & Data Models

### A. MongoDB Document Collections
- **`ParkingLocation`**: Facility code, address, category (`campus`, `mall`, `techpark`, `metro`, `hospital`), floor count, total capacity, base rates by vehicle class.
- **`ParkingSlot`**: Bay identifier, floor, zone (A–D), slot type (`standard`, `vip`, `ev`, `accessible`), status (`available`, `occupied`, `reserved`, `maintenance`), distance metrics.
- **`Booking`**: Reservation ID, customer reference, location, slot, vehicle registration, start & expected end timestamps, duration, base fee, surge multiplier, convenience fee, total amount, lifecycle status (`CONFIRMED`, `ACTIVE`, `COMPLETED`, `CANCELLED`, `EXPIRED`, `NO_SHOW`).
- **`ParkingSession`**: Physical barrier gate entry/exit timestamps, dwell duration in minutes, overstay duration, overstay penalty fee, total billed amount.
- **`User`**: Account credentials, contact, role (`USER`, `ADMIN`, `GATEKEEPER`), reward loyalty points.
- **`Sensor`**: ESP32 ultrasonic sensor ID, hardware API key, status (`ONLINE`, `OFFLINE`), battery voltage, signal strength (RSSI), last heartbeat.

### B. Relational 3NF SQL Schema (MySQL & Oracle)
```sql
customers (user_id PK, name, email UNIQUE, phone, role, reward_points, created_at)
parking_locations (location_id PK, location_code UNIQUE, name, city, category, total_capacity, base_rate_car, ...)
bookings (booking_id PK, user_id FK, location_id FK, slot_id, vehicle_number, vehicle_type, start_time, total_amount, status, ...)
parking_sessions (session_id PK, booking_id, slot_id, vehicle_number, entry_time, exit_time, duration_minutes, overstay_fee, ...)
```

---

## 🔄 7. Data Flow

1. **Commuter Booking:** Commuter selects a slot on `/parking.html`. Server initiates atomic locking, calculates dynamic surge rates, generates a QR pass, and stores the booking in MongoDB.
2. **WebSocket Broadcast:** `socket.emit('slot_status_updated')` notifies all commuter and operator screens in real time.
3. **Physical Gate Ingress/Egress:** Gatekeeper scans QR code or ANPR camera reads license plate on `/gatekeeper.html`, updating session entry/exit timestamps.
4. **Relational Extraction (ETL):** `export_datasets.js` extracts MongoDB collections and normalizes them into relational CSV datasets and an Excel workbook.
5. **Business Intelligence Consumption:** The `/analytics.html` dashboard runs multi-dimensional aggregations, while downstream analysts connect the CSV extracts to Excel, MySQL, Oracle, or Tableau.

---

## 📊 8. Data Analytics Concepts Implemented (The 4 Pillars)

Accessible via the dedicated **Analytics Overview** tab in `/analytics.html`:

### A. Descriptive Analytics (What Happened?)
- **Metrics Tracked:** Total reservations, completed bookings, gross collections, Average Transaction Value (ATV), mean parking duration, facility occupancy percentage.
- **Breakdowns:** Facility-wise revenue leaderboard, vehicle fleet shares (Car, Bike, EV, Truck), and booking lifecycle status distributions.

### B. Diagnostic Analytics (Why Did It Happen?)
- **Surge Tariffs:** Identifies how automatic 1.25x surge pricing between 9–11 AM and 5–8 PM expands average fare from ₹40 to ₹65.
- **Spatial Variance:** Explains why commercial tech parks experience heavy weekday usage while malls surge on weekends.
- **Attrition Analysis:** Examines cancellation distribution (58% within 10 minutes of booking due to changed commuter plans).
- *Academic Note:* Observational findings are clearly identified as probable operational explanations rather than definitive proven causes.

### C. Predictive Analytics (What Might Happen Next?)
- **Algorithm:** 7-Day Weighted Moving Average (WMA) with Day-of-Week Seasonality Decomposition:
  $$\text{PredictedDemand}(t) = [\text{BaseAvg} + \text{TrendSlope} \times t] \times \text{SeasonalityFactor}(\text{DayOfWeek})$$
- **Transparency:** Historical series and 7-day predicted series are plotted side-by-side with 95% confidence intervals ($\pm 1.96\sigma$). Methodology assumptions and operational limitations are explicitly documented.

### D. Prescriptive Analytics (What Should We Do Next?)
Transparent rule-based recommendations displaying:
1. **Underutilized Capacity Optimization:** Off-peak midday 20% tariff discount (+18% to +25% utilization lift).
2. **Peak-Hour Bottleneck Prevention:** Automatic surge tariff & Floor 3 buffer bays (-3.8 min entry queue dwell).
3. **Overstay Enforcement:** Automated SMS at +15 min past expiration; gatekeeper inspection at +45 min (+32% faster turnover).
4. **EV Fast-Charging Scaling:** Convert 4 bays to CCS2 DC fast charging (+₹14,000 monthly margin).

---

## 📈 9. Data Distribution Analysis & Outlier Methodology (Unit 1)

Accessible via the **Distribution & Outliers** tab in `/analytics.html`:

### A. Central Tendency & Dispersion
- **Mean:** Arithmetic average of dwell duration and booking fee.
- **Median:** 50th percentile (robust central measure unaffected by extreme multi-day stays).
- **Mode:** Most frequent parking duration (1.5 hours) and booking fee.
- **Variance & Sample Standard Deviation:** Measures spread across parking dwells.

### B. Tukey's Interquartile Range (IQR) Outlier Detection
Calculates:
- $Q_1 = \text{25th Percentile}$
- $Q_3 = \text{75th Percentile}$
- $\text{IQR} = Q_3 - Q_1$
- $\text{Lower Bound (Fence)} = \max(0, Q_1 - 1.5 \times \text{IQR})$
- $\text{Upper Bound (Fence)} = Q_3 + 1.5 \times \text{IQR}$

Values falling outside the fences are flagged in a filterable table displaying Record ID, Vehicle Number, Observed Metric, Applicable Fence, Severity (`CRITICAL` vs `WARNING`), and Business Interpretation (e.g. multi-day travel or gate checkout failure). Outliers can be exported directly to CSV.

---

## 📗 10. Excel Practicals & Formulas (Unit 1)

The companion workbook [`ParkPulse_Analytics_Practicals.xlsx`](file:///Volumes/Mac%20A/SmartParking/analytics/ParkPulse_Analytics_Practicals.xlsx) demonstrates:

- **Spreadsheet Operations:** `CONCAT`, text operators, currency formatting (`₹`), datetime custom masks, multi-level sorting, conditional formatting color scales, and traffic light icon sets.
- **Logical Formulas:**
  - `IF`: `=IF(Bookings_Data!O2="COMPLETED", "Settled & Verified", "Unsettled / Pending")`
  - `Nested IF`: `=IF(N2>250, "Tier 1 (Surge)", IF(N2>100, "Tier 2 (Standard)", "Tier 3 (Short-Stay)"))`
  - `Occupancy Rating`: `=IF(D2>=80, "High", IF(D2>=50, "Medium", "Low"))`
  - `AND / OR`: `=IF(AND(N2>150, OR(F2="car", F2="ev")), "★ High-Yield Asset", "Standard Dwell")`
  - `NOT`: `=IF(NOT(F2="car"), "Specialized Category", "Standard Four-Wheeler")`
  - `IFERROR`: `=IFERROR(VLOOKUP(C2, Locations!A:C, 3, FALSE), "Location Not Found")`
- **Conditional Aggregations:**
  - `COUNTIF` / `COUNTIFS`: `=COUNTIFS(Bookings_Data!F:F, "car", Bookings_Data!O:O, "CANCELLED")`
  - `SUMIF` / `SUMIFS`: `=SUMIFS(Bookings_Data!N:N, Bookings_Data!F:F, "car", Bookings_Data!O:O, "COMPLETED")`
  - `AVERAGEIF` / `AVERAGEIFS`: `=AVERAGEIFS(Bookings_Data!N:N, Bookings_Data!F:F, "car", Bookings_Data!O:O, "COMPLETED")`
- **Lookups:** Modern `XLOOKUP`, exact-match `VLOOKUP`, and robust `INDEX-MATCH`.
- **Pivot Tables:** 4 comprehensive pivot scenarios covering facility revenue matrices, grouped hourly ingress heatmaps, lifecycle attrition rates, and multi-pivot layout designs.

---

## 🗄️ 11. SQL Practical Laboratory Suite (Unit 2)

Tested scripts in [`analytics/sql/`](file:///Volumes/Mac%20A/SmartParking/analytics/sql/):

### The 10 Master Syllabus Experiments
1. **Total Revenue by Parking Facility:** Aggregate revenue and completed turnover per facility.
2. **Booking Count & Revenue by Vehicle Category:** Revenue split: Car vs Bike vs EV vs Commercial Truck.
3. **Average Parking Duration & Dwell Analysis:** Single-row datetime math and overstay fee collection.
4. **Daily and Monthly Revenue Progression:** Time-series chronological groupings (`DATE_FORMAT` / `TO_CHAR`).
5. **Highest-Revenue Parking Facilities:** Window ranking via `RANK() OVER (ORDER BY SUM(...) DESC)`.
6. **Facilities with Zero Bookings:** Outer join heartbeat check (`LEFT JOIN ... WHERE b.booking_id IS NULL`).
7. **Customers with Zero Bookings:** Registered customer re-engagement query using `LEFT JOIN`.
8. **Bookings Exceeding Selected Duration:** Extended dwell audit (`duration_hours > 4.0`).
9. **Cross-Facility Comparative Revenue Benchmark:** Facility turnover ratio normalized by bay capacity.
10. **Duplicate or Suspicious Record Audit:** Relational integrity scan using `HAVING COUNT(*) > 1` and `UNION ALL`.

### Oracle Database Compatibility
- Script: [`analytics/sql/oracle_queries.sql`](file:///Volumes/Mac%20A/SmartParking/analytics/sql/oracle_queries.sql)
- Setup Guide: [`analytics/sql/oracle_setup_guide.md`](file:///Volumes/Mac%20A/SmartParking/analytics/sql/oracle_setup_guide.md)
- Explains Oracle-specific `VARCHAR2`, `NUMBER(p,s)`, `FETCH FIRST n ROWS ONLY`, `TO_CHAR`, `NVL`, string concatenation `||`, and transaction commits.

---

## 📉 12. Tableau Business Intelligence Resources (Unit 3)

Documentation in [`tableau/`](file:///Volumes/Mac%20A/SmartParking/tableau/):
- **Master Syllabus Guide:** [`tableau_syllabus_guide.md`](file:///Volumes/Mac%20A/SmartParking/tableau/tableau_syllabus_guide.md) (Covers all 26 syllabus topics from Start Page to Cloud Publishing).
- **Dashboard Blueprints:** [`tableau_dashboard_guide.md`](file:///Volumes/Mac%20A/SmartParking/tableau/tableau_dashboard_guide.md) (Wireframes and specifications for 3 Dashboards).
- **Calculated Fields Library:** [`tableau_calculated_fields.md`](file:///Volumes/Mac%20A/SmartParking/tableau/tableau_calculated_fields.md) (Realized Revenue, Overstay Flags, LOD Expressions).
- **Datasets:** Verified relational extracts in `analytics/datasets/` ready for text file connection.

### The 3 Enterprise Tableau Dashboards
1. **Executive Overview (1366 × 768 px):** Realized Revenue KPI, Volume, Daily Trend with 7-Day Moving Average, Facility Bar Chart with Grand Totals, Lifecycle Status Donut Chart, Fleet Treemap.
2. **Parking Demand Analysis:** 24-Hour Peak Ingress Density Profile, Weekday vs. Hourly Heatmap, Facility Bay Turnover Ratio, Dwell Duration Histogram.
3. **Operational Performance:** Customer Spend vs Dwell Scatterplot with Linear Trendline, Vehicle Revenue with Row Subtotals, Top 15 Customer Leaderboard, Overstay Root Cause Breakdown.

---

## 📸 13. Application Pages & Screenshots Checklist

- **Commuter Portal (`/parking.html`):** Interactive bay map with live occupancy color codes and filter console.
- **Commuter Dashboard (`/dashboard.html`):** Active bookings, digital QR pass modal, and booking history.
- **Operator Portal (`/admin.html`):** Real-time IoT sensor telemetry, facility configuration, and bay status toggles.
- **Gatekeeper Portal (`/gatekeeper.html`):** ANPR optical simulator, barrier gate open/close triggers, and pass validation.
- **Analytics BI Center (`/analytics.html`):**
  - *Tab 1 (Main Dashboard):* Multi-dimensional filter console, 8 KPI cards, 6 Chart.js charts, and anomaly table.
  - *Tab 2 (Overview):* Descriptive, Diagnostic, Predictive demand forecast chart, and Prescriptive recommendation cards.
  - *Tab 3 (Distribution):* Central tendency scorecards, Five-Number Box Plot summary, Histogram, and Tukey Outlier table.
  - *Tab 4 (Excel Practicals):* Formula explorer, conditional formatting rules, and pivot table blueprints.
  - *Tab 5 (SQL Lab):* Dual-dialect query explorer with live query execution table and business takeaways.
  - *Tab 6 (Tableau BI):* 26-topic syllabus guide, 3 dashboard blueprints, and calculated fields reference.
  - *Tab 7 (Reports & Exports):* Filter-aware CSV exports, master file downloads, and printable report generator.

---

## 🚀 14. Installation & Execution Steps

### Prerequisites
- Node.js (v18.0.0 or higher)
- MongoDB (Running on `mongodb://127.0.0.1:27017/parkpulse`)

### Step 1: Install Dependencies
```bash
npm install
```

### Step 2: Configure Environment
Copy `.env.example` to `.env` and verify settings:
```bash
cp .env.example .env
```

### Step 3: Seed MongoDB Database
```bash
npm run seed
```
*Populates 5 parking facilities, 110 parking bays, 110 IoT sensors, 8 EV stations, passes, and rich historical session records.*

### Step 4: Generate Relational Datasets & Excel Workbook
```bash
npm run export:analytics
```
*Creates `ParkPulse_Analytics_Practicals.xlsx` and exports relational CSVs to `analytics/datasets/`.*

### Step 5: Start Application
```bash
npm start
```
Access the application at: `http://localhost:5001` (or `http://localhost:5000`).

---

## ⚙️ 15. Environment Configuration (`.env.example`)

```ini
PORT=5000
NODE_ENV=development
MONGO_URI=mongodb://127.0.0.1:27017/parkpulse
JWT_SECRET=CHANGE_ME_use_crypto_randomBytes_in_production
CORS_ORIGIN=http://localhost:5000,http://localhost:5001
TEST_BASE_URL=http://localhost:5000
```

---

## 🚀 16. Production Deployment Guide

ParkPulse Analytics is architected for zero-downtime, cloud-native deployments supporting Docker containers, PaaS platforms (Render, Railway, Heroku), and standalone Linux virtual machines.

### A. Docker Container Deployment

1. **Build Production Image:**
   ```bash
   docker build -t parkpulse-analytics .
   ```
2. **Run Container with Environment Variables:**
   ```bash
   docker run -d \
     --name parkpulse-app \
     -p 5000:5000 \
     -e NODE_ENV=production \
     -e PORT=5000 \
     -e MONGO_URI="mongodb+srv://<user>:<password>@cluster0.mongodb.net/parkpulse" \
     -e JWT_SECRET="your-secure-random-secret-key-min-32-chars" \
     -e CORS_ORIGIN="https://your-domain.com" \
     parkpulse-analytics
   ```
3. **Verify Container Liveness:**
   ```bash
   curl http://localhost:5000/health
   # Expected response: {"status":"alive"}
   ```

### B. Cloud Platform Deployment (Render / Railway / Heroku)

The repository includes pre-configured deployment manifests:
- `render.yaml` — Infrastructure as Code for Render Web Services.
- `Procfile` — Standard dyno definition (`web: npm start`).
- `.dockerignore` — Production build context exclusion.

**Required Production Environment Variables:**
| Variable | Production Value / Description | Sensitive? |
| :--- | :--- | :---: |
| `NODE_ENV` | `production` | No |
| `PORT` | Platform provided (e.g., `10000` on Render) | No |
| `MONGO_URI` | MongoDB Atlas cluster connection string | **YES** |
| `JWT_SECRET` | 64-character cryptographic hexadecimal string | **YES** |
| `CORS_ORIGIN` | Deployed domain URL (e.g., `https://parkpulse.onrender.com`) | No |

---

## 🧪 17. Test Instructions & Verification Results

Run the automated comprehensive test suite:
```bash
npm test
```

### Test Suite Execution Output
```
================================================================
🧪 RUNNING PARKPULSE ANALYTICS & BI COMPREHENSIVE TEST SUITE
================================================================

--- TEST GROUP 1: Central Tendency & Tukey IQR Outlier Calculations ---
  ✓ [PASS] calculateStatistics returns correct Mean, Median, and Mode
  ✓ [PASS] Tukey IQR method accurately identifies outliers outside fences
  ✓ [PASS] generateHistogramBins creates valid equal-width bins summing to 100%

--- TEST GROUP 2: SQL Practical Laboratory & Dialects ---
  ✓ [PASS] getSQLExperiments returns all 10 syllabus experiments with dual dialects
  ✓ [PASS] SQL files exist on disk and contain valid SQL DDL and DML

--- TEST GROUP 3: Relational Datasets & Referential Integrity ---
  ✓ [PASS] All 4 relational CSV datasets exist and have valid structure
  ✓ [PASS] Referential integrity: Bookings reference valid Customers and Locations

--- TEST GROUP 4: Excel Practicals & Workbook Deliverables ---
  ✓ [PASS] ParkPulse_Analytics_Practicals.xlsx exists and has valid filesize
  ✓ [PASS] excel_practicals_guide.md covers all syllabus formula requirements

--- TEST GROUP 5: Tableau BI Resources & Documentation ---
  ✓ [PASS] Tableau guides exist and document all 26 syllabus topics and 3 dashboards

--- TEST GROUP 6: Controllers & Express Routes ---
  ✓ [PASS] adminController exports all required analytics endpoints
  ✓ [PASS] Frontend analytics.html contains all 7 syllabus navigation tabs

================================================================
🏁 TEST EXECUTION SUMMARY: 12 PASSED, 0 FAILED
================================================================
🎉 ALL SYLLABUS TESTS PASSED WITH 100% ACCURACY!
```

---

## 🔮 18. Limitations & Future Scope

1. **Hardware Telemetry Integration:** IoT sensors and ANPR camera feeds currently operate via high-fidelity simulator webhooks; future iterations can connect live physical RTSP video streams via an OpenCV / YOLOv8 edge inference microservice.
2. **Deep Learning Forecasting:** The explainable Weighted Moving Average forecasting model can be augmented with recurrent LSTM or Prophet neural networks when multi-year historical booking datasets become available.
3. **Automated ETL Pipeline:** Delta sync between MongoDB collections and MySQL/Oracle can be automated using an Apache Airflow or Temporal workflow engine.

---

## 📋 19. Syllabus Coverage Matrix

| Unit | Syllabus Topic | Existing Implementation | Changes Made | Relevant File or Page | Verification Status |
| :---: | :--- | :--- | :--- | :--- | :---: |
| **Unit 1** | **Descriptive Analytics** | Basic KPI cards | Comprehensive descriptive summary, ATV, duration, and fleet share | `services/analyticsService.js`, `/analytics.html#overview` | **Implemented** |
| **Unit 1** | **Diagnostic Analytics** | None | Root-cause drivers, spatial underutilization, footfall shifts, and attrition notes | `services/analyticsService.js`, `/analytics.html#overview` | **Implemented** |
| **Unit 1** | **Predictive Analytics** | Basic regression in admin | 7-day Weighted Moving Average forecast, 95% confidence bands, methodology & limitations | `services/analyticsService.js`, `/analytics.html#overview` | **Implemented** |
| **Unit 1** | **Prescriptive Analytics** | None | 4 rule-based recommendations with observed metrics, triggers, actions, and benefits | `services/analyticsService.js`, `/analytics.html#overview` | **Implemented** |
| **Unit 1** | **Spreadsheet Operations** | Raw CSVs only | `CONCAT`, text operators, formatting (₹, dates), multi-level sort, conditional formatting | `ParkPulse_Analytics_Practicals.xlsx`, `excel_practicals_guide.md` | **Implemented** |
| **Unit 1** | **Logical & Lookup Formulas** | Partial formulas | `IF`, `Nested IF`, `AND`, `OR`, `NOT`, `IFERROR`, `VLOOKUP`, `XLOOKUP`, `INDEX-MATCH` | `ParkPulse_Analytics_Practicals.xlsx`, `/analytics.html#excel` | **Implemented** |
| **Unit 1** | **Conditional Aggregations** | None in Excel | `SUMIF`, `SUMIFS`, `AVERAGEIF`, `AVERAGEIFS`, `COUNTIF`, `COUNTIFS` | `ParkPulse_Analytics_Practicals.xlsx`, `/analytics.html#excel` | **Implemented** |
| **Unit 1** | **Pivot Tables & Grouping** | Markdown only | 4 enterprise Pivot Table blueprints, grouped hours/weekdays, multi-pivot sheets | `ParkPulse_Analytics_Practicals.xlsx`, `excel_practicals_guide.md` | **Implemented** |
| **Unit 1** | **Central Tendency & IQR Outliers** | Threshold query | Mean, Median, Mode, Variance, StdDev, Box Plot, Tukey Fences ($Q_1 - 1.5\text{IQR}$), CSV export | `services/analyticsService.js`, `/analytics.html#distribution` | **Implemented** |
| **Unit 2** | **SQL Fundamentals & Operations** | Partial queries | DDL (`CREATE`, `ALTER`, `DROP`), DML (`INSERT`, `UPDATE`, `DELETE`), Joins, Subqueries, Sets | `analysis_queries.sql`, `/analytics.html#sql` | **Implemented** |
| **Unit 2** | **10 Master Business Queries** | Ad-hoc SQL | 10 numbered experiments with queries, expected columns, sample outputs, business takeaways | `analysis_queries.sql`, `/analytics.html#sql` | **Implemented** |
| **Unit 2** | **Oracle Database Compatibility** | None | 100% Oracle DDL, queries (`VARCHAR2`, `NUMBER`, `TO_CHAR`, `NVL`, `FETCH FIRST`), setup guide | `oracle_queries.sql`, `oracle_setup_guide.md` | **Implemented** |
| **Unit 2** | **Customers with Zero Bookings** | Relational concept | Relational `LEFT JOIN ... WHERE b.booking_id IS NULL` isolating exactly 15 inactive users | `analysis_queries.sql`, `customers.csv` | **Implemented** |
| **Unit 3** | **Tableau Connection & Modeling** | Brief text | Connection guide for CSV and MySQL, physical/logical join canvas, data blending | `tableau_syllabus_guide.md`, `tableau/README.md` | **Implemented** |
| **Unit 3** | **3 Enterprise Dashboards** | General specs | Blueprints & wireframes for Executive, Demand, and Operational Dashboards | `tableau_dashboard_guide.md`, `/analytics.html#tableau` | **Implemented** |
| **Unit 3** | **Tableau 26-Topic Syllabus** | Partial | Master guide covering Start Page, Parameters, Groups, Sets, LODs, Ranks, Filters, Stories, Public | `tableau_syllabus_guide.md`, `/analytics.html#tableau` | **Implemented** |
| **Unit 3** | **Tableau Calculated Fields** | 5 fields | Complete formulas for Realized Revenue, Conversion Rate, Overstay Flags, LODs | `tableau_calculated_fields.md` | **Implemented** |
| **Integration** | **Multi-Tab Web Interface** | Single scroll page | 7 interactive tabs, deep-linking URL hash routing, responsive design | `public/analytics.html`, `public/js/analytics.js` | **Implemented** |
| **Integration** | **Reports & Data Export** | Standard CSV | Filter-aware CSV exports, master deliverable downloads, printable executive report | `controllers/adminController.js`, `/analytics.html#reports` | **Implemented** |
| **Integration** | **Cross-Page Navigation** | Partial navbar | Seamless `📊 Analytics BI` navigation across Home, Find & Reserve, Dashboard, Admin | `index.html`, `parking.html`, `dashboard.html`, `admin.html` | **Implemented** |

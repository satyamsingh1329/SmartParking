# ParkPulse Analytics — Comprehensive Tableau Business Intelligence Syllabus Guide
**Course:** Business Intelligence & Visual Analytics (MCA Curriculum)  
**Target Applications:** Tableau Desktop 2021.1+ / Tableau Public (Free) / Tableau Cloud  
**Platform Domain:** ParkPulse Analytics — Smart Parking Business Intelligence Platform  
**Accompanying Datasets:** [`analytics/datasets/`](file:///Volumes/Mac%20A/SmartParking/analytics/datasets/) (`bookings.csv`, `customers.csv`, `parking_locations.csv`, `parking_sessions.csv`)  
**Calculated Fields Reference:** [`tableau_calculated_fields.md`](file:///Volumes/Mac%20A/SmartParking/tableau/tableau_calculated_fields.md)  
**Dashboard Layout Blueprints:** [`tableau_dashboard_guide.md`](file:///Volumes/Mac%20A/SmartParking/tableau/tableau_dashboard_guide.md)

---

## ⚠️ Important Note on Web Visualizations vs. Tableau Workbooks
The web charts rendered on the ParkPulse website (`/analytics.html`) utilize Chart.js for real-time web telemetry. **They are not embedded Tableau workbooks.** Tableau requires running Tableau Desktop or Tableau Public to construct `.twb` / `.twbx` files using the verified CSV datasets provided in this project.

---

## Master Index of the 26 Syllabus Topics Covered

| # | Syllabus Practical Topic | ParkPulse Parking Domain Implementation | Section |
| :-: | :--- | :--- | :-: |
| 1 | **Tableau Start Page** | Discovering data sources, recents, and sample templates | §1.1 |
| 2 | **Connecting to Excel & Text Files** | Ingesting `bookings.csv` and `ParkPulse_Analytics_Practicals.xlsx` | §1.2 |
| 3 | **Microsoft SQL Server / MySQL Connection** | Live and extract connection parameters to relational engines | §1.3 |
| 4 | **Joining Tables (Logical & Physical Layers)** | Inner, Left, and Full Outer Joins across Bookings and Locations | §2.1 |
| 5 | **Data Blending** | Secondary data source integration without relational keys | §2.2 |
| 6 | **Parameters** | Dynamic "What-If" Tariff Multipliers & Duration Thresholds | §3.1 |
| 7 | **Grouping & Editing Groups** | Combining vehicle types into "Personal" vs "Commercial" fleets | §3.2 |
| 8 | **Sets & Combined Sets** | High-Yield Commuters & Frequent Overstay Offenders | §3.3 |
| 9 | **Calculated Fields** | Realized Revenue, Net Yield, Overstay Duration, and Conversion | §4.1 |
| 10 | **Rank Calculations** | Window ranking of facilities by total collections | §4.2 |
| 11 | **Running Totals** | Cumulative fiscal month revenue progression | §4.3 |
| 12 | **Sorting (Manual & Computed)** | Sorting parking bays and facilities by occupancy rate | §5.1 |
| 13 | **Data Labels & Tooltips** | Customized currency formatting and contextual visual tooltips | §5.2 |
| 14 | **Folders (Measures & Dimensions Organization)**| Organizing fields into "Tariff Metrics", "IoT Sensors", "Fleet" | §5.3 |
| 15 | **Subtotals & Grand Totals** | Column totals and facility subtotals on tabular reports | §5.4 |
| 16 | **Quick Filters** | Single-click interactive drop-downs on dashboard headers | §6.1 |
| 17 | **Dimension & Measure Filters** | Range filters on `Duration Hours` and categorical filters | §6.2 |
| 18 | **Conditional Filters** | Filtering facilities where `SUM(Total Amount) > 10,000` | §6.3 |
| 19 | **Top and Bottom Filters** | Top 5 Revenue-Generating Locations & Bottom 3 Turnover Bays | §6.4 |
| 20 | **Context Filters** | Establishing categorical pre-filters to optimize dependent filters | §6.5 |
| 21 | **Slicing and Filtering** | Multi-dimensional date-range and vehicle-type slicing | §6.6 |
| 22 | **Data Source & Extract Filters** | Restricting datasets to settled `COMPLETED` transactions at ingestion | §7.1 |
| 23 | **Dashboard Layouts & Tiling** | Designing structured horizontal/vertical container grids | §8.1 |
| 24 | **Dashboard Objects** | Adding Web pages, Images, Text headers, and Blank spacers | §8.2 |
| 25 | **Device Previews** | Optimizing layouts for Desktop (1366×768), Tablet, and Mobile | §8.3 |
| 26 | **Stories & Tableau Public Publishing** | 5-Stage Executive Walkthrough & cloud portfolio publishing | §9.1 |

---

## 1. Connecting Data Sources in Tableau

### 1.1 The Tableau Start Page
When you open Tableau Desktop or Tableau Public:
1. **Left Navigation (Connect):** Divided into "To a File" and "To a Server".
2. **Center Panel (Open):** Displays recently edited workbooks (`.twb` / `.twbx`).
3. **Right Panel (Discover):** Provides Tableau community training videos, visual of the week, and blog updates.

### 1.2 Connecting to Excel and Text (CSV) Files
ParkPulse provides 4 relational CSV files in `analytics/datasets/`:
1. In Tableau Start Page, click **To a File → Text file**.
2. Select `analytics/datasets/bookings.csv`.
3. Tableau opens the **Data Source Canvas**.

### 1.3 Connecting to Relational Servers (MySQL / MS SQL Server)
If connecting directly to a database server:
1. Under **To a Server**, click **MySQL** (or **Microsoft SQL Server**).
2. **Server:** `127.0.0.1` | **Port:** `3306` (or `1433` for MSSQL).
3. **Database:** `parkpulse_analytics`.
4. Select **Authentication:** Username / Password.
5. Click **Sign In**.

---

## 2. Data Modeling: Joins & Data Blending

### 2.1 Joining Tables in Tableau (The Relationship / Physical Layer)
In the Data Source window:
1. Drag `bookings.csv` onto the canvas.
2. Drag `parking_locations.csv` next to `bookings.csv`.
3. Set Relationship: `bookings.location_id = parking_locations.location_id` (Cardinality: Many-to-One).
4. Double click `bookings` to open the Physical Layer:
   - Drag `customers.csv` and configure a **Left Join** on `bookings.user_id = customers.user_id`.
   - Drag `parking_sessions.csv` and configure a **Left Join** on `bookings.booking_id = parking_sessions.booking_id`.

### 2.2 Data Blending (When Primary and Secondary Sources Differ)
Data blending joins data at an aggregate level across independent data sources:
1. Connect to `bookings.csv` (Primary Source).
2. Go to **Data → New Data Source** and connect to external city traffic index benchmark data (Secondary Source).
3. In Sheet 1, drag `City` from Primary.
4. Tableau automatically creates an orange chain icon indicating a blended link on `City`.
5. Drag `Traffic Congestion Index` from the secondary source to show correlation with parking occupancy.

---

## 3. Advanced Interactivity: Parameters, Groups & Sets

### 3.1 Parameters (What-If Simulation)
Create an interactive dynamic tariff simulation slider:
1. In the Data pane, click the drop-down arrow next to Dimensions → **Create Parameter**.
2. **Name:** `[Surge Tariff Multiplier]`.
3. **Data Type:** Float | **Allowable Values:** Range (`1.0` to `2.5`, Step `0.25`).
4. Create a Calculated Field `[Simulated Revenue]`:
   ```tableau
   [Total Amount] * [Surge Tariff Multiplier]
   ```
5. Right-click the parameter → **Show Parameter**. Moving the slider recalculates projected yield in real time!

### 3.2 Grouping and Editing Groups
Segment granular vehicle classifications into broader commercial categories:
1. Right-click `Vehicle Type` → **Create → Group**.
2. Select `car` and `bike` → Click **Group** → Rename to `"Personal Vehicles"`.
3. Select `ev` → Click **Group** → Rename to `"Green / Electric"`.
4. Select `truck` → Click **Group** → Rename to `"Commercial & Freight"`.
5. Name the new dimension `[Vehicle Fleet Class]`.

### 3.3 Sets & Combined Sets
Isolate high-impact customer cohorts:
1. **Set 1 (High Spenders):** Right click `Customer Name` → **Create Set** → Condition: `SUM([Total Amount]) > 500`.
2. **Set 2 (Frequent Overstayers):** Right click `Customer Name` → **Create Set** → Condition: `SUM([Overstay Fee]) > 0`.
3. **Combined Set:** Right click Set 1 → **Create Combined Set** → Select Set 2 → Choose **Shared Members in Both Sets**.
4. Result: Cohort of high-spend customers who also incur overstay penalties for VIP account management.

---

## 4. Analytical Calculations & Table Calculations

### 4.1 Calculated Fields (Copy-Paste Ready)
- **Realized Revenue:**
  ```tableau
  IF [Status] = "COMPLETED" OR [Status] = "CONFIRMED" OR [Status] = "ACTIVE" THEN [Total Amount] ELSE 0 END
  ```
- **Dwell Time Category (Nested IF):**
  ```tableau
  IF [Duration Hours] > 24 THEN "Multi-Day Long Stay (>24h)"
  ELSEIF [Duration Hours] > 4 THEN "Half-Day / Workday (4-24h)"
  ELSE "Short Stay (Under 4h)" END
  ```
- **Overstay Flag:**
  ```tableau
  IF ZN([Overstay Duration Minutes]) > 0 THEN "🚨 Overstay Violation" ELSE "✅ On-Schedule" END
  ```

### 4.2 Rank Calculations
Rank facilities dynamically by realized turnover:
1. Drag `Facility Name` to Rows and `SUM([Realized Revenue])` to Columns.
2. In the Marks card, drag `SUM([Realized Revenue])` to Label.
3. Right click the pill → **Quick Table Calculation → Rank**.
4. Set Compute Using: **Table (Down)**.
5. Formula executed under the hood: `RANK(SUM([Realized Revenue]), 'desc')`.

### 4.3 Running Totals
Track cumulative revenue across the calendar month:
1. Drag `Start Time` (Day) to Columns.
2. Drag `SUM([Realized Revenue])` to Rows.
3. Right click `SUM([Realized Revenue])` → **Quick Table Calculation → Running Total**.
4. Visualizes month-to-date fiscal progression toward targeted targets.

---

## 5. Visual Polish, Formatting & Organization

### 5.1 Sorting (Manual & Computed)
- **Computed Sort:** Right click `Facility Name` pill on Rows → **Sort** → Sort By: `Field` → Field Name: `Realized Revenue` → Order: `Descending`.
- **Manual Sort:** Click and drag individual facilities in the legend to place newly commissioned facilities at the top.

### 5.2 Data Labels & Custom Tooltips
1. Click **Tooltip** in the Marks Card:
   ```text
   Facility: <Facility Name> (<City>)
   Vehicle Category: <Vehicle Type>
   Realized Revenue: ₹<SUM(Realized Revenue)>
   Average Dwell: <AVG(Duration Hours)> Hours
   Conversion Rate: <[Completion Rate]>%
   ```
2. Format `Realized Revenue` number format: Right click measure → **Default Properties → Number Format → Currency (Custom)** → Prefix: `₹`, Decimals: `0`.

### 5.3 Folders for Measures and Dimensions
When working with dozens of columns, group them logically:
1. In the Data pane, click the search drop-down → **Group by Folder**.
2. Right click any field → **Create Folder**.
3. Create folders:
   - `📂 Financial & Billing Measures` (`Total Amount`, `Base Amount`, `Surge Fee`, `Overstay Fee`)
   - `📂 Spatial & Facility Dimensions` (`Facility Name`, `City`, `Slot Number`, `Zone`)
   - `📂 Vehicle & Customer Metadata` (`Vehicle Number`, `Fleet Class`, `Customer Name`)

### 5.4 Subtotals and Grand Totals
1. Create a matrix worksheet: Rows = `[Facility Name]`, `[Vehicle Type]`, Columns = `SUM([Realized Revenue])`.
2. Go to **Analysis → Totals → Show Column Grand Totals**.
3. Go to **Analysis → Totals → Add All Subtotals** to view facility-level aggregates alongside category splits.

---

## 6. Slicing, Filtering & Context Filters

### 6.1 Quick Filters
Add interactive user filters to any dashboard:
1. Drag `Status` to the **Filters Shelf**.
2. Right click the filter pill → **Show Filter**.
3. In the filter card, click the top-right caret → Choose **Multiple Values (Dropdown)**.

### 6.2 Top and Bottom Filters
Find the top 3 highest-yielding facilities:
1. Drag `Facility Name` to the Filters Shelf.
2. Click the **Top** tab → Select **By Field → Top 3 by SUM([Realized Revenue])**.

### 6.3 Context Filters (The Filter Pipeline)
In Tableau, dimension filters execute independently. If you want a "Top 3 Locations" filter to apply *only within a selected city*:
1. Drag `City` to the Filters Shelf.
2. Right click `City` → **Add to Context** (the pill turns gray).
3. Now `City` executes first, and the "Top 3" filter evaluates only against the cities that passed the context filter!

---

## 7. Performance & Ingestion: Extract Filters

### 7.1 Data Source Filters vs. Extract Filters
1. In the Data Source screen, top-right: Switch from **Live** to **Extract**.
2. Click **Edit...** next to Extract.
3. Click **Add Filter** → Select `Status` → Exclude `CANCELLED` and `FAILED`.
4. Click **OK** and save as `parkpulse_clean.hyper`.
5. Result: Dramatically speeds up dashboard rendering by pruning unneeded records before Tableau loads data into memory.

---

## 8. Dashboard Construction, Layouts & Objects

### 8.1 Dashboard Layout & Container Architecture
Never drop floating worksheets randomly. Use **Tiled Layout Containers**:
1. Open a new Dashboard (`1366 × 768 px Fixed`).
2. Drag a **Vertical Container** into the empty canvas.
3. Top Section: Drag a **Horizontal Container** for the Executive KPI scorecards.
4. Middle Section: Drag a **Horizontal Container** holding Viz 1 (Revenue Trend Line) and Viz 2 (Facility Leaderboard).
5. Bottom Section: Drag Viz 3 (Ingress Heatmap) and Viz 4 (Fleet Treemap).

### 8.2 Dashboard Objects
- **Text Object:** Add title `ParkPulse Analytics — Executive Operations Dashboard` (22pt, Bold, Cyan).
- **Image Object:** Insert project logo `public/assets/logo.png`.
- **Blank Spacers:** Insert 10px spacing between metric cards for clean visual breathing room.
- **Web Page Object:** Embed live IoT sensor telemetry URL.

### 8.3 Device Layouts (Device Previews)
1. Click **Device Preview** above the Dashboard pane.
2. Select **Device Type: Phone** → Model: **Generic Phone (375 × 667)**.
3. Click **Add Phone Layout**.
4. Tableau automatically reflows horizontal columns into a single vertical scrolling column optimal for mobile smartphones.

---

## 9. Stories & Tableau Public Cloud Publishing

### 9.1 Creating an Executive Story
A Tableau Story is a sequence of presentation points guiding stakeholders through data findings:
1. Click **New Story** tab.
2. **Story Point 1:** Drag Dashboard 1. Caption: *"Overall revenue grew 18% month-over-month driven by corporate park dwell."*
3. **Story Point 2:** Drag Dashboard 2. Caption: *"Morning commute (9–11 AM) and Evening retail (5–8 PM) create peak ingress congestion."*
4. **Story Point 3:** Drag Dashboard 3. Caption: *"Outlier audit identified ₹8,190 in recovered overstay fees with zero checkout fraud."*

### 9.2 Publishing to Tableau Public (Free Online Portfolio)
1. In Tableau Desktop, go to **Server → Tableau Public → Save to Tableau Public As...**.
2. Log in with your free Tableau Public account.
3. Name your workbook: `ParkPulse_Smart_Parking_BI_Platform`.
4. Ensure **Extract Data** was selected (Tableau Public requires data extracts).
5. Click **Save**. Tableau uploads the workbook and opens your interactive browser link!
6. Copy the Tableau Public URL into your college lab submission report.


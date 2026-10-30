# ParkPulse Analytics — Tableau Dashboard Construction Guide
**Platform:** ParkPulse Analytics — Smart Parking Business Intelligence Platform  
**Target:** 3 Enterprise-Grade Interactive Dashboards aligned with College BI Syllabus  
**Canvas Dimensions:** Desktop (1366 × 768 px, Fixed), Tablet (1024 × 768 px), Mobile (375 × 812 px)

---

## 1. Dashboard 1: Executive Overview

### 1.1 Objective & Target Audience
Designed for Senior Parking Operations Directors and City Hub Administrators. Delivers high-level business health indicators, daily revenue progression, facility rankings, and lifecycle conversion rates.

### 1.2 Layout & Container Wireframe
```
+---------------------------------------------------------------------------------+
|  PARKPULSE ANALYTICS — EXECUTIVE OVERVIEW                        [Filters Strip] |
+---------------------------------------------------------------------------------+
|  [KPI 1: Rev]  |  [KPI 2: Bookings]  |  [KPI 3: Avg Fare]  |  [KPI 4: Cancel Rate] |
+----------------------------------------+----------------------------------------+
|                                        |                                        |
|  VIZ 1: Daily Revenue Trend Line       |  VIZ 2: Facility Revenue Ranking       |
|  (With 7-Day Moving Average)           |  (Horizontal Bar Chart + City Badges)  |
|                                        |                                        |
+----------------------------------------+----------------------------------------+
|                                        |                                        |
|  VIZ 3: Lifecycle Status Distribution  |  VIZ 4: Fleet Segment Revenue Share    |
|  (Donut Chart with Conversion Pct)     |  (Treemap: Car, Bike, EV, Commercial)  |
|                                        |                                        |
+---------------------------------------------------------------------------------+
```

### 1.3 Sheet Specifications
1. **KPI Scorecards (Header Strip):**
   - **Measures:** `[Realized Revenue]`, `COUNT([Booking Id])`, `[Avg Revenue Per Completed Booking]`, `[Cancellation Rate]`.
   - **Formatting:** Big Number KPI card style (Font 24pt Bold), Subtitle (10pt Muted).
2. **Viz 1: Daily Revenue Trend Line:**
   - **Columns:** `DAY([Start Time])` (Continuous).
   - **Rows:** `SUM([Realized Revenue])`.
   - **Secondary Axis:** 7-Day Moving Average (`Quick Table Calculation → Moving Average (7 Days)`).
   - **Color:** Neon Cyan (`#06B6D4`).
3. **Viz 2: Facility Revenue Ranking:**
   - **Columns:** `SUM([Realized Revenue])`.
   - **Rows:** `[Facility Name]` (Sorted Descending).
   - **Labels:** Currency format with totals. Enable Grand Totals via **Analysis → Totals → Show Column Grand Totals**.
4. **Viz 3: Lifecycle Status Donut Chart:**
   - **Color:** `[Status]` (Green: Completed, Amber: Cancelled, Red: No-Show).
   - **Angle:** `COUNT([Booking Id])`.
   - **Center Hole:** Dual axis circle card showing `Total Reservations`.

---

## 2. Dashboard 2: Demand and Capacity Analysis

### 2.1 Objective & Target Audience
Designed for Facility Dispatchers, Traffic Engineers, and Staffing Planners. Identifies spatial congestion bottlenecks, peak entry velocity windows, and bay turnover efficiency.

### 2.2 Sheet Specifications
1. **Viz 1: 24-Hour Peak Ingress Density Profile:**
   - **Chart Type:** Area Chart / Bar Chart.
   - **Columns:** `DATEPART('hour', [Start Time])` (Discrete, 0 to 23).
   - **Rows:** `COUNT([Booking Id])`.
   - **Color Gradient:** Highlight 9–11 AM and 5–8 PM peak windows using `[Peak Hour Window]`.
2. **Viz 2: Day-of-Week vs. Hourly Ingress Heatmap:**
   - **Columns:** `DATEPART('hour', [Start Time])` (0–23).
   - **Rows:** `DATENAME('weekday', [Start Time])` (Sun–Sat).
   - **Color:** `COUNT([Booking Id])` (Sequential Orange-Cyan heatmap).
   - **Action:** Clicking on a heatmap cell filters the entire dashboard to that hour/day intersection.
3. **Viz 3: Bay Turnover & Utilization by Facility:**
   - **Rows:** `[Facility Name]`.
   - **Columns:** `[Turnover Per Bay]` (LOD Measure).
   - **Reference Line:** Target turnover benchmark line at `3.0 vehicles/bay/day`.
4. **Viz 4: Parking Duration Dwell Histogram:**
   - **Bin Size:** 1.0 Hour Bins on `[Duration Hours]`.
   - **Rows:** `COUNT([Booking Id])`.
   - **Observation:** Visualizes normal dwell (1–4 hrs) vs statistical outliers (> 24 hrs).

---

## 3. Dashboard 3: Revenue and Customer Analysis

### 3.1 Objective & Target Audience
Designed for Financial Analysts and Customer Loyalty Program Managers. Evaluates average spend per dwell hour, reward tier distribution, and high-value customer accounts.

### 3.2 Sheet Specifications
1. **Viz 1: Customer Spend vs. Dwell Time Scatterplot:**
   - **Columns:** `[Duration Hours]` (Continuous).
   - **Rows:** `[Total Amount]` (Continuous).
   - **Detail:** `[Booking Id]`.
   - **Color:** `[Vehicle Type]`.
   - **Trend Line:** Add Linear Trendline (**Analytics Tab → Trend Line**) to show correlation between parking dwell and bill amount.
2. **Viz 2: Revenue Contribution by Vehicle Class:**
   - **Chart Type:** Grouped Bar with Subtotals.
   - **Rows:** `[Vehicle Type]`.
   - **Columns:** `SUM([Realized Revenue])`, `AVG([Total Amount])`.
   - **Totals:** Enable Row Subtotals via **Analysis → Totals → Add All Subtotals**.
3. **Viz 3: Top 15 Customer Accounts Leaderboard:**
   - **Rows:** `[Customer Name]`.
   - **Columns:** `[Customer Lifetime Value]` (LOD).
   - **Color:** `[Customer Loyalty Tier]` (Gold, Silver, Bronze).
4. **Viz 4: Attrition Analysis (Cancellation & No-Show Root Cause):**
   - **Rows:** `[Facility Name]`.
   - **Columns:** `[Cancellation Rate]`, `[No-Show Rate]`.
   - **Chart Type:** Bullet graph or side-by-side bar.

---

## 4. Interactivity: Parameters, Sets & Filter Actions

### 4.1 Parameter 1: `Top N Facilities Filter`
- **Data Type:** Integer (Range 3 to 10, Step 1, Current Value: 5).
- **Usage:** In `Facility Revenue Ranking`, set Filter on `[Facility Name]` → Top → By Field: `Top [Top N Facilities Filter]` by `Sum of Realized Revenue`.

### 4.2 Parameter 2: `Tariff Hike Simulator Multiplier`
- **Data Type:** Float (Range 1.00 to 1.50, Step 0.05).
- **Calculated Field:** `[Simulated Revenue] = [Realized Revenue] * [Tariff Hike Simulator Multiplier]`.
- **Purpose:** What-if scenario analysis during viva or management presentation.

### 4.3 Set 1: `Outlier Bookings Set`
- **Definition:** Condition: `[Duration Hours] > 24 OR [Total Amount] > 1500`.
- **Action:** Color code marks In/Out of the Set to instantly spotlight data anomalies.

### 4.4 Dashboard Filter Actions
1. **Source:** `Facility Revenue Ranking` → **Target:** All dashboard sheets (Selected fields: `Location Id`).
2. **Source:** `Heatmap Hour Cell` → **Target:** `Ingress Profile` (Selected fields: `Start Time`).

---

## 5. Layout Containers & Device Preview Guidance

### 5.1 Professional Container Architecture
- Use **Vertical Containers** for top-to-bottom card stacking.
- Place metric cards inside a nested **Horizontal Container** with **Distribute Evenly** enabled.
- Set outer padding to 8px and inner padding to 4px for clean margins.

### 5.2 Device Preview Adaptations
1. **Desktop (Default):** 1366 × 768 px fixed grid. Full 4-quadrant layout with interactive side filter bar.
2. **Tablet Preview (1024 × 768 px):** Collapse 4 columns into 2 × 2 grid.
3. **Mobile Phone Preview (375 × 812 px):**
   - Set container order to Single Column vertical flow.
   - Stack KPI cards into a 2 × 2 grid.
   - Hide dense Heatmap viz; display Top 5 Facilities and Daily Trend line.

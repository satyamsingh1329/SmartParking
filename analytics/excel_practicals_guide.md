# ParkPulse Analytics — Excel Practicals & Syllabus Reference Guide
**Course:** Data Analytics / Business Intelligence Lab (MCA Curriculum)  
**Platform:** ParkPulse Analytics — Smart Parking Business Intelligence Platform  
**Target Workbook:** [`ParkPulse_Analytics_Practicals.xlsx`](file:///Volumes/Mac%20A/SmartParking/analytics/ParkPulse_Analytics_Practicals.xlsx)  
**Dataset Directory:** [`analytics/datasets/`](file:///Volumes/Mac%20A/SmartParking/analytics/datasets/) (`bookings.csv`, `customers.csv`, `parking_locations.csv`, `parking_sessions.csv`)

---

## 1. Overview of the Excel Analytics Architecture

The accompanying workbook [`ParkPulse_Analytics_Practicals.xlsx`](file:///Volumes/Mac%20A/SmartParking/analytics/ParkPulse_Analytics_Practicals.xlsx) contains six fully formatted worksheets demonstrating spreadsheet operations, logical formulas, conditional aggregations, lookups, statistical distribution, Tukey IQR outlier detection, and pivot tables:

1. **`Bookings_Data`**: 500 records of smart parking transactions (Duration, Base Amount, Surge, Total Fee, Status, Vehicle Type).
2. **`Customers`**: Master customer directory with `User_ID`, `Name`, `Email`, `Phone`, `Reward_Points`.
3. **`Locations`**: Master facility directory (`CAMPUS`, `MALL`, `TECHPARK`, `METRO`, `HOSPITAL`) with hourly tariffs.
4. **`Formula_Practicals`**: Live working column formulas demonstrating logical, lookup, error handling, and threshold flagging.
5. **`Summary_KPIs_Formulas`**: Aggregation KPIs (SUMIF, COUNTIF, AVERAGEIF, MEAN, MEDIAN, MODE, STDEV, IQR).
6. **`Pivot_Guide_&_Scenarios`**: Architectural specifications for 4 real-world business intelligence pivot tables.

---

## 2. Topic 1: Core Spreadsheet Operations

### 2.1 String Concatenation
- **Objective:** Create a unified alphanumeric vehicle descriptor combining vehicle category and registration license number.
- **Formula (CONCAT / Text Operator):**
  ```excel
  =CONCAT(UPPER(Bookings_Data!F2), " - ", Bookings_Data!E2)
  ```
  *Alternative syntax:*
  ```excel
  =UPPER(Bookings_Data!F2) & " [" & Bookings_Data!E2 & "]"
  ```
- **Output:** `"CAR - DL01AB1234"`

### 2.2 Data Formatting
- **Currency Format (INR ₹):** Select `Total_Amount` (Column N) → Format Cells (`Ctrl + 1`) → **Currency** → Symbol: `₹ English (India)` → Decimal places: `2`.
- **Date & Time Format:** Select `Start_Time` (Column G) → Format Cells → **Custom** → `yyyy-mm-dd hh:mm`.
- **Percentage Format:** Select `Surge_Multiplier` (Column K) → Format Cells → **Percentage** (or `0.00x`).

### 2.3 Sorting & Multi-Level Filtering
1. **Multi-Level Sort:**
   - Select range `Bookings_Data!A1:P501`.
   - Go to **Data → Sort**.
   - Level 1: `Location_ID` (A to Z).
   - Level 2: Add Level → `Total_Amount` (Largest to Smallest).
   - Business Purpose: Instantly reveals top-spending commuters within each respective parking facility.
2. **Autofilter:**
   - Press `Ctrl + Shift + L` to toggle Autofilter drop-downs on row 1.
   - Filter for `Vehicle_Type = "ev"` AND `Payment_Status = "paid"`.

### 2.4 Conditional Formatting Rules
1. **Highlight Statistical Outliers (Red Fill):**
   - Range: `Bookings_Data!I2:I501` (Duration)
   - Rule: **Highlight Cells Rules → Greater Than → 24**
   - Format: Light Red Fill with Dark Red Text (`#FEE2E2` / `#991B1B`).
2. **Highlight Premium Revenue Bookings (Green Fill):**
   - Range: `Bookings_Data!N2:N501` (Total Amount)
   - Rule: **Highlight Cells Rules → Greater Than → 250**
   - Format: Soft Green Fill (`#DCFCE7` / `#166534`).
3. **Status Traffic Light Icons:**
   - Range: `Bookings_Data!O2:O501`
   - Conditional Formatting → Highlight Cells Rules → Text that Contains:
     - `"COMPLETED"`: Green
     - `"ACTIVE"`: Cyan / Blue
     - `"CANCELLED"`: Amber
     - `"NO_SHOW"`: Red

---

## 3. Topic 2: Logical Functions (IF, Nested IF, AND, OR, NOT, IFERROR)

### 3.1 Single IF Statement
- **Objective:** Classify whether a parking reservation is finalized or unsettled.
- **Formula:**
  ```excel
  =IF(Bookings_Data!O2="COMPLETED", "Settled & Verified", "Unsettled / Pending")
  ```

### 3.2 Nested IF Statement: Multi-Tier Occupancy & Yield Rating
- **Objective:** Classify revenue yield into tiered operational categories.
- **Formula:**
  ```excel
  =IF(Bookings_Data!N2>250, "Tier 1 (Premium / Surge)", IF(Bookings_Data!N2>100, "Tier 2 (Standard)", "Tier 3 (Short-Stay)"))
  ```

### 3.3 Facility Occupancy Rating (Low, Medium, High)
- **Objective:** Dynamically categorize bay occupancy percentage into Low, Medium, or High bands.
- **Formula:**
  ```excel
  =IF(D2>=80, "High Occupancy (Surge Candidate)", IF(D2>=50, "Medium Occupancy (Balanced)", "Low Occupancy (Underutilized)"))
  ```

### 3.4 Compound Conditions: AND, OR, NOT
- **Scenario A (AND + OR):** Identify high-value parking assets (Cars or EVs yielding over ₹150).
  ```excel
  =IF(AND(Bookings_Data!N2>150, OR(Bookings_Data!F2="car", Bookings_Data!F2="ev")), "★ High-Yield Asset", "Standard Dwell")
  ```
- **Scenario B (NOT):** Flag all records that are not standard personal four-wheelers.
  ```excel
  =IF(NOT(Bookings_Data!F2="car"), "Specialized Category", "Standard Four-Wheeler")
  ```

### 3.5 Error Handling: IFERROR
- **Objective:** Prevent `#N/A` or `#VALUE!` errors when looking up facility codes.
- **Formula:**
  ```excel
  =IFERROR(VLOOKUP(Bookings_Data!C2, Locations!A:C, 3, FALSE), "Location Not Found")
  ```

---

## 4. Topic 3: Conditional Aggregations (SUMIF/SUMIFS, AVERAGEIF/AVERAGEIFS, COUNTIF/COUNTIFS)

| Syllabus Function | Business Analytical Question | Exact Excel Formula |
| :--- | :--- | :--- |
| **`COUNTIF`** | Total completed parking transactions | `=COUNTIF(Bookings_Data!O:O, "COMPLETED")` |
| **`COUNTIF`** | Total customer cancellations | `=COUNTIF(Bookings_Data!O:O, "CANCELLED")` |
| **`COUNTIF`** | Reservations exceeding 4 hours | `=COUNTIF(Bookings_Data!I:I, ">4")` |
| **`COUNTIF`** | Total reservations for Cars | `=COUNTIF(Bookings_Data!F:F, "car")` |
| **`COUNTIFS`** | Cancelled four-wheeler reservations | `=COUNTIFS(Bookings_Data!F:F, "car", Bookings_Data!O:O, "CANCELLED")` |
| **`COUNTIFS`** | Peak-hour EV reservations (Surge Active) | `=COUNTIFS(Bookings_Data!F:F, "ev", Bookings_Data!K:K, ">1.0")` |
| **`SUMIF`** | Total revenue from facility `LOC-101` | `=SUMIF(Bookings_Data!C:C, "LOC-101", Bookings_Data!N:N)` |
| **`SUMIF`** | Total collected revenue from Electric Vehicles | `=SUMIF(Bookings_Data!F:F, "ev", Bookings_Data!N:N)` |
| **`SUMIFS`** | Realized revenue from completed Car sessions | `=SUMIFS(Bookings_Data!N:N, Bookings_Data!F:F, "car", Bookings_Data!O:O, "COMPLETED")` |
| **`AVERAGEIF`** | Average parking duration at facility `LOC-101` | `=AVERAGEIF(Bookings_Data!C:C, "LOC-101", Bookings_Data!I:I)` |
| **`AVERAGEIF`** | Average ticket size across Two-Wheelers (Bikes) | `=AVERAGEIF(Bookings_Data!F:F, "bike", Bookings_Data!N:N)` |
| **`AVERAGEIFS`**| Average fare for completed standard cars | `=AVERAGEIFS(Bookings_Data!N:N, Bookings_Data!F:F, "car", Bookings_Data!O:O, "COMPLETED")` |

---

## 5. Topic 4: Lookup & Reference Functions (VLOOKUP, XLOOKUP, INDEX-MATCH)

### 5.1 Modern XLOOKUP
- **Formula:**
  ```excel
  =XLOOKUP(Bookings_Data!B2, Customers!A:A, Customers!B:B, "Guest User")
  ```
- **Benefits:** Left-to-right independence, native `#N/A` handling, and robust against inserted columns.

### 5.2 Classic VLOOKUP
- **Formula (Looking up Facility Name using Facility ID):**
  ```excel
  =VLOOKUP(Bookings_Data!C2, Locations!A:C, 3, FALSE)
  ```
- **Range:** `Locations!A:C` (Column 1 is `location_id`, Column 3 is `name`).

### 5.3 INDEX & MATCH Alternative
- **Formula:**
  ```excel
  =INDEX(Locations!C:C, MATCH(Bookings_Data!C2, Locations!A:A, 0))
  ```

---

## 6. Topic 5: Central Tendency & Statistical Outlier Identification (IQR)

### 6.1 Measures of Central Tendency
- **Mean (Average Ticket Size):** `=AVERAGE(Bookings_Data!N2:N501)`
- **Median (50th Percentile Duration):** `=MEDIAN(Bookings_Data!I2:I501)`
- **Mode (Most Frequent Dwell Time):** `=MODE.SNGL(Bookings_Data!I2:I501)`
- **Sample Standard Deviation:** `=STDEV.S(Bookings_Data!N2:N501)`

### 6.2 Tukey's Interquartile Range (IQR) Outlier Method
1. **First Quartile (Q1):** `=QUARTILE.INC(Bookings_Data!I2:I501, 1)`
2. **Third Quartile (Q3):** `=QUARTILE.INC(Bookings_Data!I2:I501, 3)`
3. **Interquartile Range (IQR):** `=D16 - D15` *(Q3 Cell - Q1 Cell)*
4. **Upper Outlier Fence:** `=D16 + (1.5 * D17)` *(Q3 + 1.5 × IQR)*
5. **Lower Outlier Fence:** `=MAX(0, D15 - (1.5 * D17))` *(Q1 - 1.5 × IQR)*
6. **Row-Level Outlier Flag:**
   ```excel
   =IF(OR(Bookings_Data!I2 > 24, Bookings_Data!N2 > 1500), "🚨 STATISTICAL OUTLIER", "NORMAL")
   ```

---

## 7. Topic 6: Pivot Tables, Grouping & Multi-Pivot Worksheets

### Pivot Table 1: Facility Revenue Performance Matrix
- **Data Source:** `Bookings_Data!A1:P501`
- **Rows:** `Location_ID`
- **Columns:** `Vehicle_Type`
- **Values:** `Sum of Total_Amount` (Formatted as Currency `₹`)
- **Filters:** `Status = COMPLETED`

### Pivot Table 2: Ingress Hourly Density with Grouping
- **Data Source:** `Bookings_Data!A1:P501`
- **Rows:** `Start_Time` (Right-click row label → **Group → By Hours**)
- **Columns:** `Start_Time` (Group → **By Days / Weekday**)
- **Values:** `Count of Booking_ID`
- **Observation:** Visualizes peak commuter ingress clusters between 9–11 AM and 5–8 PM.

### Pivot Table 3: Lifecycle Conversion & Attrition
- **Rows:** `Location_ID`
- **Columns:** `Status`
- **Values:** `Count of Booking_ID` → Value Field Settings → **Show Values As → % of Row Total**.

### Multi-Pivot Worksheets in Microsoft Excel
To place multiple Pivot Tables on a single worksheet:
1. Insert Pivot Table 1 starting at cell `A3`.
2. Insert Pivot Table 2 starting at cell `H3` (leaving 2 blank columns between tables to prevent layout expansion collisions).
3. Connect a shared **Timeline Slicer** (`Insert → Slicer → Start_Time`) to both Pivot Tables via **Report Connections**.

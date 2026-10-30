# ParkPulse Analytics — Tableau Calculated Field Formulas
**Platform:** ParkPulse Analytics — Smart Parking Business Intelligence Platform  
**Purpose:** Copy-paste ready Tableau formulas for measures, dimensions, LOD expressions, and segmentations.

---

## 1. Core Revenue & Financial Measures

### 1.1 Realized Revenue (Excludes Cancelled/Failed)
```tableau
// Field Name: Realized Revenue
IF [Status] = "COMPLETED" OR [Status] = "CONFIRMED" OR [Status] = "ACTIVE" THEN
    [Total Amount]
ELSE
    0
END
```

### 1.2 Average Revenue Per Completed Booking
```tableau
// Field Name: Avg Revenue Per Completed Booking
SUM(IF [Status] = "COMPLETED" THEN [Total Amount] ELSE 0 END) 
/ 
COUNT(IF [Status] = "COMPLETED" THEN [Booking Id] END)
```

### 1.3 Total Overstay Penalty Collected
```tableau
// Field Name: Total Overstay Penalties
ZN(SUM([Overstay Fee]))
```

---

## 2. Operational & Lifecycle Metrics

### 2.1 Cancellation Rate
```tableau
// Field Name: Cancellation Rate
COUNT(IF [Status] = "CANCELLED" THEN [Booking Id] END) 
/ 
COUNT([Booking Id])
```
*Format: Percentage with 1 decimal place (e.g. 12.4%).*

### 2.2 No-Show Rate
```tableau
// Field Name: No-Show Rate
COUNT(IF [Status] = "NO_SHOW" OR [Status] = "EXPIRED" THEN [Booking Id] END) 
/ 
COUNT([Booking Id])
```

### 2.3 Completed Booking Conversion Rate
```tableau
// Field Name: Completion Rate
COUNT(IF [Status] = "COMPLETED" THEN [Booking Id] END) 
/ 
COUNT([Booking Id])
```

---

## 3. Temporal & Peak-Demand Dimensions

### 3.1 Peak-Hour Operational Window
```tableau
// Field Name: Peak Hour Window
IF DATEPART('hour', [Start Time]) >= 9 AND DATEPART('hour', [Start Time]) <= 11 THEN
    "🌅 Morning Commuter Peak (9-11 AM)"
ELSEIF DATEPART('hour', [Start Time]) >= 17 AND DATEPART('hour', [Start Time]) <= 20 THEN
    "🌆 Evening Retail Peak (5-8 PM)"
ELSEIF DATEPART('hour', [Start Time]) >= 0 AND DATEPART('hour', [Start Time]) <= 5 THEN
    "🌙 Off-Peak Overnight"
ELSE
    "☀️ Regular Business Hours"
END
```

### 3.2 Weekday vs. Weekend Segmentation
```tableau
// Field Name: Day Type
IF DATEPART('weekday', [Start Time]) = 1 OR DATEPART('weekday', [Start Time]) = 7 THEN
    "Weekend (Sat-Sun)"
ELSE
    "Weekday (Mon-Fri)"
END
```

### 3.3 Day of Week Name
```tableau
// Field Name: Day Name
DATENAME('weekday', [Start Time])
```

---

## 4. Level of Detail (LOD) Expressions

### 4.1 Facility Total Capacity (Fixed LOD)
Prevents duplicate summing of static capacity rows when joining multiple bookings:
```tableau
// Field Name: Facility Capacity (LOD)
{ FIXED [Location Id] : MAX([Total Capacity]) }
```

### 4.2 Facility Turnover Rate
Measures vehicles parked per bay:
```tableau
// Field Name: Turnover Per Bay
COUNT(IF [Status] = "COMPLETED" THEN [Booking Id] END) 
/ 
[Facility Capacity (LOD)]
```

### 4.3 Customer Total Lifetime Value (CLV)
```tableau
// Field Name: Customer Lifetime Value
{ FIXED [User Id] : SUM([Realized Revenue]) }
```

---

## 5. Statistical Outliers & Health Flags

### 5.1 Outlier Flag (Duration > 24h OR Revenue > ₹1500)
```tableau
// Field Name: Statistical Outlier Flag
IF [Duration Hours] > 24 OR [Total Amount] > 1500 THEN
    "🚨 Outlier / Anomaly"
ELSE
    "Standard Session"
END
```

### 5.2 Customer Loyalty Tier
```tableau
// Field Name: Customer Loyalty Tier
IF [Reward Points] >= 500 THEN
    "🥇 Gold Member"
ELSEIF [Reward Points] >= 200 THEN
    "🥈 Silver Member"
ELSE
    "🥉 Bronze Member"
END
```

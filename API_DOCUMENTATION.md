# 🚗 ParkPulse API Reference & Architecture Documentation

**ParkPulse** is a production-style Smart Parking, IoT Telemetry, and Predictive Intelligence Platform.

Base URL: `http://localhost:5001/api`

---

## 1. Authentication & Identity (`/api/auth`)

### `POST /api/auth/register`
* **Description:** Public commuter registration. Strictly enforces `role: "USER"` to prevent privilege escalation.
* **Auth:** None (Public)
* **Request Body:**
```json
{
  "name": "Alex Rivera",
  "email": "user@parkpulse.com",
  "password": "user123",
  "phone": "+91 9876543212"
}
```
* **Response (201 Created):**
```json
{
  "success": true,
  "message": "User registered successfully",
  "token": "eyJhbGciOiJIUzI1...",
  "user": {
    "id": "6ac3eaf...",
    "name": "Alex Rivera",
    "email": "user@parkpulse.com",
    "role": "USER",
    "rewardPoints": 50
  }
}
```

### `POST /api/auth/login`
* **Description:** Authenticate with email and password to receive JWT. Rate limited to 30 requests per 15 minutes.
* **Auth:** None (Public)
* **Request Body:**
```json
{
  "email": "admin@parkpulse.com",
  "password": "admin123"
}
```
* **Response (200 OK):** Returns JWT token and user profile including role (`USER`, `GATEKEEPER`, `ADMIN`).

### `POST /api/auth/staff`
* **Description:** Provision new `ADMIN` or `GATEKEEPER` personnel.
* **Auth:** Bearer Token (ADMIN only)
* **Request Body:**
```json
{
  "name": "Gate Operator 1",
  "email": "gate2@parkpulse.com",
  "password": "securepassword",
  "role": "GATEKEEPER",
  "phone": "+91 9876543219"
}
```

---

## 2. Multi-Facility Parking Network (`/api/parking`)

### `GET /api/parking`
* **Description:** Retrieve all parking facilities in network with live capacity, available slots, coordinates, and operating hours.
* **Auth:** Public
* **Response (200 OK):**
```json
{
  "success": true,
  "count": 5,
  "data": [
    {
      "_id": "...",
      "name": "University Campus Central",
      "code": "CAMPUS",
      "category": "campus",
      "stats": { "total": 110, "available": 92, "occupied": 17, "occupancyRate": 15 }
    }
  ]
}
```

---

## 3. Parking Bays & Intelligent Recommendation (`/api/slots`)

### `GET /api/slots`
* **Description:** List parking slots filtered by `locationId`, `floor`, `zone`, `status`, `type`.
* **Auth:** Public

### `GET /api/slots/recommend`
* **Description:** Intelligent Multi-Factor Recommendation Engine. Filters strictly for available bays and calculates optimal weighted match score.
* **Query Params:** `locationId`, `vehicleType`, `requiresEV`, `floor`
* **Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "bestSlot": { "slotNumber": "A-103", "floor": 1, "zone": "A", "pricePerHour": 40 },
    "matchScore": 92,
    "whyRecommended": "Closest compatible slot with low zone congestion and zero wait time.",
    "reasonsList": [
      "✓ Available now",
      "✓ 22m walking distance to entrance",
      "✓ Low zone congestion & smooth lane exit",
      "✓ Economical rate tier"
    ]
  }
}
```

---

## 4. Bookings & Reservations (`/api/bookings`)

### `POST /api/bookings/quote`
* **Description:** Calculate real-time dynamic pricing quote based on database rules (`PricingRule`), duration tiers, surge, and EV tariffs.
* **Auth:** Public

### `POST /api/bookings`
* **Description:** Create atomic booking reservation with concurrency lock (`findOneAndUpdate`) and QR pass generation.
* **Auth:** Bearer Token (USER)
* **Request Body:**
```json
{
  "slotId": "6ac3eaf1...",
  "locationId": "6ac3eaf1...",
  "vehicleNumber": "DL01AB1234",
  "vehicleType": "car",
  "durationHours": 2,
  "paymentMethod": "mock_card",
  "valetRequested": false
}
```

### `GET /api/bookings/:id`
* **Description:** Get single booking permit. Strict ownership isolation enforced (403 for unauthorized users).

### `PATCH /api/bookings/:id/cancel`
* **Description:** Cancel booking and release slot to `available`. Strict ownership enforced.

### `PATCH /api/bookings/:id/extend`
* **Description:** Extend booking duration by additional hours with dynamic price recalculation. Strict ownership enforced.

---

## 5. IoT Sensor Hardware & Telemetry (`/api/sensors`)

### `POST /api/sensors/event`
* **Description:** Protected IoT sensor webhook. Processes proximity entry/exit events, creates active sessions, updates slots, and broadcasts Socket.IO events.
* **Auth:** `x-sensor-key` header matching hashed key OR Operator/Admin JWT.
* **Request Body:**
```json
{
  "sensorId": "US-F1-A01",
  "eventType": "entry",
  "batteryLevel": 92,
  "signalStrength": -65
}
```

### `POST /api/sensors/heartbeat`
* **Description:** Sensor telemetry keep-alive. Updates `lastHeartbeat` and confirms online status.
* **Auth:** `x-sensor-key` or Operator JWT.

### `GET /api/sensors`
* **Description:** Live fleet management view with health status, battery, signal strength, and assigned slots.
* **Auth:** Bearer Token (ADMIN, GATEKEEPER)

---

## 6. ANPR / License Plate Recognition (`/api/anpr`)

### `POST /api/anpr/simulate`
* **Description:** Optical gate simulation pipeline. Performs OCR lookup, checks permits and parking passes, creates active sessions, and authorizes barrier opening.
* **Request Body:**
```json
{
  "vehicleNumber": "DL01AB1234",
  "gateType": "ENTRY"
}
```
* **Response (200 OK):**
```json
{
  "success": true,
  "simulation": true,
  "data": {
    "authorized": true,
    "gateAction": "OPEN",
    "mode": "PASS",
    "confidence": 0.99,
    "plateNumber": "DL01AB1234",
    "slotNumber": "EV-103",
    "message": "MONTHLY pass accepted. Proceed to Bay EV-103."
  }
}
```

---

## 7. EV Charging Management (`/api/ev`)

### `GET /api/ev/stations`
* **Description:** List all EV fast chargers with power ratings, connector types (`CCS2`, `Type2`), and real-time charging status.
* **Auth:** Public

### `POST /api/ev/start`
* **Description:** Commence an EV charging session linked to user and vehicle.
* **Auth:** Bearer Token (USER)

### `POST /api/ev/stop`
* **Description:** Conclude EV charging, compute consumed energy (kWh) and tariff fee, and release station.
* **Auth:** Bearer Token (USER owner, GATEKEEPER, ADMIN)

---

## 8. Parking Passes (`/api/passes`)

### `POST /api/passes/purchase`
* **Description:** Purchase a `DAILY`, `WEEKLY`, `MONTHLY`, `STUDENT`, `EMPLOYEE`, or `VIP` parking pass.
* **Auth:** Bearer Token (USER)

### `POST /api/passes/validate`
* **Description:** Verify if a license plate has an active valid pass for a facility/zone.
* **Auth:** Bearer Token (GATEKEEPER, ADMIN)

---

## 9. AI / ML Predictive Intelligence (`/api/predictions`)

### `GET /api/predictions/availability`
* **Description:** Multi-variate regression temporal forecasting model. Returns predicted availability for 15, 30, 60, and 120 minutes ahead, weather context, and data-driven peak hour analysis.
* **Auth:** Public

---

## 10. Admin Analytics & Real KPIs (`/api/admin`)

### `GET /api/admin/dashboard`
* **Description:** Real-time database metrics: total capacity, available, occupied, reserved, active sessions, and today's aggregated revenue.
* **Auth:** Bearer Token (ADMIN)

### `GET /api/admin/analytics`
* **Description:** MongoDB aggregation pipeline analytics: hourly entry traffic, 7-day revenue, zone distribution, slot turnover, average dwell duration, cancellation rate, and no-show rate.
* **Auth:** Bearer Token (ADMIN)

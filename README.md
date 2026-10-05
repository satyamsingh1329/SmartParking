# 🚗 ParkPulse

> **“Find. Reserve. Park. Move.”**
>
> Next-Gen Real-Time Smart Parking Automation, Space Allocation & Dynamic Telemetry Platform

---

## 📌 Problem Statement

In modern university campuses, commercial hubs, hospitals, and tech parks, drivers waste an average of 15 to 20 minutes circling packed lots searching for open bays. Meanwhile, parking operators lack centralized, real-time visibility into multi-floor occupancy, bay turnarounds, gate traffic, demand surges, and revenue leaks.

---

## 💡 Solution

**ParkPulse** bridges physical parking facilities and digital reservation workflows:
* **Zero-Latency Telemetry:** Socket.io bidirectional event broadcasting synchronizes slot states across every connected screen.
* **Intelligent Space Allocation:** Multi-factor weighted recommendation algorithm ("Find My Best Slot") calculates optimal bays based on walking distance, EV charging needs, vehicle compatibility, and zone congestion.
* **Atomic Race Protection:** Strict MongoDB `findOneAndUpdate({ status: 'available' })` queries ensure two simultaneous drivers can never book the same spot.
* **Frictionless Gate Access:** Instant digital passes with secure QR barcodes for barrier check-in/out and digital receipt generation.
* **Dynamic Pricing Engine:** Configurable duration tiers, automated 80%+ demand surge multipliers (1.25x/1.50x), and EV charging tariffs.
* **15-Minute Auto-Release:** Background cron job cleans up abandoned reservations, immediately returning spots to the available pool.
* **Hardware-Free IoT Simulation:** Built-in interactive simulator mimicking ultrasonic sensor triggers for vehicles entering and leaving bays.

---

## 🏗️ Architecture & Technology Stack

```
             ┌──────────────────────────────────────────────┐
             │       ParkPulse Client (Vanilla JS ES6+)     │
             │   Glassmorphism UI • 2D Map • Chart.js • QR   │
             └──────────────────────┬───────────────────────┘
                                    │
                       HTTP REST    │   Socket.io WebSockets
                       (JWT Auth)   │   (Bidirectional Events)
                                    ▼
             ┌──────────────────────────────────────────────┐
             │            Node.js / Express Server          │
             │  Rate Limiting • State Machine • Cron Jobs   │
             └──────────────┬───────────────────┬───────────┘
                            │                   │
                            ▼                   ▼
                     ┌──────────────┐   ┌──────────────┐
                     │   MongoDB    │   │  Socket.io   │
                     │  (Mongoose)  │   │  Broadcast   │
                     └──────────────┘   └──────────────┘
```

### Frontend
* **Vanilla HTML5 & Semantic Web**
* **Modern CSS3:** CSS Custom Properties, Glassmorphism (`backdrop-filter`), CSS Grid, Flexbox, responsive design, Dark/Light mode toggle.
* **Modular ES6+ JavaScript:** Modules (`parking.js`, `booking.js`, `dashboard.js`, `gatekeeper.js`, `admin.js`, `socket.js`, `auth.js`, `utils.js`).
* **Libraries (CDN):**
  * `Socket.io Client` (v4.8.1)
  * `Chart.js` (v4.4.7)
  * `QRCode.js` (v1.0.0)
  * `canvas-confetti` (v1.9.3)
  * Google Fonts (`Inter`, `JetBrains Mono`)

### Backend
* **Runtime:** Node.js (v20+ / v26 compatible)
* **Framework:** Express.js
* **Real-Time Engine:** Socket.io
* **Database Driver:** Mongoose (v8+)
* **Authentication:** JSON Web Tokens (JWT) + `bcryptjs`
* **Security:** `helmet`, `cors`, `express-rate-limit`

---

## 🗄️ Database Models (`models/`)

1. **`User`**: Account credentials, roles (`USER`, `ADMIN`, `GATEKEEPER`), loyalty reward points balance.
2. **`Vehicle`**: Registered commuter vehicles (`car`, `bike`, `ev`), license plate numbers, primary flag.
3. **`ParkingLocation`**: Facilities (Campus, Mall, Tech Park, Hostel, Hospital), floor counts, zones (`A`, `B`, `C`, `D`), amenities, base rates.
4. **`ParkingSlot`**: Bay numbers (e.g. `A-101`, `EV-102`, `PWD-105`), floor, zone, slot type (`standard`, `ev`, `vip`, `accessible`), status (`available`, `reserved`, `occupied`), sensor ID, distance to gate, timestamps.
5. **`Booking`**: Unique collision-resistant ID (`PP-2026-XXXX`), user ref, bay ref, vehicle info, duration, breakdown, QR code data URL, status (`CONFIRMED`, `ACTIVE`, `COMPLETED`, `CANCELLED`, `EXPIRED`).
6. **`ParkingSession`**: Active barrier check-in records, entry/exit timestamps, overstay minutes, fee accrual.
7. **`Payment`**: Mock transaction records, method (`mock_upi`, `mock_card`, `mock_wallet`, `reward_points`).
8. **`PricingRule`**: Duration tiers, surge thresholds (e.g. 80%), surge multiplier (1.25x), EV tariffs, convenience fee, tax percentage.
9. **`Notification`**: Persistent user alerts (`booking_confirmed`, `slot_expired`, `overstay_alert`, etc.).
10. **`Favorite`**: Saved favorite parking locations.
11. **`RewardTransaction`**: History of points earned (1 pt per ₹10 spent) and redeemed (100 pts = ₹20 discount).

---

## ⚡ Real-Time Socket.io Architecture

When a driver reserves a slot, or an IoT sensor detects a vehicle:
```text
Sensor / User Action ──► Express Backend ──► MongoDB Atomic Update ──► Socket.io Broadcast ──► All Connected Browsers
```

### Event Names
* **Telemetry & Slots:** `slots:init`, `slots:request`, `slot:updated`, `slot:reserved`, `slot:occupied`, `slot:released`, `slot:expired`
* **Bookings & Permits:** `booking:created`, `booking:confirmed`, `booking:cancelled`, `booking:expired`
* **Active Parking Session:** `parking:started`, `parking:extended`, `parking:overstay`, `parking:completed`
* **Aggregated Stats:** `stats:init`, `stats:request`, `stats:updated`, `occupancy:updated`, `revenue:updated`
* **IoT Sensor Simulation:** `sensor:simulate`, `sensor:entry`, `sensor:exit`, `sensor:trigger`
* **Alerts:** `alert:overstay`, `notification:new`, `notification:broadcast`

---

## 🔒 Atomic Booking Protection (Section 7, 72)

To prevent race conditions where two users click "Reserve" on the exact same bay simultaneously:
```javascript
const reservedSlot = await ParkingSlot.findOneAndUpdate(
  { _id: slotId, status: 'available' },
  { status: 'reserved', reservedAt: new Date() },
  { new: true }
);

if (!reservedSlot) {
  const err = new Error(`Slot was just reserved by another user. Please select another slot.`);
  err.statusCode = 409;
  throw err;
}
```
If User A and User B collide:
* User A receives `201 Created` with valid booking pass.
* User B receives `409 Conflict` with a user-friendly toast notification.

---

## 🧠 Smart Slot Recommendation Engine (Section 13, 14)

Triggered via **"Find My Best Slot"**:
* **Distance from entrance:** 30% weight
* **Vehicle type compatibility:** 20% weight
* **Instant bay availability:** 20% weight
* **Hourly pricing tier:** 15% weight
* **Zone congestion ratio:** 10% weight
* **Category preference (EV/PWD/VIP):** 5% weight

Returns match score (e.g. `94%`) along with clear explainability (e.g. *"Closest compatible bay with low zone congestion and zero wait time"*).

---

## ⏱️ 15-Minute Unclaimed Auto-Release (Section 27)

A persistent background cron interval runs every 30 seconds:
1. Queries slots with `status: 'reserved'` and `reservedAt < 15 minutes ago`.
2. Marks associated booking `status: 'EXPIRED'`.
3. Resets slot to `status: 'available'`, `currentBooking: null`, `reservedAt: null`.
4. Broadcasts `slot:expired`, `slot:updated`, and `stats:updated` over WebSockets to restore emerald glow on all connected 2D floor maps without any page reload.

---

## 🚀 Installation & Quickstart

### 1. Prerequisites
* Node.js (v18+)
* MongoDB running locally on standard port `27017`

### 2. Install Dependencies
```bash
npm install
```

### 3. Seed Database
Seeds 5 facilities, 220+ slots, demo accounts, and pricing rules:
```bash
npm run seed
```

### 4. Run Automated Test Suite
Runs backend concurrency tests, atomic race tests, and multi-client real-time WebSocket tests:
```bash
npm test
```

### 5. Start Application
```bash
npm start
```
Open **[http://localhost:5001](http://localhost:5001)** in your browser.

*(Note: Automatically falls back to port `5001` or `5002` if port `5000` is used by macOS AirPlay).*

---

## 🔑 Demo Credentials

| Role | Email | Password | Access Capabilities |
| :--- | :--- | :--- | :--- |
| **Driver / User** | `user@parkpulse.com` | `user123` | Find & reserve slots, view pass, live countdown timer, vehicle manager, loyalty points |
| **Gatekeeper** | `gatekeeper@parkpulse.com` | `gate123` | Optical QR scanner, barrier check-in, check-out, overstay tracking, print receipts |
| **Administrator**| `admin@parkpulse.com` | `admin123` | Control center, live IoT sensor simulator, Chart.js analytics, audit log |

*(Tip: The login page includes 1-click demo login buttons to instantly switch between roles).*

---

## 📁 Project Structure

```text
parkpulse/
├── config/
│   └── db.js                      # MongoDB connection & health
├── models/
│   ├── User.js                    # Commuters, staff, admins & reward points
│   ├── Vehicle.js                 # Registered vehicle fleet
│   ├── ParkingLocation.js         # Multi-floor parking facilities
│   ├── ParkingSlot.js             # Telemetry-enabled bays with state machine
│   ├── Booking.js                 # Guaranteed parking reservations
│   ├── ParkingSession.js          # Barrier check-in/out session tracking
│   ├── Payment.js                 # Mock payment records
│   ├── Notification.js            # Persistent database notifications
│   ├── Favorite.js                # Saved favorite facilities
│   ├── PricingRule.js             # Duration tiers & surge rules
│   └── RewardTransaction.js       # Loyalty points audit ledger
├── controllers/
│   ├── authController.js          # JWT auth & vehicle fleet
│   ├── parkingController.js       # Facilities & capacity metrics
│   ├── slotController.js          # 2D map filters & slot state
│   ├── bookingController.js       # Atomic reservations & extensions
│   ├── sessionController.js       # Check-in, check-out, receipts
│   ├── adminController.js         # Analytics & revenue telemetry
│   ├── sensorController.js        # IoT sensor event handler
│   ├── notificationController.js  # Notifications inbox
│   └── favoriteController.js      # User favorites
├── routes/                        # REST API routing endpoints
├── middleware/
│   ├── auth.js                    # JWT verification
│   ├── roles.js                   # Role-based access control
│   └── errorHandler.js            # Centralized error responses
├── services/
│   ├── pricingService.js          # Dynamic pricing & live quotes
│   ├── recommendationService.js   # Multi-factor AI slot matcher
│   ├── bookingService.js          # Atomic lock & auto-release cron
│   └── notificationService.js     # Push & socket alerts
├── sockets/
│   └── socketManager.js           # Bidirectional WebSocket engine
├── public/
│   ├── index.html                 # Startup landing page
│   ├── parking.html               # 2D interactive floor map
│   ├── booking.html               # 8-Step reservation wizard
│   ├── parking-pass.html          # Digital QR permit & print
│   ├── dashboard.html             # User telemetry & countdown timer
│   ├── gatekeeper.html            # Barrier operator terminal
│   ├── admin.html                 # Operations console & IoT simulator
│   ├── login.html                 # Sign in with 1-click profiles
│   ├── register.html              # Account creation (+50 points)
│   ├── css/
│   │   └── style.css              # Glassmorphism dark-first design system
│   ├── js/
│   │   ├── app.js                 # Main bundle entry
│   │   ├── utils.js               # Toasts, modals, formatters
│   │   ├── socket.js              # Real-time WebSocket client
│   │   ├── auth.js                # Session & nav user state
│   │   ├── parking.js             # 2D floor map & drawer engine
│   │   ├── booking.js             # Booking & mock checkout
│   │   ├── dashboard.js           # Live timers & session tracking
│   │   ├── gatekeeper.js          # Optical verification & check-in/out
│   │   └── admin.js               # Chart.js analytics & simulator
│   └── assets/                    # Facility SVG visual assets
├── test_backend.js                # Automated backend test suite
├── test_realtime_e2e.js           # Multi-browser WebSocket sync test
├── test_auto_release.js           # 15-Minute auto-release test
├── seed.js                        # Database population script
├── server.js                      # Main HTTP & Socket.io server
├── .env.example                   # Environment configuration template
└── README.md                      # Comprehensive documentation
```

---

## 🔮 Future Hardware Architecture Roadmap

While ParkPulse includes a real-time IoT Simulator for software testing, future physical hardware integration can interface directly with our webhook and socket architecture:
```text
[Ultrasonic HC-SR04 / Magnetometer]
             │
             ▼
        [ESP32 / ESP8266]
             │
             ├──► (MQTT / HTTP POST: /api/sensors/event)
             ▼
      [Node.js / Express]
             │
             ▼
       [Socket.io Hub] ──► [ParkPulse Live 2D Maps]
```

---

## 📜 License
ISC License © 2026 ParkPulse Team.

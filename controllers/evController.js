const EVChargingStation = require('../models/EVChargingStation');
const ParkingSlot = require('../models/ParkingSlot');
const { getIO } = require('../sockets/socketManager');

// @desc    Get all EV charging stations
// @route   GET /api/ev/stations
// @access  Public / Authenticated
exports.getChargingStations = async (req, res, next) => {
  try {
    const { locationId, status } = req.query;
    const query = { isActive: true };
    if (locationId) query.locationId = locationId;
    if (status) query.status = status;

    const stations = await EVChargingStation.find(query)
      .populate('slotId', 'slotNumber floor zone status')
      .populate('locationId', 'name address')
      .sort({ stationId: 1 });

    res.status(200).json({
      success: true,
      count: stations.length,
      data: stations
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Start an EV charging session
// @route   POST /api/ev/start
// @access  Private (USER)
exports.startChargingSession = async (req, res, next) => {
  try {
    const { stationId, vehicleNumber } = req.body;

    if (!stationId || !vehicleNumber) {
      return res.status(400).json({
        success: false,
        errorCode: 'VALIDATION_ERROR',
        message: 'stationId and vehicleNumber are required'
      });
    }

    const station = await EVChargingStation.findOne({
      stationId: stationId.toUpperCase(),
      isActive: true
    });

    if (!station) {
      return res.status(404).json({
        success: false,
        errorCode: 'STATION_NOT_FOUND',
        message: `Charging station ${stationId} not found`
      });
    }

    if (station.status !== 'AVAILABLE') {
      return res.status(400).json({
        success: false,
        errorCode: 'STATION_BUSY',
        message: `Station ${stationId} is currently ${station.status}`
      });
    }

    station.status = 'IN_USE';
    station.currentUser = req.user.id;
    station.currentVehicleNumber = vehicleNumber.toUpperCase();
    station.startTime = new Date();
    station.endTime = null;
    station.energyConsumedKWh = 0;
    station.totalChargingCost = 0;
    await station.save();

    // Socket notification
    try {
      const io = getIO();
      if (io) {
        io.emit('ev:status_change', {
          stationId: station.stationId,
          status: 'IN_USE',
          vehicleNumber: station.currentVehicleNumber
        });
      }
    } catch (e) {}

    res.status(200).json({
      success: true,
      message: `EV charging commenced on station ${station.stationId}`,
      data: station
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Stop EV charging session and calculate bill
// @route   POST /api/ev/stop
// @access  Private (USER, GATEKEEPER, ADMIN)
exports.stopChargingSession = async (req, res, next) => {
  try {
    const { stationId } = req.body;

    const station = await EVChargingStation.findOne({
      stationId: stationId.toUpperCase()
    });

    if (!station) {
      return res.status(404).json({
        success: false,
        errorCode: 'STATION_NOT_FOUND',
        message: 'Charging station not found'
      });
    }

    // Ownership or staff check
    if (
      req.user.role === 'USER' &&
      station.currentUser &&
      station.currentUser.toString() !== req.user.id.toString()
    ) {
      return res.status(403).json({
        success: false,
        errorCode: 'FORBIDDEN',
        message: 'You cannot stop another user charging session'
      });
    }

    const now = new Date();
    const durationHours = station.startTime ? (now - station.startTime) / (1000 * 3600) : 0.5;
    // Calculate realistic energy: powerKW * duration (e.g. 22kW * 0.5hr = 11 kWh)
    const energyKWh = Math.max(0.5, parseFloat((station.powerKW * durationHours).toFixed(2)));
    const totalCost = Math.round(energyKWh * station.ratePerKWh);

    station.endTime = now;
    station.energyConsumedKWh = energyKWh;
    station.totalChargingCost = totalCost;
    station.status = 'AVAILABLE';
    station.currentUser = null;
    station.currentVehicleNumber = null;
    await station.save();

    try {
      const io = getIO();
      if (io) {
        io.emit('ev:status_change', {
          stationId: station.stationId,
          status: 'AVAILABLE',
          energyKWh,
          totalCost
        });
      }
    } catch (e) {}

    res.status(200).json({
      success: true,
      message: `EV Charging completed at ${station.stationId}.`,
      data: {
        stationId: station.stationId,
        energyConsumedKWh: energyKWh,
        ratePerKWh: station.ratePerKWh,
        totalChargingCost: totalCost,
        durationMinutes: Math.round(durationHours * 60)
      }
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Admin: Create or update EV charging station
// @route   POST /api/ev/stations
// @access  Private (ADMIN)
exports.createStation = async (req, res, next) => {
  try {
    const { stationId, locationId, slotId, connectorType, powerKW, ratePerKWh } = req.body;

    const existing = await EVChargingStation.findOne({ stationId: stationId.toUpperCase() });
    if (existing) {
      return res.status(400).json({
        success: false,
        errorCode: 'DUPLICATE_STATION',
        message: 'A station with this ID already exists'
      });
    }

    const station = await EVChargingStation.create({
      stationId: stationId.toUpperCase(),
      locationId,
      slotId: slotId || null,
      connectorType: connectorType || 'CCS2',
      powerKW: powerKW || 22,
      ratePerKWh: ratePerKWh || 15
    });

    res.status(201).json({
      success: true,
      message: 'EV Charging station registered successfully',
      data: station
    });
  } catch (err) {
    next(err);
  }
};

const mongoose = require('mongoose');

let isConnected = false;

const connectDB = async () => {
  const mongoURI = process.env.MONGO_URI;

  if (!mongoURI) {
    console.error('[Database] FATAL: MONGO_URI environment variable is not set.');
    process.exit(1);
  }

  try {
    const conn = await mongoose.connect(mongoURI);
    isConnected = true;
    console.log(`[Database] MongoDB Connected: ${conn.connection.host}/${conn.connection.name}`);

    // Handle unexpected disconnections after initial connect
    mongoose.connection.on('disconnected', () => {
      isConnected = false;
      console.warn('[Database] MongoDB disconnected. Mongoose will attempt to reconnect.');
    });

    mongoose.connection.on('reconnected', () => {
      isConnected = true;
      console.log('[Database] MongoDB reconnected successfully.');
    });

    mongoose.connection.on('error', (err) => {
      console.error(`[Database] MongoDB connection error: ${err.message}`);
    });

    return conn;
  } catch (error) {
    console.error(`[Database Error] Connection failed: ${error.message}`);
    process.exit(1);
  }
};

const isDBConnected = () => {
  return isConnected && mongoose.connection.readyState === 1;
};

const closeDB = async () => {
  try {
    await mongoose.connection.close();
    isConnected = false;
    console.log('[Database] MongoDB connection closed.');
  } catch (err) {
    console.error('[Database] Error closing connection:', err.message);
  }
};

module.exports = { connectDB, isDBConnected, closeDB };

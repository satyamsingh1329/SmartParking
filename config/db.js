const mongoose = require('mongoose');

let isConnected = false;

const connectDB = async () => {
  const mongoURI = process.env.MONGO_URI;

  if (!mongoURI) {
    const err = new Error('MONGO_URI environment variable is not configured');
    console.error(`[Database] FATAL: ${err.message}`);
    throw err;
  }

  try {
    const conn = await mongoose.connect(mongoURI, {
      serverSelectionTimeoutMS: 10000
    });
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
    isConnected = false;
    console.error(`[Database Error] Connection failed: ${error.message}`);
    throw error;
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

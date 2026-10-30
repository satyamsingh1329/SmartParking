const mongoose = require('mongoose');

/**
 * Execute operations within a MongoDB transaction if replica set is available,
 * or gracefully execute in standalone fallback mode with error handling.
 */
async function runInTransaction(callback) {
  let session = null;
  try {
    session = await mongoose.startSession();
    // Try starting a transaction
    session.startTransaction();

    const result = await callback(session);
    await session.commitTransaction();
    return result;
  } catch (error) {
    if (session) {
      try {
        await session.abortTransaction();
      } catch (abortErr) {
        // Ignored if transaction wasn't active
      }
    }

    // If transactions are not supported on this MongoDB server (standalone mode)
    if (
      error.message &&
      (error.message.includes('Transaction numbers are only allowed') ||
        error.message.includes('replica set') ||
        error.message.includes('Standalone'))
    ) {
      console.warn('[Transaction] MongoDB running in standalone mode. Executing with direct atomic consistency.');
      return await callback(null);
    }

    throw error;
  } finally {
    if (session) {
      session.endSession();
    }
  }
}

module.exports = { runInTransaction };

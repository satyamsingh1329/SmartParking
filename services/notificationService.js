const Notification = require('../models/Notification');

class NotificationService {
  /**
   * Create and broadcast notification
   * @param {Object} params - { userId, title, message, type, metadata, io }
   */
  async createNotification({ userId, title, message, type = 'booking_confirmed', metadata = {}, io }) {
    try {
      const notification = await Notification.create({
        userId,
        title,
        message,
        type,
        metadata
      });

      if (io) {
        // Emit to user specific room or globally if needed
        io.to(`user:${userId}`).emit('notification:new', notification);
        // Also emit general notification event
        io.emit('notification:broadcast', {
          id: notification._id,
          title,
          message,
          type,
          createdAt: notification.createdAt
        });
      }

      return notification;
    } catch (error) {
      console.error('[NotificationService Error]', error.message);
      return null;
    }
  }
}

module.exports = new NotificationService();

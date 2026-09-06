/**
 * Session Manager for Pairing Telegram Photos and Locations
 * Keeps pending states per user until the corresponding pair arrives.
 */

class SessionManager {
  constructor(timeoutMs = 15 * 60 * 1000) {
    this.sessions = new Map();
    this.timeoutMs = timeoutMs;
  }

  // Set pending photo for user
  setPendingPhoto(userId, photoData) {
    this.clearSession(userId);
    const session = {
      type: 'pending_location', // photo received, waiting for location
      photo: photoData,
      timestamp: Date.now(),
      timer: setTimeout(() => {
        this.sessions.delete(String(userId));
      }, this.timeoutMs)
    };
    this.sessions.set(String(userId), session);
    return session;
  }

  // Set pending location for user (reverse flow: location sent first, waiting for photo)
  setPendingLocation(userId, locationData) {
    this.clearSession(userId);
    const session = {
      type: 'pending_photo', // location received, waiting for photo
      location: locationData,
      timestamp: Date.now(),
      timer: setTimeout(() => {
        this.sessions.delete(String(userId));
      }, this.timeoutMs)
    };
    this.sessions.set(String(userId), session);
    return session;
  }

  // Get current pending session for user
  getSession(userId) {
    return this.sessions.get(String(userId)) || null;
  }

  // Clear session
  clearSession(userId) {
    const key = String(userId);
    if (this.sessions.has(key)) {
      clearTimeout(this.sessions.get(key).timer);
      this.sessions.delete(key);
    }
  }
}

module.exports = new SessionManager();

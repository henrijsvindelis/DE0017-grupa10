const crypto = require('crypto');
const mongoose = require('mongoose');

const { readSessionToken } = require('../services/auth');
const Session = require('../models/Session');

function databaseUnavailable(response) {
  return response.status(503).json({ error: 'The database is not connected. Please try again later.' });
}

async function requireUser(request, response, next) {
  if (mongoose.connection.readyState !== 1) return databaseUnavailable(response);

  const token = readSessionToken(request);
  if (!token) return response.status(401).json({ error: 'Please log in to continue.' });

  try {
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const session = await Session.findOne({ tokenHash, expiresAt: { $gt: new Date() } })
      .populate('user', 'email username role age sex height weight activityLevel goal dailyKcalGoal diet');
    if (!session?.user) return response.status(401).json({ error: 'Your session has expired. Please log in again.' });
    request.user = session.user;
    request.session = session;
    return next();
  } catch (error) {
    console.error(`Session lookup failed: ${error.message}`);
    return response.status(500).json({ error: 'Unable to verify your session. Please try again.' });
  }
}

module.exports = { databaseUnavailable, requireUser };

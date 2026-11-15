const crypto = require('crypto');
const { promisify } = require('util');

const Session = require('../models/Session');

const scrypt = promisify(crypto.scrypt);

const sessionDurationMs = 7 * 24 * 60 * 60 * 1000;

function sessionCookie(token, maxAgeMs = sessionDurationMs) {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  return `session=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${Math.floor(maxAgeMs / 1000)}${secure}`;
}

function readSessionToken(request) {
  const cookie = request.headers.cookie?.split(';').map((part) => part.trim())
    .find((part) => part.startsWith('session='));
  return cookie ? cookie.slice('session='.length) : '';
}

function publicUser(user) {
  return {
    id: user.id,
    email: user.email,
    username: user.username,
    role: user.role,
    age: user.age,
    sex: user.sex,
    height: user.height,
    weight: user.weight,
    activityLevel: user.activityLevel,
    goal: user.goal,
    dailyKcalGoal: user.dailyKcalGoal,
    diet: user.diet || 'standard'
  };
}

async function hashPassword(password) {
  const passwordSalt = crypto.randomBytes(16).toString('hex');
  const passwordHash = (await scrypt(password, passwordSalt, 64)).toString('hex');
  return { passwordSalt, passwordHash };
}

async function createSession(user, response) {
  const token = crypto.randomBytes(32).toString('base64url');
  await Session.create({
    tokenHash: crypto.createHash('sha256').update(token).digest('hex'),
    user: user._id,
    expiresAt: new Date(Date.now() + sessionDurationMs)
  });
  response.setHeader('Set-Cookie', sessionCookie(token));
}

module.exports = { createSession, hashPassword, publicUser, readSessionToken, scrypt, sessionCookie };

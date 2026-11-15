const crypto = require('crypto');
const express = require('express');
const mongoose = require('mongoose');

const { parseProfileFields } = require('../services/profile');
const { createSession, hashPassword, publicUser, scrypt, sessionCookie } = require('../services/auth');
const User = require('../models/User');
const { databaseUnavailable, requireUser } = require('../middleware/requireUser');

const router = express.Router();

router.post('/api/auth/register', async (request, response) => {
  if (mongoose.connection.readyState !== 1) return databaseUnavailable(response);
  const { email, username, password, repeatPassword } = request.body || {};
  const profile = parseProfileFields(request.body || {});
  if (profile.error) return response.status(400).json({ error: profile.error });
  const normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';
  const validEmail = normalizedEmail.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail);
  const validUsername = typeof username === 'string' && username.trim().length >= 2 && username.trim().length <= 30;
  const validPassword = typeof password === 'string' && password.length >= 8 && password.length <= 128;

  if (!validEmail || !validUsername || !validPassword || password !== repeatPassword) {
    return response.status(400).json({ error: 'Enter a valid email and username, and matching passwords of at least 8 characters.' });
  }

  try {
    const user = await User.create({
      email: normalizedEmail,
      username: username.trim(),
      usernameKey: username.trim().toLowerCase(),
      ...profile.values,
      ...(await hashPassword(password)),
      role: 'User'
    });
    await createSession(user, response);
    return response.status(201).json({ user: publicUser(user) });
  } catch (error) {
    if (error.code === 11000) return response.status(409).json({ error: 'That email or username is already in use.' });
    console.error(`Account registration failed: ${error.message}`);
    return response.status(500).json({ error: 'Unable to create your account. Please try again.' });
  }
});

router.post('/api/auth/login', async (request, response) => {
  if (mongoose.connection.readyState !== 1) return databaseUnavailable(response);
  const email = typeof request.body?.email === 'string' ? request.body.email.trim().toLowerCase() : '';
  const password = typeof request.body?.password === 'string' ? request.body.password : '';

  try {
    const user = await User.findOne({ email }).select('+passwordHash +passwordSalt');
    if (!user || !password || password.length > 128) {
      return response.status(401).json({ error: 'Email or password is incorrect.' });
    }
    const passwordHash = await scrypt(password, user.passwordSalt, 64);
    const storedHash = Buffer.from(user.passwordHash, 'hex');
    if (storedHash.length !== passwordHash.length || !crypto.timingSafeEqual(storedHash, passwordHash)) {
      return response.status(401).json({ error: 'Email or password is incorrect.' });
    }
    await createSession(user, response);
    return response.json({ user: publicUser(user) });
  } catch (error) {
    console.error(`Login failed: ${error.message}`);
    return response.status(500).json({ error: 'Unable to log in. Please try again.' });
  }
});

router.get('/api/auth/me', requireUser, (request, response) => {
  return response.json({ user: publicUser(request.user) });
});

router.post('/api/auth/logout', requireUser, async (request, response) => {
  try {
    await request.session.deleteOne();
    response.setHeader('Set-Cookie', sessionCookie('', 0));
    return response.json({ success: true });
  } catch (error) {
    console.error(`Logout failed: ${error.message}`);
    return response.status(500).json({ error: 'Unable to log out. Please try again.' });
  }
});

module.exports = router;

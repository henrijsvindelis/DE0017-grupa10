const express = require('express');

const { parseProfileFields } = require('../services/profile');
const { publicUser } = require('../services/auth');
const { requireUser } = require('../middleware/requireUser');

const router = express.Router();

router.patch('/api/profile', requireUser, async (request, response) => {
  const profile = parseProfileFields(request.body || {});
  if (profile.error) return response.status(400).json({ error: profile.error });

  try {
    request.user.set(profile.values);
    await request.user.save();
    return response.json({ user: publicUser(request.user) });
  } catch (error) {
    if (error.name === 'ValidationError') {
      return response.status(400).json({ error: 'Enter valid profile details.' });
    }
    console.error(`Profile update failed: ${error.message}`);
    return response.status(500).json({ error: 'Unable to save your profile. Please try again.' });
  }
});

module.exports = router;

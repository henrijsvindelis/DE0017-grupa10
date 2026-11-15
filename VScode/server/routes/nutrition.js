const express = require('express');

const { calculateNutritionTarget } = require('../services/nutrition');
const { requireUser } = require('../middleware/requireUser');

const router = express.Router();

router.get('/api/nutrition/target', requireUser, (request, response) => {
  const target = calculateNutritionTarget(request.user);
  if (target.error) return response.status(400).json({ error: target.error });
  return response.json(target);
});

module.exports = router;

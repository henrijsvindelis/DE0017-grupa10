const express = require('express');
const mongoose = require('mongoose');

const { forgetPlanRecipes, recordPlanRecipes } = require('../services/recipes');
const { sanitizePlan } = require('../services/mealPlanValidation');
const MealPlan = require('../models/MealPlan');
const { requireUser } = require('../middleware/requireUser');
const { asyncRoute } = require('../middleware/asyncRoute');

const router = express.Router();

function publicMealPlan(doc) {
  return { id: String(doc._id), createdAt: doc.createdAt, plan: doc.plan };
}

router.get('/api/meal-plans', requireUser, asyncRoute(async (request, response) => {
  const plans = await MealPlan.find({ user: request.user._id }).sort({ createdAt: -1 }).limit(20).lean();
  return response.json({ plans: plans.map(publicMealPlan) });
}));

router.post('/api/meal-plans', requireUser, asyncRoute(async (request, response) => {
  const plan = sanitizePlan(request.body.plan);
  if (!plan.meals.length) return response.status(400).json({ error: 'Ēdienkarte ir tukša.' });
  const saved = await MealPlan.create({ user: request.user._id, plan });
  await recordPlanRecipes(plan, request.user._id).catch((error) => console.error('Receptes saglabāšana neizdevās:', error.message));
  return response.status(201).json({ plan: publicMealPlan(saved) });
}));

router.delete('/api/meal-plans/:id', requireUser, asyncRoute(async (request, response) => {
  if (!mongoose.Types.ObjectId.isValid(request.params.id)) return response.status(404).json({ error: 'Ēdienkarte nav atrasta.' });
  const deleted = await MealPlan.findOneAndDelete({ _id: request.params.id, user: request.user._id }).lean();
  if (deleted) {
    await forgetPlanRecipes(deleted.plan, request.user._id)
      .catch((error) => console.error('Recepšu popularitātes atjaunošana neizdevās:', error.message));
  }
  return response.json({ ok: true });
}));

module.exports = router;

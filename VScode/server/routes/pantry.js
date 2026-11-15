const express = require('express');

const { escapeRegex } = require('../utils');
const { loadPantry } = require('../services/pantry');
const { nutritionFields, parseNutrition } = require('../services/nutrition');
const Pantry = require('../models/Pantry');
const FoodItem = require('../models/FoodItem');
const { requireUser } = require('../middleware/requireUser');
const { asyncRoute } = require('../middleware/asyncRoute');

const router = express.Router();

router.get('/api/pantry', requireUser, asyncRoute(async (request, response) => {
  return response.json({ pantry: await loadPantry(request.user._id) });
}));

router.post('/api/pantry', requireUser, asyncRoute(async (request, response) => {
  const grams = Number(request.body.grams);
  if (!Number.isFinite(grams) || grams < 1 || grams > 100000) {
    return response.status(400).json({ error: 'Daudzumam jābūt no 1 g līdz 100 kg.' });
  }

  let nutrition = null;
  if (request.body.nutrition) {
    const parsed = parseNutrition(request.body.nutrition);
    if (parsed.error) return response.status(400).json({ error: parsed.error });
    nutrition = parsed.values;
  }

  const name = String(request.body.name || '').trim().slice(0, 100);
  let product = null;
  if (request.body.foodItemId) {
    product = await FoodItem.findOne({ id: String(request.body.foodItemId), type: 'food-item' }).lean();
  }
  if (!product && name) {
    product = await FoodItem.findOne({ type: 'food-item', name: { $regex: `^${escapeRegex(name)}$`, $options: 'i' } }).lean();
  }
  if (!product) {
    if (!name) return response.status(400).json({ error: 'Ievadi produkta nosaukumu.' });
    if (!nutrition) return response.status(400).json({ error: 'Jaunam produktam norādi uzturvērtību uz 100 g.' });
    // Jauns nosaukums nonāk kopīgajā datubāzē kā nepārbaudīts produkts
    const created = await FoodItem.create({
      type: 'food-item', name, ...nutrition, verified: false, source: 'user', createdBy: request.user._id
    });
    product = created.toObject();
  }

  const update = nutrition
    ? { $set: { grams: Math.round(grams), ...nutrition } }
    : { $set: { grams: Math.round(grams) }, $unset: Object.fromEntries(nutritionFields.map((f) => [f, 1])) };
  await Pantry.findOneAndUpdate({ user: request.user._id, foodItemId: product.id }, update, { upsert: true });
  return response.status(201).json({ pantry: await loadPantry(request.user._id) });
}));

router.patch('/api/pantry/:foodItemId', requireUser, asyncRoute(async (request, response) => {
  const grams = Number(request.body.grams);
  if (!Number.isFinite(grams) || grams < 1 || grams > 100000) {
    return response.status(400).json({ error: 'Daudzumam jābūt no 1 g līdz 100 kg.' });
  }
  const result = await Pantry.updateOne(
    { user: request.user._id, foodItemId: request.params.foodItemId },
    { $set: { grams: Math.round(grams) } }
  );
  if (!result.matchedCount) return response.status(404).json({ error: 'Produkts nav tavā sarakstā.' });
  return response.json({ pantry: await loadPantry(request.user._id) });
}));

router.delete('/api/pantry/:foodItemId', requireUser, asyncRoute(async (request, response) => {
  await Pantry.deleteOne({ user: request.user._id, foodItemId: request.params.foodItemId });
  return response.json({ pantry: await loadPantry(request.user._id) });
}));

module.exports = router;

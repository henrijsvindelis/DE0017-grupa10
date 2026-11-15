const express = require('express');

const { escapeRegex } = require('../utils');
const FoodItem = require('../models/FoodItem');
const { requireUser } = require('../middleware/requireUser');
const { asyncRoute } = require('../middleware/asyncRoute');

const router = express.Router();

router.get('/api/products', requireUser, asyncRoute(async (request, response) => {
  const query = String(request.query.q || '').trim().slice(0, 50);
  const filter = { type: 'food-item' };
  if (query) filter.name = { $regex: escapeRegex(query), $options: 'i' };
  const products = await FoodItem.find(filter).sort({ name: 1 }).limit(50).lean();
  return response.json({ products: products.map((p) => ({
    id: p.id, name: p.name, kcal_100g: p.kcal_100g, protein_100g: p.protein_100g,
    fat_100g: p.fat_100g, carbohydrates_100g: p.carbohydrates_100g, verified: p.verified !== false
  })) });
}));

module.exports = router;

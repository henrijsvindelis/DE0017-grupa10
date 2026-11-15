const express = require('express');
const mongoose = require('mongoose');

const { escapeRegex } = require('../utils');
const FoodItem = require('../models/FoodItem');
const { requireUser } = require('../middleware/requireUser');

const router = express.Router();

router.get('/api/food-items', async (request, response) => {
  const { type } = request.query;
  if (!['food-item', 'recipe'].includes(type)) {
    return response.status(400).json({ error: 'Choose either recipe or food-item.' });
  }

  if (mongoose.connection.readyState !== 1) {
    return response.status(503).json({ error: 'The database is not connected. Please try again later.' });
  }

  try {
    const limit = Math.min(Math.max(Number.parseInt(request.query.limit, 10) || 3, 1), 50);
    const sort = request.query.sort === 'popular' ? { saves: -1, createdAt: -1 } : { createdAt: -1 };
    const filter = { type };
    const query = String(request.query.q || '').trim().slice(0, 50);
    if (query) filter.name = { $regex: escapeRegex(query), $options: 'i' };
    const vegetarianOnly = request.query.vegetarian === 'true';

    let items;
    let total;
    if (vegetarianOnly && type === 'recipe') {
      // Recepte ir veģetāra, ja tai ir zināmas sastāvdaļas un visas ir produkti ar vegetarian: true
      const [result] = await FoodItem.aggregate([
        { $match: { ...filter, 'ingredientIds.0': { $exists: true } } },
        { $lookup: { from: FoodItem.collection.name, localField: 'ingredientIds', foreignField: 'id', as: 'ingredientProducts' } },
        { $match: { $expr: { $and: [
          { $eq: [{ $size: '$ingredientProducts' }, { $size: '$ingredientIds' }] },
          { $allElementsTrue: [{ $map: { input: '$ingredientProducts', in: { $eq: ['$$this.vegetarian', true] } } }] }
        ] } } },
        { $facet: { items: [{ $sort: sort }, { $limit: limit }], total: [{ $count: 'count' }] } }
      ]);
      items = result.items;
      total = result.total[0]?.count || 0;
    } else {
      // Produkti bez vegetarian lauka ir nezināmi, tāpēc filtrā netiek rādīti
      if (vegetarianOnly) filter.vegetarian = true;
      [items, total] = await Promise.all([
        FoodItem.find(filter).sort(sort).limit(limit).lean(),
        FoodItem.countDocuments(filter)
      ]);
    }
    const results = items.map((item) => {
      const savedItem = {
        id: item.id,
        type: item.type,
        name: item.name
      };

      if (item.type === 'food-item') {
        Object.assign(savedItem, {
          kcal_100g: item.kcal_100g,
          protein_100g: item.protein_100g,
          fat_100g: item.fat_100g,
          carbohydrates_100g: item.carbohydrates_100g,
          verified: item.verified !== false
        });
      } else {
        Object.assign(savedItem, {
          ...(item.description ? { description: item.description } : {}),
          cooking_steps: item.cooking_steps,
          amount_portions: item.amount_portions,
          caloryperportion: item.caloryperportion,
          saves: item.saves || 0,
          source: item.source || 'user'
        });
      }

      return savedItem;
    });

    return response.json({ items: results, total });
  } catch (error) {
    console.error(`Food item lookup failed: ${error.message}`);
    return response.status(500).json({ error: 'Unable to load menu items. Please try again.' });
  }
});

// Pārbauda produkta vai receptes laukus un atgriež saglabājamos datus (vai null, ja nederīgi)
function menuItemData(type, body) {
  const validNumber = (value) => typeof value === 'number' && Number.isFinite(value);
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  if (name.length < 1 || name.length > 100) return null;

  if (type === 'food-item') {
    const valid = ['kcal_100g', 'protein_100g', 'fat_100g', 'carbohydrates_100g']
      .every((field) => validNumber(body[field]) && body[field] >= 0);
    if (!valid) return null;
    return {
      name,
      kcal_100g: body.kcal_100g,
      protein_100g: body.protein_100g,
      fat_100g: body.fat_100g,
      carbohydrates_100g: body.carbohydrates_100g
    };
  }

  if (type === 'recipe') {
    const valid = typeof body.cooking_steps === 'string' &&
      body.cooking_steps.trim().length > 0 &&
      Number.isInteger(body.amount_portions) &&
      body.amount_portions > 0 &&
      validNumber(body.caloryperportion) &&
      body.caloryperportion >= 0 &&
      (body.description === undefined ||
        (typeof body.description === 'string' && body.description.length <= 2000));
    if (!valid) return null;
    return {
      name,
      description: body.description?.trim() || '',
      cooking_steps: body.cooking_steps.trim(),
      amount_portions: body.amount_portions,
      caloryperportion: body.caloryperportion
    };
  }

  return null;
}

const isMenuEditor = (user) => user.role === 'Admin' || user.role === 'Nutritionist';

router.post('/api/food-items', requireUser, async (request, response) => {
  const body = request.body || {};
  const { type } = body;
  if (type === 'food-item' && !isMenuEditor(request.user)) {
    return response.status(403).json({ error: 'Only admins and nutritionists can add food items.' });
  }
  if (type === 'recipe' && request.user.role === 'Admin') {
    return response.status(403).json({ error: 'Admins manage the menu. Recipes are added by users and nutritionists.' });
  }

  const data = menuItemData(type, body);
  if (!data) {
    return response.status(400).json({ error: 'Please provide valid values for all required fields.' });
  }

  try {
    const item = await FoodItem.create({ type, ...data, source: 'user', verified: true, createdBy: request.user._id });
    const savedItem = item.toObject({ versionKey: false });
    delete savedItem._id;
    delete savedItem.savedBy;
    return response.status(201).json({ item: savedItem });
  } catch (error) {
    console.error(`Food item save failed: ${error.message}`);
    return response.status(500).json({ error: 'Unable to save this item. Please try again.' });
  }
});

router.patch('/api/food-items/:id', requireUser, async (request, response) => {
  if (!isMenuEditor(request.user)) {
    return response.status(403).json({ error: 'Only admins and nutritionists can edit menu items.' });
  }
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(request.params.id)) {
    return response.status(400).json({ error: 'Invalid menu item ID.' });
  }

  try {
    const item = await FoodItem.findOne({ id: request.params.id });
    if (!item) return response.status(404).json({ error: 'Menu item not found.' });

    const data = menuItemData(item.type, request.body || {});
    if (!data) {
      return response.status(400).json({ error: 'Please provide valid values for all required fields.' });
    }

    item.set(item.type === 'food-item' ? { ...data, verified: true } : data);
    await item.save();
    const savedItem = item.toObject({ versionKey: false });
    delete savedItem._id;
    delete savedItem.savedBy;
    return response.json({ item: savedItem });
  } catch (error) {
    console.error(`Menu item update failed: ${error.message}`);
    return response.status(500).json({ error: 'Unable to update this menu item. Please try again.' });
  }
});

router.delete('/api/food-items/:id', requireUser, async (request, response) => {
  if (request.user.role !== 'Admin' && request.user.role !== 'Nutritionist') {
    return response.status(403).json({ error: 'Only admins and nutritionists can delete menu items.' });
  }

  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(request.params.id)) {
    return response.status(400).json({ error: 'Invalid menu item ID.' });
  }

  try {
    const item = await FoodItem.findOneAndDelete({ id: request.params.id });
    if (!item) return response.status(404).json({ error: 'Menu item not found.' });
    return response.json({ success: true });
  } catch (error) {
    console.error(`Menu item deletion failed: ${error.message}`);
    return response.status(500).json({ error: 'Unable to delete this menu item. Please try again.' });
  }
});

module.exports = router;

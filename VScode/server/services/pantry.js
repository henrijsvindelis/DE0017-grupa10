const Pantry = require('../models/Pantry');
const FoodItem = require('../models/FoodItem');

async function loadPantry(userId) {
  const entries = await Pantry.find({ user: userId }).lean();
  const items = await FoodItem.find({ id: { $in: entries.map((e) => e.foodItemId) } }).lean();
  const byId = new Map(items.map((item) => [item.id, item]));
  return entries
    .filter((entry) => byId.has(entry.foodItemId))
    .map((entry) => {
      const item = byId.get(entry.foodItemId);
      return {
        foodItemId: entry.foodItemId, name: item.name, grams: entry.grams,
        kcal_100g: entry.kcal_100g ?? item.kcal_100g,
        protein_100g: entry.protein_100g ?? item.protein_100g,
        fat_100g: entry.fat_100g ?? item.fat_100g,
        carbohydrates_100g: entry.carbohydrates_100g ?? item.carbohydrates_100g,
        ownValues: entry.kcal_100g !== undefined && entry.kcal_100g !== null,
        // true / false no produktu datubāzes; lietotāju pievienotajiem produktiem var nebūt zināms
        ...(typeof item.vegetarian === 'boolean' ? { vegetarian: item.vegetarian } : {}),
        ...(item.category ? { category: item.category } : {})
      };
    });
}

module.exports = { loadPantry };

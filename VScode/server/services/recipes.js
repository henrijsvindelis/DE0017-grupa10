const { escapeRegex } = require('../utils');
const MealPlan = require('../models/MealPlan');
const FoodItem = require('../models/FoodItem');

const recipeNameFilter = (name) => ({
  type: 'recipe',
  name: { $regex: `^${escapeRegex(name)}$`, $options: 'i' }
});

// Pievieno vai noņem lietotāju no receptes savedBy un uzreiz pārrēķina saves (atomiski)
function updateRecipeSavers(name, userId, add) {
  const savers = { $ifNull: ['$savedBy', []] };
  return FoodItem.updateOne(recipeNameFilter(name), [
    { $set: { savedBy: add ? { $setUnion: [savers, [userId]] } : { $setDifference: [savers, [userId]] } } },
    { $set: { saves: { $size: '$savedBy' } } }
  ]);
}

// Ēdienreizes sastāvdaļu produktu id bez atkārtojumiem
function mealIngredientIds(meal) {
  return [...new Set((meal?.ingredients || []).map((i) => String(i?.foodItemId || '')).filter(Boolean))];
}

// Vienreiz aizpilda ingredientIds receptēm, kas izveidotas pirms šī lauka, no saglabātajām ēdienkartēm
async function backfillRecipeIngredients() {
  const recipes = await FoodItem.find({ type: 'recipe', source: 'ai', ingredientIds: { $exists: false } }, { id: 1, name: 1 }).lean();
  if (!recipes.length) return;
  const idsByName = new Map();
  for (const doc of await MealPlan.find({}, { plan: 1 }).lean()) {
    for (const meal of doc.plan?.meals || []) {
      const key = String(meal.name || '').trim().toLowerCase();
      const ids = mealIngredientIds(meal);
      if (key && ids.length && !idsByName.has(key)) idsByName.set(key, ids);
    }
  }
  let updated = 0;
  for (const recipe of recipes) {
    const ids = idsByName.get(recipe.name.trim().toLowerCase());
    if (!ids) continue;
    await FoodItem.updateOne({ id: recipe.id }, { $set: { ingredientIds: ids } });
    updated += 1;
  }
  if (updated) console.log(`Receptēm aizpildītas sastāvdaļas: ${updated}`);
}

// Saglabātās ēdienkartes ēdienreizes kļūst par receptēm; popularitāte = unikālo lietotāju skaits
async function recordPlanRecipes(plan, userId) {
  for (const meal of plan?.meals || []) {
    const name = String(meal.name || '').trim().slice(0, 100);
    const steps = (meal.steps || []).filter(Boolean);
    if (!name || !steps.length) continue;
    const ingredientIds = mealIngredientIds(meal);

    if (await FoodItem.exists(recipeNameFilter(name))) {
      if (userId) await updateRecipeSavers(name, userId, true);
      if (ingredientIds.length) {
        await FoodItem.updateOne({ ...recipeNameFilter(name), ingredientIds: { $exists: false } }, { $set: { ingredientIds } });
      }
      continue;
    }

    await FoodItem.create({
      type: 'recipe',
      name,
      ...(ingredientIds.length ? { ingredientIds } : {}),
      description: (meal.ingredients || []).map((i) => `${i.name} ${i.grams} g`).join(', ').slice(0, 2000),
      cooking_steps: steps.map((step, index) => `${index + 1}. ${step}`).join('\n'),
      amount_portions: 1,
      caloryperportion: Math.round(Number(meal.kcal) || 0),
      source: 'ai',
      savedBy: userId ? [userId] : [],
      saves: userId ? 1 : 0
    });
  }
}

// Pēc ēdienkartes dzēšanas noņem lietotāju no receptēm, kuras viņam nav nevienā citā saglabātā ēdienkartē
async function forgetPlanRecipes(plan, userId) {
  const names = new Set((plan?.meals || []).map((meal) => String(meal.name || '').trim().slice(0, 100)).filter(Boolean));
  for (const name of names) {
    const stillSaved = await MealPlan.exists({
      user: userId,
      'plan.meals.name': { $regex: `^\\s*${escapeRegex(name)}\\s*$`, $options: 'i' }
    });
    if (!stillSaved) await updateRecipeSavers(name, userId, false);
  }
}

// Vienreiz izveido receptes no jau saglabātajām ēdienkartēm un pārrēķina popularitāti pēc unikāliem lietotājiem
async function importSavedPlanRecipes() {
  const needsImport = !(await FoodItem.exists({ source: 'ai' }));
  const needsRecount = await FoodItem.exists({ type: 'recipe', savedBy: { $exists: false } });
  if (!needsImport && !needsRecount) return;

  await FoodItem.updateMany({ type: 'recipe' }, { $set: { savedBy: [], saves: 0 } });
  const plans = await MealPlan.find({}).sort({ createdAt: 1 }).lean();
  for (const doc of plans) await recordPlanRecipes(doc.plan, doc.user);
  console.log(`Recepšu popularitāte pārrēķināta no ${plans.length} saglabātām ēdienkartēm`);
}

module.exports = { backfillRecipeIngredients, forgetPlanRecipes, importSavedPlanRecipes, recordPlanRecipes };

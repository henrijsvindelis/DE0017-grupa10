const fs = require('fs');

const { seedProductsFile } = require('../config');
const { round } = require('../utils');
const FoodItem = require('../models/FoodItem');

const activityFactors = {
  'sedentary': 1.2,
  'lightly-active': 1.375,
  'moderately-active': 1.55,
  'very-active': 1.725,
  'extra-active': 1.9
};

const goalKcalDelta = { lose: -500, maintain: 0, gain: 300 };

const goalProteinPerKg = { lose: 1.8, maintain: 1.4, gain: 1.8 };

const mealShares = { breakfast: 0.25, lunch: 0.35, dinner: 0.3, snack: 0.1 };

function calculateNutritionTarget(user) {
  const required = ['age', 'sex', 'height', 'weight', 'activityLevel', 'goal'];
  const missing = required.filter((field) => user[field] === undefined || user[field] === null);
  if (missing.length) return { error: 'Aizpildi profilu: ' + missing.join(', ') };

  
  const bmr = 10 * user.weight + 6.25 * user.height - 5 * user.age + (user.sex === 'male' ? 5 : -161);
  const minimum = user.sex === 'male' ? 1500 : 1200;
  const calculated = Math.round(bmr * activityFactors[user.activityLevel] + goalKcalDelta[user.goal]);
  const dailyKcal = user.dailyKcalGoal || Math.max(calculated, minimum);

  const meals = Object.fromEntries(
    Object.entries(mealShares).map(([meal, share]) => [meal, Math.round(dailyKcal * share)])
  );

  return {
    dailyKcal,
    proteinGrams: Math.round(user.weight * goalProteinPerKg[user.goal]),
    goal: user.goal,
    meals,
    source: user.dailyKcalGoal ? 'user' : 'calculated'
  };
}

const nutritionFields = ['kcal_100g', 'protein_100g', 'fat_100g', 'carbohydrates_100g'];

// Pārbauda uzturvērtību no iepakojuma: vai skaitļi ir iespējami un vai kalorijas sakrīt ar makroelementiem
function parseNutrition(input) {
  const values = {};
  for (const field of nutritionFields) {
    const value = Number(input?.[field]);
    if (!Number.isFinite(value) || value < 0) return { error: 'Uzturvērtībai jābūt skaitļiem, kas nav mazāki par 0.' };
    values[field] = Math.round(value * 10) / 10;
  }
  if (values.kcal_100g > 900) return { error: 'Kalorijas uz 100 g nevar būt vairāk par 900.' };
  if (values.protein_100g + values.fat_100g + values.carbohydrates_100g > 101) {
    return { error: 'Olbaltumvielas, tauki un ogļhidrāti kopā nevar pārsniegt 100 g uz 100 g.' };
  }
  const calculated = 4 * values.protein_100g + 4 * values.carbohydrates_100g + 9 * values.fat_100g;
  if (Math.abs(values.kcal_100g - calculated) > Math.max(40, values.kcal_100g * 0.35)) {
    return { error: `Kalorijas (${values.kcal_100g}) nesakrīt ar olbaltumvielām, taukiem un ogļhidrātiem (~${Math.round(calculated)} kcal). Pārbaudi vērtības uz iepakojuma.` };
  }
  return { values };
}

// Dienas normas vitamīniem un minerālvielām (mg) no seed/products.json; nolasa vienreiz
let dailyNormsCache;

function dailyNorms() {
  if (dailyNormsCache !== undefined) return dailyNormsCache;
  try {
    const seed = JSON.parse(fs.readFileSync(seedProductsFile, 'utf8'));
    dailyNormsCache = seed.dailyNorms || null;
  } catch (error) {
    console.warn(`Dienas normas nav nolasāmas: ${error.message}`);
    dailyNormsCache = null;
  }
  return dailyNormsCache;
}

// Summē vitamīnus vai minerālvielas no produktiem, kuriem dati ir zināmi, un izsaka % no dienas normas
function nutrientShares(ingredients, productsById, field, norms) {
  let partial = false;
  const totals = {};
  for (const ingredient of ingredients) {
    const values = productsById.get(ingredient.foodItemId)?.[field];
    if (!values) {
      partial = true;
      continue;
    }
    for (const key of Object.keys(norms)) {
      const value = Number(values[key]);
      if (!Number.isFinite(value)) {
        partial = true;
        continue;
      }
      totals[key] = (totals[key] || 0) + value * ingredient.grams / 100;
    }
  }
  const items = Object.entries(norms)
    .filter(([key, norm]) => totals[key] !== undefined && norm > 0)
    .map(([key, norm]) => ({ key, mg: round(totals[key], 2), normMg: norm, percent: Math.round(totals[key] / norm * 100) }));
  return { items, partial };
}

// Ēdienkartes analīze no datubāzes vērtībām: makroelementi, vitamīni, minerālvielas un aptuvenās izmaksas
async function analyzePlan(meals) {
  const ingredients = meals.flatMap((meal) => meal.ingredients || []);
  const products = await FoodItem.find(
    { id: { $in: [...new Set(ingredients.map((i) => i.foodItemId))] } },
    { id: 1, vitamins: 1, minerals: 1, price_eur_per_kg: 1 }
  ).lean();
  const productsById = new Map(products.map((p) => [p.id, p]));

  const grams = (field) => round(ingredients.reduce((sum, i) => sum + (Number(i[field]) || 0), 0), 1);
  const protein = grams('protein');
  const fat = grams('fat');
  const carbohydrates = grams('carbohydrates');
  const macroKcal = protein * 4 + fat * 9 + carbohydrates * 4;
  const share = (kcal) => (macroKcal > 0 ? Math.round(kcal / macroKcal * 100) : 0);

  const norms = dailyNorms();
  const vitamins = norms?.vitamins_mg ? nutrientShares(ingredients, productsById, 'vitamins', norms.vitamins_mg) : { items: [], partial: true };
  const minerals = norms?.minerals_mg ? nutrientShares(ingredients, productsById, 'minerals', norms.minerals_mg) : { items: [], partial: true };

  let cost = 0;
  let costPartial = false;
  let costKnown = false;
  for (const ingredient of ingredients) {
    const price = Number(productsById.get(ingredient.foodItemId)?.price_eur_per_kg);
    if (!Number.isFinite(price)) {
      costPartial = true;
      continue;
    }
    cost += price * ingredient.grams / 1000;
    costKnown = true;
  }

  return {
    macros: {
      protein: { grams: protein, percent: share(protein * 4) },
      fat: { grams: fat, percent: share(fat * 9) },
      carbohydrates: { grams: carbohydrates, percent: share(carbohydrates * 4) }
    },
    vitamins: vitamins.items,
    vitaminsPartial: vitamins.partial,
    minerals: minerals.items,
    mineralsPartial: minerals.partial,
    costEur: costKnown ? round(cost, 2) : null,
    costPartial
  };
}

// Saglabājot pieņem tikai zināmos analīzes laukus kā skaitļus
function sanitizeAnalysis(analysis) {
  if (!analysis || typeof analysis !== 'object') return undefined;
  const number = (value) => (Number.isFinite(Number(value)) ? Number(value) : 0);
  const macro = (value) => ({ grams: number(value?.grams), percent: number(value?.percent) });
  const nutrients = (list) => (Array.isArray(list) ? list : []).slice(0, 10).map((item) => ({
    key: String(item?.key || '').slice(0, 10), mg: number(item?.mg), normMg: number(item?.normMg), percent: number(item?.percent)
  }));
  return {
    macros: {
      protein: macro(analysis.macros?.protein),
      fat: macro(analysis.macros?.fat),
      carbohydrates: macro(analysis.macros?.carbohydrates)
    },
    vitamins: nutrients(analysis.vitamins),
    vitaminsPartial: Boolean(analysis.vitaminsPartial),
    minerals: nutrients(analysis.minerals),
    mineralsPartial: Boolean(analysis.mineralsPartial),
    costEur: analysis.costEur === null || analysis.costEur === undefined ? null : number(analysis.costEur),
    costPartial: Boolean(analysis.costPartial)
  };
}

// Pievieno analīzi; ja tā neizdodas, ēdienkarte tiek atgriezta bez tās
async function withAnalysis(plan) {
  try {
    return { ...plan, analysis: await analyzePlan(plan.meals) };
  } catch (error) {
    console.error(`Ēdienkartes analīze neizdevās: ${error.message}`);
    return plan;
  }
}

module.exports = { calculateNutritionTarget, nutritionFields, parseNutrition, sanitizeAnalysis, withAnalysis };

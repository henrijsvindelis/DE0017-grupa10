const { normalizeText, round } = require('../utils');
const { sanitizeAnalysis } = require('./nutrition');

const mealTypes = ['breakfast', 'lunch', 'dinner', 'snack'];

function wordStem(word) {
  if (word.length >= 6) return word.slice(0, -2);
  if (word.length === 5) return word.slice(0, -1);
  return word;
}

// Vai produkts minēts tekstā: jāatrod visu nosaukuma vārdu saknes (citādi "Vistas ola" sakristu ar "Vistas fileja")
function mentionsProduct(text, name) {
  const words = normalizeText(name).replace(/\(.*?\)/g, ' ').split(/[^\p{L}]+/u).filter((word) => word.length >= 3);
  return words.length > 0 && words.every((word) => text.includes(wordStem(word)));
}

const mealTypeAliases = {
  breakfast: 'breakfast', brokastis: 'breakfast',
  lunch: 'lunch', pusdienas: 'lunch',
  dinner: 'dinner', vakariņas: 'dinner', vakarinas: 'dinner',
  snack: 'snack', uzkoda: 'snack', launags: 'snack'
};

function normalizeMealType(type) {
  return mealTypeAliases[normalizeText(type)] || '';
}

function validateMealPlan(raw, pantry, target, { vegetarian = false } = {}) {
  const byId = new Map(pantry.map((p) => [p.foodItemId, p]));
  const byName = new Map(pantry.map((p) => [normalizeText(p.name), p]));
  const used = new Map();
  const meals = [];
  const warnings = [];

  for (const meal of Array.isArray(raw?.meals) ? raw.meals : []) {
    const type = normalizeMealType(meal?.type);
    if (!type) {
      console.warn('Izlaista ēdienreize ar nezināmu tipu:', meal?.type);
      continue;
    }
    const ingredients = [];
    for (const item of Array.isArray(meal.ingredients) ? meal.ingredients : []) {
      const product = byId.get(String(item?.id)) || byName.get(normalizeText(item?.name));
      const grams = Math.round(Number(item?.grams));
      if (!product) return { ok: false, error: 'MI izmantoja produktu, kura nav sarakstā.' };
      if (vegetarian && product.vegetarian === false) {
        return { ok: false, error: `MI izmantoja produktu "${product.name}", kas nav veģetārs.` };
      }
      if (!Number.isFinite(grams) || grams <= 0) continue;
      used.set(product.foodItemId, (used.get(product.foodItemId) || 0) + grams);
      ingredients.push({
        foodItemId: product.foodItemId, name: product.name, grams,
        kcal: round(product.kcal_100g * grams / 100),
        protein: round(product.protein_100g * grams / 100, 1),
        fat: round(product.fat_100g * grams / 100, 1),
        carbohydrates: round(product.carbohydrates_100g * grams / 100, 1)
      });
    }
    if (!ingredients.length) {
      console.warn('Izlaista ēdienreize bez sastāvdaļām:', meal?.name);
      continue;
    }
    const steps = Array.isArray(meal.steps) ? meal.steps.map(String) : String(meal.steps || '').split('\n');
    const name = String(meal.name || 'Ēdiens').slice(0, 100);

    const mealText = normalizeText([name, ...steps].join(' '));
    const listed = new Set(ingredients.map((i) => i.foodItemId));
    const missing = pantry.find((p) => !listed.has(p.foodItemId) && mentionsProduct(mealText, p.name));
    if (missing) warnings.push(`"${missing.name}" minēts receptē "${name}", bet nav sastāvdaļās.`);

    meals.push({
      type,
      name,
      steps: steps.map((s) => s.trim()).filter(Boolean).slice(0, 15),
      ingredients,
      kcal: ingredients.reduce((sum, i) => sum + i.kcal, 0),
      protein: round(ingredients.reduce((sum, i) => sum + i.protein, 0), 1),
      targetKcal: target.meals[type]
    });
  }

  for (const [id, grams] of used) {
    if (grams > byId.get(id).grams) {
      return { ok: false, error: `MI izmantoja vairāk produkta "${byId.get(id).name}" nekā ir pieejams.` };
    }
  }
  if (!meals.length) return { ok: false, error: 'MI neizveidoja nevienu derīgu ēdienreizi.' };

  const totalKcal = meals.reduce((sum, m) => sum + m.kcal, 0);
  const coveredTypes = new Set(meals.map((m) => m.type));
  const isFullPlan = mealTypes.every((type) => coveredTypes.has(type));
  return {
    ok: true,
    warnings,
    plan: {
      mode: isFullPlan && raw.mode !== 'recipes' ? 'plan' : 'recipes',
      meals,
      totalKcal,
      totalProtein: round(meals.reduce((sum, m) => sum + m.protein, 0), 1),
      target,
      note: String(raw.note || '').slice(0, 300)
    }
  };
}

function sanitizePlan(plan) {
  const meals = (Array.isArray(plan?.meals) ? plan.meals : []).slice(0, 10).map((meal) => ({
    type: mealTypes.includes(meal?.type) ? meal.type : 'snack',
    name: String(meal?.name || '').slice(0, 100),
    steps: (Array.isArray(meal?.steps) ? meal.steps : []).slice(0, 15).map((s) => String(s).slice(0, 500)),
    ingredients: (Array.isArray(meal?.ingredients) ? meal.ingredients : []).slice(0, 20).map((i) => ({
      foodItemId: String(i?.foodItemId || ''), name: String(i?.name || '').slice(0, 100),
      grams: Number(i?.grams) || 0, kcal: Number(i?.kcal) || 0
    })),
    kcal: Number(meal?.kcal) || 0,
    protein: Number(meal?.protein) || 0,
    targetKcal: Number(meal?.targetKcal) || 0
  }));
  return {
    mode: plan?.mode === 'plan' ? 'plan' : 'recipes',
    meals,
    totalKcal: Number(plan?.totalKcal) || 0,
    totalProtein: Number(plan?.totalProtein) || 0,
    target: { dailyKcal: Number(plan?.target?.dailyKcal) || 0 },
    note: String(plan?.note || '').slice(0, 300),
    ...(plan?.incomplete === true ? { incomplete: true } : {}),
    ...(plan?.analysis ? { analysis: sanitizeAnalysis(plan.analysis) } : {})
  };
}

module.exports = { sanitizePlan, validateMealPlan };

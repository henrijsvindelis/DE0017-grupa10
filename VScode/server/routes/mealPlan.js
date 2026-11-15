const express = require('express');

const { loadPantry } = require('../services/pantry');
const { calculateNutritionTarget, withAnalysis } = require('../services/nutrition');
const { validateMealPlan } = require('../services/mealPlanValidation');
const { askGemini, buildMealPlanPrompt } = require('../services/ai');
const { requireUser } = require('../middleware/requireUser');
const { asyncRoute } = require('../middleware/asyncRoute');

const router = express.Router();

const lastGenerationByUser = new Map();

router.post('/api/meal-plan/generate', requireUser, asyncRoute(async (request, response) => {
  const userKey = String(request.user._id);
  const now = Date.now();
  if (now - (lastGenerationByUser.get(userKey) || 0) < 10000) {
    return response.status(429).json({ error: 'Pagaidi 10 sekundes pirms nākamās ģenerēšanas.' });
  }
  lastGenerationByUser.set(userKey, now);

  const target = calculateNutritionTarget(request.user);
  if (target.error) return response.status(400).json({ error: target.error });

  const pantry = await loadPantry(request.user._id);
  if (!pantry.length) {
    return response.status(400).json({ error: 'Vispirms pievieno produktus sarakstam "Mani produkti".' });
  }

  // Veģetārai diētai MI nesaņem produktus, kas noteikti nav veģetāri (vegetarian: false)
  const vegetarian = request.user.diet === 'vegetarian';
  const usablePantry = vegetarian ? pantry.filter((p) => p.vegetarian !== false) : pantry;
  if (!usablePantry.length) {
    return response.status(400).json({ error: 'Sarakstā nav neviena veģetāra produkta. Pievieno produktus vai maini diētu profilā.' });
  }

  const availableKcal = usablePantry.reduce((sum, p) => sum + p.kcal_100g * p.grams / 100, 0);
  const enoughForFullDay = availableKcal >= target.dailyKcal * 0.9;

  const prompt = buildMealPlanPrompt(target, usablePantry, vegetarian);
  let lastError = 'Neizdevās izveidot ēdienkarti.';
  let bestPlan = null;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const attemptPrompt = attempt === 1 ? prompt
        : `${prompt}\n\nTava iepriekšējā atbilde bija nederīga: ${lastError} Izlabo to.`;
      const raw = await askGemini(attemptPrompt);
      console.log(`MI atbilde (${attempt}. mēģinājums): ${(raw?.meals || []).length} ēdienreizes`, (raw?.meals || []).map((m) => m?.type));
      const checked = validateMealPlan(raw, pantry, target, { vegetarian });
      if (!checked.ok) {
        lastError = checked.error;
        continue;
      }
      const problems = [...checked.warnings];
      if (checked.plan.mode !== 'plan' && enoughForFullDay) {
        problems.push(`Produktu pietiek visai dienai (${Math.round(availableKcal)} kcal), tāpēc aizpildi visas 4 ēdienreizes.`);
      }
      if (!problems.length) return response.json(await withAnalysis(checked.plan));
      if (!bestPlan || problems.length <= bestPlan.problems.length) bestPlan = { ...checked.plan, problems };
      lastError = problems.join(' ');
    } catch (error) {
      if (error.retryable && attempt < 3) {
        await new Promise((resolve) => setTimeout(resolve, 3000));
        continue;
      }
      if (error.status) {
        // Ja kāds iepriekšējais mēģinājums jau deva ēdienkarti, atgriež to, nevis kļūdu
        if (bestPlan) break;
        return response.status(error.status).json({ error: error.message });
      }
      lastError = 'MI atbilde nebija derīga.';
    }
  }
  if (bestPlan) {
    const { problems, ...plan } = bestPlan;
    // Problēmas ir instrukcijas MI, nevis lietotājam, tāpēc tās tikai ieraksta logā
    console.warn(`Atgriezta ēdienkarte ar problēmām: ${problems.join(' ')}`);
    // Produktu pietiek visai dienai, bet MI neaizpildīja visas ēdienreizes
    const incomplete = enoughForFullDay && plan.mode !== 'plan';
    return response.json(await withAnalysis({ ...plan, ...(incomplete ? { incomplete: true } : {}) }));
  }
  return response.status(422).json({ error: lastError + ' Mēģini vēlreiz.' });
}));

module.exports = router;

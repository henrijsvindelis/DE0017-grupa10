import { useEffect, useState } from 'react';
import { AddProductDialog } from '../components/AddProductDialog';
import { MealPlanCard } from '../components/MealPlanCard';
import { PantryRow } from '../components/PantryRow';
import { PlanAnalysis } from '../components/PlanAnalysis';
import { requestJson } from '../lib/api';
import { goalLabels } from '../lib/labels';

export function MealPlannerPage({ user }) {
  const [target, setTarget] = useState(null);
  const [targetError, setTargetError] = useState('');
  const [pantry, setPantry] = useState([]);
  const [productDialogOpen, setProductDialogOpen] = useState(false);
  const [status, setStatus] = useState({ message: '', error: false });
  const [plan, setPlan] = useState(null);
  const [generating, setGenerating] = useState(false);
  const [savedPlans, setSavedPlans] = useState([]);
  const [saving, setSaving] = useState(false);
  const [planSaved, setPlanSaved] = useState(false);

  useEffect(() => {
    if (!user) return;
    requestJson('/api/nutrition/target').then(setTarget).catch((error) => setTargetError(error.message));
    requestJson('/api/pantry').then((result) => setPantry(result.pantry)).catch(() => {});
    requestJson('/api/meal-plans').then((result) => setSavedPlans(result.plans.filter((saved) => saved.plan?.meals))).catch(() => {});
  }, [user]);

  async function updatePantryAmount(foodItemId, grams) {
    setStatus({ message: '', error: false });
    try {
      const result = await requestJson(`/api/pantry/${encodeURIComponent(foodItemId)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ grams })
      });
      setPantry(result.pantry);
    } catch (error) {
      setStatus({ message: error.message, error: true });
    }
  }

  async function removeFromPantry(foodItemId) {
    try {
      const result = await requestJson(`/api/pantry/${encodeURIComponent(foodItemId)}`, { method: 'DELETE' });
      setPantry(result.pantry);
    } catch (error) {
      setStatus({ message: error.message, error: true });
    }
  }

  async function generatePlan() {
    setGenerating(true);
    setStatus({ message: '', error: false });
    try {
      setPlan(await requestJson('/api/meal-plan/generate', { method: 'POST' }));
      setPlanSaved(false);
    } catch (error) {
      setStatus({ message: error.message, error: true });
    } finally {
      setGenerating(false);
    }
  }

  async function savePlan() {
    setSaving(true);
    setStatus({ message: '', error: false });
    try {
      const result = await requestJson('/api/meal-plans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan })
      });
      setSavedPlans((current) => [result.plan, ...current]);
      setPlanSaved(true);
      setStatus({ message: 'Meal plan saved.', error: false });
    } catch (error) {
      setStatus({ message: error.message, error: true });
    } finally {
      setSaving(false);
    }
  }

  async function deleteSavedPlan(id) {
    if (!window.confirm('Delete this saved meal plan?')) return;
    try {
      await requestJson(`/api/meal-plans/${encodeURIComponent(id)}`, { method: 'DELETE' });
      setSavedPlans((current) => current.filter((saved) => saved.id !== id));
    } catch (error) {
      setStatus({ message: error.message, error: true });
    }
  }

  function openSavedPlan(saved) {
    setPlan(saved.plan);
    setPlanSaved(true);
    window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
  }

  if (!user) {
    return (
      <main className="mx-auto max-w-2xl px-5 py-16 text-sm text-ink/60">
        <a className="font-bold text-terracotta" href="/login">Log in</a> to plan your meals.
      </main>
    );
  }

  const inputClass = 'mt-2 w-full rounded-xl border border-forest/15 bg-cream/60 px-4 py-3 text-sm text-ink outline-none transition focus:border-forest focus:ring-4 focus:ring-forest/10';

  return (
    <main className="mx-auto grid max-w-5xl gap-8 px-5 py-14">
      <div>
        <p className="mb-2 text-xs font-bold uppercase tracking-[0.18em] text-terracotta">Meal planner</p>
        <h1 className="font-display text-4xl text-forest sm:text-5xl">Plan your day from what you have.</h1>
      </div>
      <AddProductDialog open={productDialogOpen} onClose={() => setProductDialogOpen(false)} onSaved={(nextPantry) => nextPantry && setPantry(nextPantry)} />

      <section className="rounded-3xl border border-forest/10 bg-white p-7 shadow-sm">
        <h2 className="mb-4 font-display text-2xl text-forest">Your daily target</h2>
        {targetError ? (
          <p className="mb-0 text-sm text-terracotta-dark">{targetError} <a className="font-bold text-terracotta" href="/profile">Complete your profile</a>.</p>
        ) : target ? (
          <dl className="mb-0 grid gap-5 sm:grid-cols-3">
            <div><dt className="text-xs font-bold uppercase tracking-wider text-ink/45">Calories</dt><dd className="mb-0 mt-1 text-2xl font-semibold text-forest">{target.dailyKcal} kcal</dd></div>
            <div><dt className="text-xs font-bold uppercase tracking-wider text-ink/45">Protein</dt><dd className="mb-0 mt-1 text-2xl font-semibold text-forest">{target.proteinGrams} g</dd></div>
            <div><dt className="text-xs font-bold uppercase tracking-wider text-ink/45">Goal</dt><dd className="mb-0 mt-1 text-2xl font-semibold text-forest">{goalLabels[target.goal]}</dd></div>
          </dl>
        ) : <p className="mb-0 text-sm text-ink/60">Loading…</p>}
      </section>

      <section className="rounded-3xl border border-forest/10 bg-white p-7 shadow-sm">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="mb-0 font-display text-2xl text-forest">My products</h2>
          <button type="button" onClick={() => setProductDialogOpen(true)} className="rounded-xl bg-forest px-5 py-3 text-sm font-bold text-white transition hover:bg-forest-light">Add product +</button>
        </div>
        {pantry.length ? (
          <ul className="mb-0 grid gap-2">
            {pantry.map((entry) => (
              <PantryRow key={`${entry.foodItemId}-${entry.grams}`} entry={entry} onUpdate={updatePantryAmount} onRemove={removeFromPantry}
                excluded={user.diet === 'vegetarian' && entry.vegetarian === false} />
            ))}
          </ul>
        ) : <p className="mb-0 text-sm text-ink/60">Add the products you have at home, with the nutrition values from the package.</p>}
      </section>

      {savedPlans.length > 0 && (
        <section className="rounded-3xl border border-forest/10 bg-white p-7 shadow-sm">
          <h2 className="mb-4 font-display text-2xl text-forest">Saved meal plans</h2>
          <ul className="mb-0 grid gap-2">
            {savedPlans.map((saved) => (
              <li key={saved.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-cream/60 px-4 py-3 text-sm">
                <span className="font-semibold text-forest">
                  {new Date(saved.createdAt).toLocaleString('lv-LV', { dateStyle: 'medium', timeStyle: 'short' })}
                  <span className="ml-2 font-normal text-ink/60">{saved.plan?.totalKcal ?? 0} kcal · {saved.plan?.meals?.length ?? 0} meals</span>
                </span>
                <span className="flex items-center gap-4">
                  <button type="button" onClick={() => openSavedPlan(saved)} className="font-bold text-forest hover:text-terracotta">View</button>
                  <button type="button" onClick={() => deleteSavedPlan(saved.id)} className="font-bold text-terracotta hover:text-terracotta-dark" aria-label="Delete saved plan">×</button>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="grid gap-3">
        <button type="button" onClick={generatePlan} disabled={generating || !pantry.length || !target}
          className="justify-self-start rounded-xl bg-terracotta px-6 py-4 text-sm font-bold text-white transition hover:bg-terracotta-dark disabled:opacity-60">
          {generating ? 'Generating… (up to 1 min)' : 'Generate meal plan'}
        </button>
        <p className={`mb-0 min-h-5 text-sm ${status.error ? 'text-red-700' : 'text-forest/70'}`} role="status" aria-live="polite">{status.message}</p>
      </div>

      {plan && (
        <section className="grid gap-5">
          <div className="flex flex-wrap items-end justify-between gap-3 border-b border-forest/15 pb-4">
            <h2 className="mb-0 font-display text-3xl text-forest">
              {plan.mode === 'plan' ? 'Your meal plan for the day' : plan.incomplete ? 'Part of your meal plan' : 'Recipes you can make'}
            </h2>
            <div className="flex items-center gap-4">
              <p className="mb-0 text-sm font-semibold text-ink/60">{plan.totalKcal} / {plan.target?.dailyKcal} kcal · {plan.totalProtein} g protein</p>
              <button type="button" onClick={() => setPlan(null)} className="rounded-xl border border-forest/15 px-4 py-2 text-sm font-bold text-forest transition hover:bg-cream">
                Close
              </button>
            </div>
          </div>
          {plan.incomplete ? (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-terracotta/20 bg-terracotta/5 px-5 py-4 text-sm text-terracotta-dark">
              <span>You have enough products for a full day, but the AI could not fill every meal this time.</span>
              {!planSaved && (
                <button type="button" onClick={generatePlan} disabled={generating}
                  className="rounded-lg bg-terracotta px-4 py-2 text-xs font-bold text-white transition hover:bg-terracotta-dark disabled:opacity-60">
                  {generating ? 'Generating…' : 'Try again'}
                </button>
              )}
            </div>
          ) : plan.mode !== 'plan' && <p className="mb-0 text-sm text-ink/60">Your products are not enough for a full day, so here are recipes you can make now.</p>}
          <div className="grid gap-5 md:grid-cols-2">
            {(plan.meals || []).map((meal, index) => <MealPlanCard key={`${meal.type}-${index}`} meal={meal} />)}
          </div>
          {plan.note && <p className="mb-0 text-sm italic text-ink/60">{plan.note}</p>}
          {plan.analysis && <PlanAnalysis analysis={plan.analysis} />}
          <button type="button" onClick={savePlan} disabled={saving || planSaved}
            className="justify-self-start rounded-xl bg-forest px-5 py-3 text-sm font-bold text-white transition hover:bg-forest-light disabled:opacity-60">
            {planSaved ? 'Saved' : saving ? 'Saving…' : 'Save this plan'}
          </button>
          <p className="mb-0 text-xs text-ink/45">Generated by AI. Nutrition values are calculated from our database and are for guidance only, not medical advice.</p>
        </section>
      )}
    </main>
  );
}

import { mealLabels } from '../lib/labels';

export function MealPlanCard({ meal }) {
  return (
    <article className="rounded-2xl border border-forest/10 bg-white p-6 shadow-sm">
      <div className="mb-4 flex items-center justify-between gap-3">
        <span className="rounded-full bg-sage/60 px-3 py-1 text-xs font-bold uppercase tracking-wider text-forest">{mealLabels[meal.type]}</span>
        <span className="text-sm font-semibold text-ink/60">{meal.kcal} / {meal.targetKcal} kcal</span>
      </div>
      <h3 className="mb-1 font-display text-2xl text-forest">{meal.name}</h3>
      <p className="mb-4 text-sm text-ink/60">{meal.protein} g protein</p>
      <ul className="mb-4 grid gap-1 text-sm">
        {meal.ingredients.map((ingredient) => (
          <li key={ingredient.foodItemId} className="flex justify-between gap-3 border-b border-forest/5 py-1">
            <span>{ingredient.name}</span>
            <span className="text-ink/60">{ingredient.grams} g · {ingredient.kcal} kcal</span>
          </li>
        ))}
      </ul>
      <ol className="mb-0 list-decimal space-y-1 pl-5 text-sm leading-6 text-ink/80">
        {meal.steps.map((step, index) => <li key={index}>{step}</li>)}
      </ol>
    </article>
  );
}

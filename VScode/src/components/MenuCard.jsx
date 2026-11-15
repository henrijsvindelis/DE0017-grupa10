import { useState } from 'react';

export function MenuCard({ item, canDelete, onDelete, deleting, canEdit, onEdit, className = '' }) {
  const isRecipe = item.type === 'recipe';
  const [showSteps, setShowSteps] = useState(false);

  return (
    <article className={`group relative flex flex-col overflow-hidden rounded-2xl border border-forest/10 bg-white p-6 shadow-sm transition duration-200 hover:-translate-y-1 hover:shadow-lg ${className}`}>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-2">
        <span className="rounded-full bg-sage/60 px-3 py-1 text-xs font-bold uppercase tracking-wider text-forest">
          {isRecipe ? 'Recipe' : 'Food item'}
        </span>
        <div className="ml-auto flex items-center gap-3">
          <span className="text-xs font-medium text-ink/45">
            {isRecipe ? (item.saves ? `Saved by ${item.saves} ${item.saves === 1 ? 'person' : 'people'}` : 'From the kitchen') : 'Nutrition'}
          </span>
          {canEdit && (
            <button
              type="button"
              onClick={() => onEdit(item)}
              aria-label={`Edit ${item.name}`}
              title="Edit menu item"
              className="rounded-full bg-cream px-3 py-1 text-xs font-bold text-forest transition hover:bg-forest hover:text-white"
            >
              Edit
            </button>
          )}
          {canDelete && (
            <button
              type="button"
              onClick={() => onDelete(item)}
              disabled={deleting}
              aria-label={`Delete ${item.name}`}
              title="Delete menu item"
              className="grid size-7 place-items-center rounded-full bg-cream text-lg leading-none text-terracotta transition hover:bg-terracotta hover:text-white disabled:opacity-50"
            >
              ×
            </button>
          )}
        </div>
      </div>
      <h3 className="mb-2 font-display text-2xl leading-tight text-forest">{item.name}</h3>
      {isRecipe ? (
        <>
          <p className="min-h-10 text-sm leading-6 text-ink/65">
            {item.description || `${item.amount_portions} portions, made to share.`}
          </p>
          <div className="my-5 flex flex-wrap gap-2">
            <span className="rounded-lg bg-cream px-3 py-2 text-xs font-semibold text-ink/70">{item.amount_portions} portions</span>
            <span className="rounded-lg bg-cream px-3 py-2 text-xs font-semibold text-ink/70">{item.caloryperportion} kcal / portion</span>
          </div>
          <div className="mt-auto border-t border-forest/10 pt-4 text-sm">
            <button
              type="button"
              onClick={() => setShowSteps(true)}
              aria-expanded={showSteps}
              className="font-semibold text-forest transition hover:text-terracotta"
            >
              <span className="text-terracotta">▸</span> See cooking steps
            </button>
          </div>
          {showSteps && (
            // Soļi atveras virs kartītes, lai kartītes izmērs nemainās un visas paliek vienā augstumā
            <div className="absolute inset-0 z-10 flex flex-col bg-white p-6">
              <div className="mb-3 flex items-start justify-between gap-3">
                <h4 className="mb-0 font-display text-xl leading-tight text-forest">{item.name}</h4>
                <button
                  type="button"
                  onClick={() => setShowSteps(false)}
                  aria-label="Close cooking steps"
                  className="grid size-7 shrink-0 place-items-center rounded-full bg-cream text-lg leading-none text-forest transition hover:bg-forest hover:text-white"
                >
                  ×
                </button>
              </div>
              <p className="mb-0 min-h-0 flex-1 overflow-y-auto whitespace-pre-line pr-1 text-sm leading-6 text-ink/65">{item.cooking_steps}</p>
            </div>
          )}
        </>
      ) : (
        <>
          <p className="text-sm font-semibold text-terracotta">
            {item.kcal_100g} kcal per 100 g
            {item.verified === false && <span className="ml-2 rounded-full bg-cream px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider text-ink/50" title="Added by a user, not yet checked by a nutritionist">Unverified</span>}
          </p>
          <div className="mt-5 grid grid-cols-3 gap-2 border-t border-forest/10 pt-4 text-center">
            {[
              ['Protein', item.protein_100g],
              ['Fat', item.fat_100g],
              ['Carbs', item.carbohydrates_100g]
            ].map(([label, amount]) => (
              <div key={label} className="rounded-lg bg-cream px-2 py-3">
                <p className="mb-1 text-sm font-bold text-forest">{amount} g</p>
                <p className="mb-0 text-[11px] text-ink/55">{label}</p>
              </div>
            ))}
          </div>
        </>
      )}
    </article>
  );
}

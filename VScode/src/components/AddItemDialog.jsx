import { useEffect, useState } from 'react';
import { FormField } from './FormFields';

export function AddItemDialog({ open, onClose, onSaved, user, item = null }) {
  const editing = Boolean(item);
  const canAddFood = user.role === 'Admin' || user.role === 'Nutritionist';
  const canAddRecipe = user.role !== 'Admin';
  const [type, setType] = useState(item?.type || (canAddFood ? 'food-item' : 'recipe'));
  const [status, setStatus] = useState({ message: '', error: false });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return undefined;
    function handleKeyDown(event) {
      if (event.key === 'Escape' && !saving) onClose();
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, saving, onClose]);

  if (!open) return null;

  async function handleSubmit(event) {
    event.preventDefault();
    const form = event.currentTarget;
    setSaving(true);
    setStatus({ message: 'Saving your addition…', error: false });
    const formData = new FormData(form);
    const values = Object.fromEntries(formData.entries());

    for (const field of ['kcal_100g', 'protein_100g', 'fat_100g', 'carbohydrates_100g', 'amount_portions', 'caloryperportion']) {
      if (values[field] !== undefined) values[field] = Number(values[field]);
    }

    try {
      const response = await fetch(editing ? `/api/food-items/${encodeURIComponent(item.id)}` : '/api/food-items', {
        method: editing ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values)
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Unable to save this item.');
      setStatus({ message: editing ? 'Changes saved.' : 'Added to the menu. Thank you!', error: false });
      if (!editing) form.reset();
      await onSaved();
      window.setTimeout(onClose, 650);
    } catch (error) {
      setStatus({ message: error.message || 'Unable to save this item. Please try again.', error: true });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-forest/65 p-4 backdrop-blur-sm"
      onMouseDown={(event) => { if (event.target === event.currentTarget && !saving) onClose(); }}
    >
      <section role="dialog" aria-modal="true" aria-labelledby="dialog-title" className="my-auto w-full max-w-xl rounded-3xl bg-white p-6 shadow-2xl sm:p-9">
        <div className="mb-7 flex items-start justify-between gap-4">
          <div>
            <p className="mb-2 text-xs font-bold uppercase tracking-[0.18em] text-terracotta">{editing ? 'Keep the menu tidy' : 'Share something good'}</p>
            <h2 id="dialog-title" className="font-display text-3xl text-forest sm:text-4xl">{editing ? `Edit ${item.type === 'recipe' ? 'recipe' : 'food item'}` : 'Add to the menu'}</h2>
          </div>
          <button type="button" onClick={onClose} disabled={saving} aria-label="Close dialog" className="grid size-10 shrink-0 place-items-center rounded-full bg-cream text-xl text-forest transition hover:bg-sage disabled:opacity-50">×</button>
        </div>

        <form className="grid gap-5" onSubmit={handleSubmit}>
          {editing ? <input type="hidden" name="type" value={type} /> : (canAddFood && canAddRecipe) ? (
          <label className="block text-sm font-semibold text-forest">
            What are you adding?
            <select
              name="type"
              value={type}
              onChange={(event) => { setType(event.target.value); setStatus({ message: '', error: false }); }}
              className="mt-2 w-full rounded-xl border border-forest/15 bg-cream/60 px-4 py-3 text-sm outline-none focus:border-forest focus:ring-4 focus:ring-forest/10"
            >
              {canAddFood && <option value="food-item">Food item</option>}
              {canAddRecipe && <option value="recipe">Recipe</option>}
            </select>
          </label>
          ) : <input type="hidden" name="type" value={type} />}
          <FormField label="Name" name="name" maxLength={100} defaultValue={item?.name ?? ''} />
          {type === 'food-item' ? (
            <fieldset className="grid gap-4 border-0 p-0 sm:grid-cols-2">
              <legend className="mb-1 text-sm font-semibold text-forest">Nutrition per 100 g</legend>
              <FormField label="Calories (kcal)" name="kcal_100g" type="number" min="0" step="any" defaultValue={item?.kcal_100g ?? ''} />
              <FormField label="Protein (g)" name="protein_100g" type="number" min="0" step="any" defaultValue={item?.protein_100g ?? ''} />
              <FormField label="Fat (g)" name="fat_100g" type="number" min="0" step="any" defaultValue={item?.fat_100g ?? ''} />
              <FormField label="Carbohydrates (g)" name="carbohydrates_100g" type="number" min="0" step="any" defaultValue={item?.carbohydrates_100g ?? ''} />
            </fieldset>
          ) : (
            <fieldset className="grid gap-4 border-0 p-0 sm:grid-cols-2">
              <legend className="mb-1 text-sm font-semibold text-forest">Recipe details</legend>
              <div className="sm:col-span-2"><FormField label="Description (optional)" name="description" type="textarea" required={false} maxLength={2000} defaultValue={item?.description ?? ''} /></div>
              <div className="sm:col-span-2"><FormField label="Cooking steps" name="cooking_steps" type="textarea" defaultValue={item?.cooking_steps ?? ''} /></div>
              <FormField label="Amount of portions" name="amount_portions" type="number" min="1" step="1" defaultValue={item?.amount_portions ?? ''} />
              <FormField label="Calories per portion (kcal)" name="caloryperportion" type="number" min="0" step="any" defaultValue={item?.caloryperportion ?? ''} />
            </fieldset>
          )}
          <p className={`min-h-5 text-sm ${status.error ? 'text-red-700' : 'text-forest/70'}`} role="status" aria-live="polite">{status.message}</p>
          <div className="flex justify-end gap-3">
            <button type="button" onClick={onClose} disabled={saving} className="rounded-xl border border-forest/20 px-5 py-3 text-sm font-bold text-forest transition hover:bg-cream disabled:opacity-50">Cancel</button>
            <button type="submit" disabled={saving} className="rounded-xl bg-terracotta px-5 py-3 text-sm font-bold text-white transition hover:bg-terracotta-dark disabled:cursor-wait disabled:opacity-60">
              {saving ? 'Saving…' : editing ? 'Save changes' : 'Add to the menu'}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

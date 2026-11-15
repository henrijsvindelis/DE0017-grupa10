import { useState } from 'react';

export function PantryRow({ entry, onUpdate, onRemove, excluded = false }) {
  const startUnit = entry.grams >= 1000 ? 'kg' : 'g';
  const [unit, setUnit] = useState(startUnit);
  const [amount, setAmount] = useState(String(startUnit === 'kg' ? entry.grams / 1000 : entry.grams));
  const grams = Math.round(unit === 'kg' ? Number(amount) * 1000 : Number(amount));
  const changed = Number.isFinite(grams) && grams > 0 && grams !== entry.grams;

  function changeUnit(nextUnit) {
    const value = Number(amount);
    if (Number.isFinite(value)) setAmount(String(nextUnit === 'kg' ? value / 1000 : value * 1000));
    setUnit(nextUnit);
  }

  return (
    <li className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-cream/60 px-4 py-3 text-sm">
      <span className="font-semibold text-forest">
        {entry.name}
        <span className="ml-2 font-normal text-ink/50">{entry.kcal_100g} kcal / 100 g{entry.ownValues ? ' · your values' : ''}</span>
        {excluded && (
          <span className="mt-1 block text-xs font-normal text-terracotta-dark">Not vegetarian, so it will not be used in your meal plans.</span>
        )}
      </span>
      <span className="flex items-center gap-2 text-ink/60">
        <input aria-label={`Amount of ${entry.name}`} className="w-24 rounded-lg border border-forest/15 bg-white px-2 py-1.5 text-right text-sm text-ink" type="number" min="0" step="any" value={amount} onChange={(event) => setAmount(event.target.value)} />
        <select aria-label="Unit" className="rounded-lg border border-forest/15 bg-white px-2 py-1.5 text-sm text-ink" value={unit} onChange={(event) => changeUnit(event.target.value)}>
          <option value="g">g</option>
          <option value="kg">kg</option>
        </select>
        {changed && <button type="button" onClick={() => onUpdate(entry.foodItemId, grams)} className="rounded-lg bg-forest px-3 py-1.5 text-xs font-bold text-white hover:bg-forest-light">Save</button>}
        <button type="button" onClick={() => onRemove(entry.foodItemId)} className="ml-1 font-bold text-terracotta hover:text-terracotta-dark" aria-label={`Remove ${entry.name}`}>×</button>
      </span>
    </li>
  );
}

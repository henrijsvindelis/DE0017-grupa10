import { useEffect, useState } from 'react';

const nutritionLabels = [
  ['kcal_100g', 'Calories (kcal)'],
  ['protein_100g', 'Protein (g)'],
  ['fat_100g', 'Fat (g)'],
  ['carbohydrates_100g', 'Carbohydrates (g)']
];

const emptyNutrition = { kcal_100g: '', protein_100g: '', fat_100g: '', carbohydrates_100g: '' };

export function AddProductDialog({ open, onClose, onSaved }) {
  const [products, setProducts] = useState([]);
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [unit, setUnit] = useState('g');
  const [nutrition, setNutrition] = useState(emptyNutrition);
  const [prefilled, setPrefilled] = useState(false);
  const [status, setStatus] = useState({ message: '', error: false });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return undefined;
    fetch('/api/products').then((response) => response.json()).then((result) => setProducts(result.products || [])).catch(() => {});
    function handleKeyDown(event) {
      if (event.key === 'Escape' && !saving) onClose();
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, saving, onClose]);

  if (!open) return null;

  function handleNameChange(value) {
    setName(value);
    const match = products.find((product) => product.verified && product.name.toLowerCase() === value.trim().toLowerCase());
    if (match) {
      setNutrition(Object.fromEntries(nutritionLabels.map(([field]) => [field, String(match[field])])));
      setPrefilled(true);
    } else if (prefilled) {
      setNutrition(emptyNutrition);
      setPrefilled(false);
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setSaving(true);
    setStatus({ message: 'Saving…', error: false });
    const grams = unit === 'kg' ? Number(amount) * 1000 : Number(amount);
    try {
      const response = await fetch('/api/pantry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          grams,
          nutrition: Object.fromEntries(nutritionLabels.map(([field]) => [field, Number(nutrition[field])]))
        })
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Unable to add this product.');
      setStatus({ message: 'Added to your products.', error: false });
      await onSaved?.(result.pantry);
      window.setTimeout(onClose, 650);
    } catch (error) {
      setStatus({ message: error.message, error: true });
    } finally {
      setSaving(false);
    }
  }

  const inputClass = 'mt-2 w-full rounded-xl border border-forest/15 bg-cream/60 px-4 py-3 text-sm text-ink outline-none transition focus:border-forest focus:ring-4 focus:ring-forest/10';

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-forest/65 p-4 backdrop-blur-sm"
      onMouseDown={(event) => { if (event.target === event.currentTarget && !saving) onClose(); }}
    >
      <section role="dialog" aria-modal="true" aria-labelledby="product-dialog-title" className="my-auto w-full max-w-xl rounded-3xl bg-white p-6 shadow-2xl sm:p-9">
        <div className="mb-7 flex items-start justify-between gap-4">
          <div>
            <p className="mb-2 text-xs font-bold uppercase tracking-[0.18em] text-terracotta">What do you have at home?</p>
            <h2 id="product-dialog-title" className="font-display text-3xl text-forest sm:text-4xl">Add a product</h2>
          </div>
          <button type="button" onClick={onClose} disabled={saving} aria-label="Close dialog" className="grid size-10 shrink-0 place-items-center rounded-full bg-cream text-xl text-forest transition hover:bg-sage disabled:opacity-50">×</button>
        </div>

        <form className="grid gap-5" onSubmit={handleSubmit}>
          <label className="block text-sm font-semibold text-forest">
            Product name
            <input className={inputClass} list="product-suggestions" value={name} onChange={(event) => handleNameChange(event.target.value)} maxLength={100} required autoComplete="off" />
            <datalist id="product-suggestions">
              {products.map((product) => <option key={product.id} value={product.name} />)}
            </datalist>
          </label>

          <div className="grid grid-cols-[1fr_110px] gap-4">
            <label className="block text-sm font-semibold text-forest">
              Amount you have
              <input className={inputClass} type="number" min={unit === 'kg' ? '0.001' : '1'} step="any" value={amount} onChange={(event) => setAmount(event.target.value)} required />
            </label>
            <label className="block text-sm font-semibold text-forest">
              Unit
              <select className={inputClass} value={unit} onChange={(event) => setUnit(event.target.value)}>
                <option value="g">g</option>
                <option value="kg">kg</option>
              </select>
            </label>
          </div>

          <fieldset className="grid gap-4 border-0 p-0 sm:grid-cols-2">
            <legend className="mb-1 text-sm font-semibold text-forest">Nutrition per 100 g (from the package)</legend>
            {nutritionLabels.map(([field, label]) => (
              <label key={field} className="block text-sm font-semibold text-forest">
                {label}
                <input className={inputClass} type="number" min="0" step="any" value={nutrition[field]} onChange={(event) => setNutrition((current) => ({ ...current, [field]: event.target.value }))} required />
              </label>
            ))}
          </fieldset>
          {prefilled && <p className="-mt-2 mb-0 text-xs text-ink/55">Filled in from our checked database. Change the values if your package says otherwise.</p>}

          <p className={`min-h-5 text-sm ${status.error ? 'text-red-700' : 'text-forest/70'}`} role="status" aria-live="polite">{status.message}</p>
          <div className="flex justify-end gap-3">
            <button type="button" onClick={onClose} disabled={saving} className="rounded-xl border border-forest/20 px-5 py-3 text-sm font-bold text-forest transition hover:bg-cream disabled:opacity-50">Cancel</button>
            <button type="submit" disabled={saving} className="rounded-xl bg-terracotta px-5 py-3 text-sm font-bold text-white transition hover:bg-terracotta-dark disabled:cursor-wait disabled:opacity-60">
              {saving ? 'Saving…' : 'Add product'}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

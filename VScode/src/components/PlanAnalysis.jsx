const nutrientLabels = {
  A: 'Vitamin A', B1: 'Vitamin B1', B2: 'Vitamin B2', PP: 'Vitamin PP (niacin)', C: 'Vitamin C',
  Ca: 'Calcium', P: 'Phosphorus', Fe: 'Iron'
};

function AnalysisBar({ label, value, percent, color = 'bg-forest' }) {
  return (
    <div>
      <div className="mb-1 flex justify-between gap-3 text-sm">
        <span className="font-semibold text-forest">{label}</span>
        <span className="text-ink/60">{value}</span>
      </div>
      <div className="h-2.5 overflow-hidden rounded-full bg-cream" role="presentation">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${Math.min(Math.max(percent, 0), 100)}%` }} />
      </div>
    </div>
  );
}

function PartialNote({ show, what }) {
  if (!show) return null;
  return <p className="mb-0 mt-3 text-xs text-ink/50">Partial data: some products have no {what} data and are not counted.</p>;
}

function NutrientBars({ title, items, partial, what }) {
  return (
    <div>
      <h3 className="mb-4 text-xs font-bold uppercase tracking-wider text-ink/45">{title}</h3>
      {items.length ? (
        <div className="grid gap-3">
          {items.map((item) => (
            <AnalysisBar
              key={item.key}
              label={nutrientLabels[item.key] || item.key}
              value={`${item.mg} mg · ${item.percent}% of ${item.normMg} mg`}
              percent={item.percent}
              color={item.percent >= 100 ? 'bg-forest' : 'bg-terracotta'}
            />
          ))}
        </div>
      ) : <p className="mb-0 text-sm text-ink/60">No {what} data for these products.</p>}
      <PartialNote show={partial && items.length > 0} what={what} />
    </div>
  );
}

export function PlanAnalysis({ analysis }) {
  const { macros } = analysis;
  return (
    <section className="rounded-3xl border border-forest/10 bg-white p-7 shadow-sm">
      <h2 className="mb-6 font-display text-2xl text-forest">Analysis</h2>
      <div className="grid gap-8 md:grid-cols-2">
        <div>
          <h3 className="mb-4 text-xs font-bold uppercase tracking-wider text-ink/45">Macronutrients (share of calories)</h3>
          <div className="grid gap-3">
            <AnalysisBar label="Protein" value={`${macros.protein.grams} g · ${macros.protein.percent}%`} percent={macros.protein.percent} color="bg-forest" />
            <AnalysisBar label="Fat" value={`${macros.fat.grams} g · ${macros.fat.percent}%`} percent={macros.fat.percent} color="bg-terracotta" />
            <AnalysisBar label="Carbohydrates" value={`${macros.carbohydrates.grams} g · ${macros.carbohydrates.percent}%`} percent={macros.carbohydrates.percent} color="bg-yellow-400" />
          </div>
        </div>
        <div>
          <h3 className="mb-4 text-xs font-bold uppercase tracking-wider text-ink/45">Estimated cost for the day</h3>
          {analysis.costEur !== null ? (
            <p className="mb-0 text-3xl font-semibold text-forest">€{analysis.costEur.toFixed(2)}</p>
          ) : <p className="mb-0 text-sm text-ink/60">No price data for these products.</p>}
          <PartialNote show={analysis.costPartial && analysis.costEur !== null} what="price" />
        </div>
        <NutrientBars title="Vitamins (% of daily norm)" items={analysis.vitamins} partial={analysis.vitaminsPartial} what="vitamin" />
        <NutrientBars title="Minerals (% of daily norm)" items={analysis.minerals} partial={analysis.mineralsPartial} what="mineral" />
      </div>
    </section>
  );
}

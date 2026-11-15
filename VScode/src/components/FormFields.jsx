export function FormField({ label, name, type = 'text', min, step, required = true, ...props }) {
  const commonClass = 'mt-2 w-full rounded-xl border border-forest/15 bg-cream/60 px-4 py-3 text-sm text-ink outline-none transition placeholder:text-ink/35 focus:border-forest focus:ring-4 focus:ring-forest/10';
  return (
    <label className="block text-sm font-semibold text-forest">
      {label}
      {type === 'textarea' ? (
        <textarea className={`${commonClass} min-h-24 resize-y`} name={name} required={required} {...props} />
      ) : (
        <input className={commonClass} name={name} type={type} min={min} step={step} required={required} {...props} />
      )}
    </label>
  );
}

export function FormSelect({ label, name, options, value, allowEmpty = true, ...props }) {
  const commonClass = 'mt-2 w-full rounded-xl border border-forest/15 bg-cream/60 px-4 py-3 text-sm text-ink outline-none transition focus:border-forest focus:ring-4 focus:ring-forest/10';
  return (
    <label className="block text-sm font-semibold text-forest">
      {label}
      <select className={commonClass} name={name} defaultValue={value || (allowEmpty ? '' : options[0][0])} {...props}>
        {allowEmpty && <option value="">Not specified</option>}
        {options.map(([optionValue, optionLabel]) => (
          <option key={optionValue} value={optionValue}>{optionLabel}</option>
        ))}
      </select>
    </label>
  );
}

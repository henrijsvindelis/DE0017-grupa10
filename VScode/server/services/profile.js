

const numericProfileFields = {
  age: { min: 1, max: 120, integer: true },
  height: { min: 30, max: 300 },
  weight: { min: 1, max: 500 },
  dailyKcalGoal: { min: 500, max: 10000, integer: true }
};

const enumProfileFields = {
  sex: ['female', 'male'],
  activityLevel: ['sedentary', 'lightly-active', 'moderately-active', 'very-active', 'extra-active'],
  goal: ['lose', 'gain', 'maintain'],
  diet: ['standard', 'vegetarian']
};

function parseProfileFields(input) {
  const values = {};
  for (const [field, { min, max, integer }] of Object.entries(numericProfileFields)) {
    if (!Object.prototype.hasOwnProperty.call(input, field)) continue;
    const rawValue = input[field];
    if (rawValue === null || rawValue === '') {
      values[field] = null;
      continue;
    }
    const value = typeof rawValue === 'number'
      ? rawValue
      : typeof rawValue === 'string' && rawValue.trim() !== '' ? Number(rawValue) : NaN;
    if (!Number.isFinite(value) || value < min || value > max || (integer && !Number.isInteger(value))) {
      return { error: `Enter a valid ${field} value.`, values: null };
    }
    values[field] = value;
  }
  for (const [field, allowedValues] of Object.entries(enumProfileFields)) {
    if (!Object.prototype.hasOwnProperty.call(input, field)) continue;
    const value = input[field];
    if (value === null || value === '') {
      values[field] = null;
      continue;
    }
    if (typeof value !== 'string' || !allowedValues.includes(value)) {
      return { error: `Choose a valid ${field}.`, values: null };
    }
    values[field] = value;
  }
  // Diētai nav "nav norādīts" vērtības: tukša nozīmē standarta
  if (values.diet === null) values.diet = 'standard';
  return { error: null, values };
}

module.exports = { parseProfileFields };

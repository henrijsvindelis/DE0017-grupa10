import { FormField, FormSelect } from './FormFields';

export function ProfileFields({ user }) {
  return (
    <fieldset className="grid gap-4 border-0 p-0 sm:grid-cols-2">
      <legend className="mb-1 text-sm font-semibold text-forest">Personal details (all optional)</legend>
      <FormField label="Age" name="age" type="number" min="1" max="120" step="1" required={false} defaultValue={user?.age ?? ''} />
      <FormSelect
        label="Sex"
        name="sex"
        value={user?.sex}
        options={[
          ['female', 'Female'],
          ['male', 'Male']
        ]}
      />
      <FormField label="Height (cm)" name="height" type="number" min="30" max="300" step="any" required={false} defaultValue={user?.height ?? ''} />
      <FormField label="Weight (kg)" name="weight" type="number" min="1" max="500" step="any" required={false} defaultValue={user?.weight ?? ''} />
      <FormSelect
        label="Activity level"
        name="activityLevel"
        value={user?.activityLevel}
        options={[
          ['sedentary', 'Sedentary'],
          ['lightly-active', 'Lightly active'],
          ['moderately-active', 'Moderately active'],
          ['very-active', 'Very active'],
          ['extra-active', 'Extra active']
        ]}
      />
      <FormSelect
        label="Goal"
        name="goal"
        value={user?.goal}
        options={[
          ['lose', 'Lose weight'],
          ['gain', 'Gain weight'],
          ['maintain', 'Maintain weight']
        ]}
      />
      <FormField label="Daily calorie goal (kcal)" name="dailyKcalGoal" type="number" min="500" max="10000" step="1" required={false} defaultValue={user?.dailyKcalGoal ?? ''} />
      <FormSelect
        label="Diet"
        name="diet"
        value={user?.diet}
        allowEmpty={false}
        options={[
          ['standard', 'Standard'],
          ['vegetarian', 'Vegetarian']
        ]}
      />
    </fieldset>
  );
}

export function profileValuesFrom(formData) {
  const values = Object.fromEntries(formData.entries());
  for (const field of ['age', 'height', 'weight', 'dailyKcalGoal']) {
    values[field] = values[field] === '' ? null : Number(values[field]);
  }
  return values;
}

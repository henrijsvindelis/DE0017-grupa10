import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './style.css';

const initialItems = { recipes: [], foodItems: [] };

function ArrowIcon({ className = 'size-4' }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path d="M4.167 10h11.666M10 4.167 15.833 10 10 15.833" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function LeafIcon() {
  return (
    <svg className="size-6" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M19.5 4.5c-7.75 0-13 3.25-13 9a5 5 0 0 0 5 5c5.75 0 9-5.25 8-14Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M4.5 20c2.25-4.25 5.25-7.25 10-10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function MenuCard({ item, canDelete, onDelete, deleting }) {
  const isRecipe = item.type === 'recipe';

  return (
    <article className="group relative rounded-2xl border border-forest/10 bg-white p-6 shadow-sm transition duration-200 hover:-translate-y-1 hover:shadow-lg">
      <div className="mb-5 flex items-center justify-between">
        <span className="rounded-full bg-sage/60 px-3 py-1 text-xs font-bold uppercase tracking-wider text-forest">
          {isRecipe ? 'Recipe' : 'Food item'}
        </span>
        <div className="flex items-center gap-3">
          <span className="text-xs font-medium text-ink/45">{isRecipe ? 'From the kitchen' : 'Nutrition'}</span>
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
          <details className="border-t border-forest/10 pt-4 text-sm">
            <summary className="cursor-pointer font-semibold text-forest marker:text-terracotta">See cooking steps</summary>
            <p className="mb-0 mt-3 whitespace-pre-line leading-6 text-ink/65">{item.cooking_steps}</p>
          </details>
        </>
      ) : (
        <>
          <p className="text-sm font-semibold text-terracotta">{item.kcal_100g} kcal per 100 g</p>
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

function MenuGroup({ title, items, loading, type, canDelete, onDelete, deletingId }) {
  return (
    <section aria-labelledby={`${type}-title`}>
      <div className="mb-5 flex items-end justify-between gap-4">
        <div>
          <p className="mb-2 text-xs font-bold uppercase tracking-[0.18em] text-terracotta">Made with care</p>
          <h3 id={`${type}-title`} className="font-display text-3xl text-forest">{title}</h3>
        </div>
        <span className="hidden text-sm text-ink/50 sm:block">{items.length ? `${items.length} on the menu` : 'Fresh ideas welcome'}</span>
      </div>
      {loading ? (
        <p className="rounded-2xl border border-forest/10 bg-white p-6 text-sm text-ink/60" role="status">Loading the menu…</p>
      ) : items.length ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {items.map((item) => (
            <MenuCard
              key={item.id}
              item={item}
              canDelete={canDelete}
              onDelete={onDelete}
              deleting={deletingId === item.id}
            />
          ))}
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-forest/20 bg-white/70 px-6 py-10 text-center">
          <p className="mb-2 font-display text-xl text-forest">A place for something delicious</p>
          <p className="mb-0 text-sm text-ink/55">Nothing here yet. Add the first {type === 'recipe' ? 'recipe' : 'food item'} to get started.</p>
        </div>
      )}
    </section>
  );
}

function FormField({ label, name, type = 'text', min, step, required = true, ...props }) {
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

function FormSelect({ label, name, options, value, ...props }) {
  const commonClass = 'mt-2 w-full rounded-xl border border-forest/15 bg-cream/60 px-4 py-3 text-sm text-ink outline-none transition focus:border-forest focus:ring-4 focus:ring-forest/10';
  return (
    <label className="block text-sm font-semibold text-forest">
      {label}
      <select className={commonClass} name={name} defaultValue={value || ''} {...props}>
        <option value="">Not specified</option>
        {options.map(([optionValue, optionLabel]) => (
          <option key={optionValue} value={optionValue}>{optionLabel}</option>
        ))}
      </select>
    </label>
  );
}

function ProfileFields({ user }) {
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
    </fieldset>
  );
}

function profileValuesFrom(formData) {
  const values = Object.fromEntries(formData.entries());
  for (const field of ['age', 'height', 'weight', 'dailyKcalGoal']) {
    values[field] = values[field] === '' ? null : Number(values[field]);
  }
  return values;
}

function AddItemDialog({ open, onClose, onSaved, user }) {
  const canAddFood = user.role === 'Admin' || user.role === 'Nutritionist';
  const [type, setType] = useState(canAddFood ? 'food-item' : 'recipe');
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
    const item = Object.fromEntries(formData.entries());

    for (const field of ['kcal_100g', 'protein_100g', 'fat_100g', 'carbohydrates_100g', 'amount_portions', 'caloryperportion']) {
      if (item[field] !== undefined) item[field] = Number(item[field]);
    }

    try {
      const response = await fetch('/api/food-items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(item)
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Unable to save this item.');
      setStatus({ message: 'Added to the menu. Thank you!', error: false });
      form.reset();
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
            <p className="mb-2 text-xs font-bold uppercase tracking-[0.18em] text-terracotta">Share something good</p>
            <h2 id="dialog-title" className="font-display text-3xl text-forest sm:text-4xl">Add to the menu</h2>
          </div>
          <button type="button" onClick={onClose} disabled={saving} aria-label="Close dialog" className="grid size-10 shrink-0 place-items-center rounded-full bg-cream text-xl text-forest transition hover:bg-sage disabled:opacity-50">×</button>
        </div>

        <form className="grid gap-5" onSubmit={handleSubmit}>
          <label className="block text-sm font-semibold text-forest">
            What are you adding?
            <select
              name="type"
              value={type}
              onChange={(event) => { setType(event.target.value); setStatus({ message: '', error: false }); }}
              className="mt-2 w-full rounded-xl border border-forest/15 bg-cream/60 px-4 py-3 text-sm outline-none focus:border-forest focus:ring-4 focus:ring-forest/10"
            >
              {canAddFood && <option value="food-item">Food item</option>}
              <option value="recipe">Recipe</option>
            </select>
          </label>
          <FormField label="Name" name="name" maxLength={100} />
          {type === 'food-item' ? (
            <fieldset className="grid gap-4 border-0 p-0 sm:grid-cols-2">
              <legend className="mb-1 text-sm font-semibold text-forest">Nutrition per 100 g</legend>
              <FormField label="Calories (kcal)" name="kcal_100g" type="number" min="0" step="any" />
              <FormField label="Protein (g)" name="protein_100g" type="number" min="0" step="any" />
              <FormField label="Fat (g)" name="fat_100g" type="number" min="0" step="any" />
              <FormField label="Carbohydrates (g)" name="carbohydrates_100g" type="number" min="0" step="any" />
            </fieldset>
          ) : (
            <fieldset className="grid gap-4 border-0 p-0 sm:grid-cols-2">
              <legend className="mb-1 text-sm font-semibold text-forest">Recipe details</legend>
              <div className="sm:col-span-2"><FormField label="Description (optional)" name="description" type="textarea" required={false} maxLength={2000} /></div>
              <div className="sm:col-span-2"><FormField label="Cooking steps" name="cooking_steps" type="textarea" /></div>
              <FormField label="Amount of portions" name="amount_portions" type="number" min="1" step="1" />
              <FormField label="Calories per portion (kcal)" name="caloryperportion" type="number" min="0" step="any" />
            </fieldset>
          )}
          <p className={`min-h-5 text-sm ${status.error ? 'text-red-700' : 'text-forest/70'}`} role="status" aria-live="polite">{status.message}</p>
          <div className="flex justify-end gap-3">
            <button type="button" onClick={onClose} disabled={saving} className="rounded-xl border border-forest/20 px-5 py-3 text-sm font-bold text-forest transition hover:bg-cream disabled:opacity-50">Cancel</button>
            <button type="submit" disabled={saving} className="rounded-xl bg-terracotta px-5 py-3 text-sm font-bold text-white transition hover:bg-terracotta-dark disabled:cursor-wait disabled:opacity-60">
              {saving ? 'Saving…' : 'Add to the menu'}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

function AuthPage({ register, onAuthenticated }) {
  const [status, setStatus] = useState({ message: '', error: false });
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const values = Object.fromEntries(formData.entries());
    if (register) Object.assign(values, profileValuesFrom(formData));
    if (register && values.password !== values.repeatPassword) {
      setStatus({ message: 'Passwords do not match.', error: true });
      return;
    }

    setSubmitting(true);
    setStatus({ message: '', error: false });
    try {
      const response = await fetch(`/api/auth/${register ? 'register' : 'login'}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values)
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Unable to continue.');
      onAuthenticated(result.user);
      window.location.assign('/');
    } catch (error) {
      setStatus({ message: error.message || 'Unable to continue. Please try again.', error: true });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="mx-auto grid min-h-[calc(100vh-76px)] max-w-lg content-center px-5 py-16">
      <section className="rounded-3xl border border-forest/10 bg-white p-7 shadow-sm sm:p-10">
        <p className="mb-2 text-xs font-bold uppercase tracking-[0.18em] text-terracotta">Quality Food account</p>
        <h1 className="mb-3 font-display text-4xl text-forest">{register ? 'Create your account' : 'Welcome back'}</h1>
        <p className="mb-8 text-sm leading-6 text-ink/60">
          {register ? 'Join the community and share your favorite recipes.' : 'Log in to share recipes and manage your account.'}
        </p>
        <form className="grid gap-5" onSubmit={handleSubmit}>
          <FormField label="Email" name="email" type="email" maxLength={254} autoComplete="email" />
          {register && <FormField label="Username" name="username" minLength={2} maxLength={30} autoComplete="username" />}
          <FormField label="Password" name="password" type="password" minLength={8} maxLength={128} autoComplete={register ? 'new-password' : 'current-password'} />
          {register && <FormField label="Repeat password" name="repeatPassword" type="password" minLength={8} maxLength={128} autoComplete="new-password" />}
          {register && <ProfileFields />}
          <p className={`min-h-5 text-sm ${status.error ? 'text-red-700' : 'text-forest/70'}`} role="status" aria-live="polite">{status.message}</p>
          <button type="submit" disabled={submitting} className="rounded-xl bg-forest px-5 py-3 text-sm font-bold text-white transition hover:bg-forest-light disabled:opacity-60">
            {submitting ? 'Please wait…' : register ? 'Create account' : 'Log in'}
          </button>
        </form>
        <p className="mb-0 mt-6 text-sm text-ink/60">
          {register ? 'Already have an account? ' : 'New to Quality Food? '}
          <a className="font-bold text-terracotta hover:text-terracotta-dark" href={register ? '/login' : '/register'}>
            {register ? 'Log in' : 'Create an account'}
          </a>
        </p>
      </section>
    </main>
  );
}

function ProfilePage({ user, onLogout, onUserUpdated }) {
  const [status, setStatus] = useState({ message: '', error: false });
  const [loggingOut, setLoggingOut] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);

  async function handleProfileSave(event) {
    event.preventDefault();
    setSavingProfile(true);
    setStatus({ message: '', error: false });
    try {
      const response = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(profileValuesFrom(new FormData(event.currentTarget)))
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Unable to save your profile.');
      onUserUpdated(result.user);
      setStatus({ message: 'Profile details saved.', error: false });
    } catch (error) {
      setStatus({ message: error.message || 'Unable to save your profile. Please try again.', error: true });
    } finally {
      setSavingProfile(false);
    }
  }

  async function handleLogout() {
    setLoggingOut(true);
    setStatus({ message: '', error: false });
    try {
      const response = await fetch('/api/auth/logout', { method: 'POST' });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Unable to log out.');
      onLogout();
      window.location.assign('/');
    } catch (error) {
      setStatus({ message: error.message || 'Unable to log out. Please try again.', error: true });
      setLoggingOut(false);
    }
  }

  return (
    <main className="mx-auto grid min-h-[calc(100vh-76px)] max-w-2xl content-center px-5 py-16">
      <section className="rounded-3xl border border-forest/10 bg-white p-7 shadow-sm sm:p-10">
        <p className="mb-2 text-xs font-bold uppercase tracking-[0.18em] text-terracotta">Your account</p>
        <h1 className="mb-8 font-display text-4xl text-forest">Profile settings</h1>
        {user ? (
          <>
            <dl className="grid gap-5 sm:grid-cols-2">
              <div><dt className="text-xs font-bold uppercase tracking-wider text-ink/45">Username</dt><dd className="mb-0 mt-1 text-base font-semibold text-forest">{user.username}</dd></div>
              <div><dt className="text-xs font-bold uppercase tracking-wider text-ink/45">Email</dt><dd className="mb-0 mt-1 break-all text-base font-semibold text-forest">{user.email}</dd></div>
              <div><dt className="text-xs font-bold uppercase tracking-wider text-ink/45">Account type</dt><dd className="mb-0 mt-1 text-base font-semibold text-forest">{user.role}</dd></div>
            </dl>
            <p className="mb-6 mt-6 text-sm leading-6 text-ink/60">To change your account type, contact an administrator.</p>
            <form className="grid gap-5 border-t border-forest/10 pt-6" onSubmit={handleProfileSave}>
              <ProfileFields user={user} />
              <button type="submit" disabled={savingProfile} className="justify-self-start rounded-xl bg-forest px-5 py-3 text-sm font-bold text-white transition hover:bg-forest-light disabled:opacity-60">
                {savingProfile ? 'Saving…' : 'Save profile details'}
              </button>
            </form>
            <p className={`min-h-5 text-sm ${status.error ? 'text-red-700' : 'text-forest/70'}`} role="status" aria-live="polite">{status.message}</p>
            <button type="button" onClick={handleLogout} disabled={loggingOut} className="rounded-xl bg-terracotta px-5 py-3 text-sm font-bold text-white transition hover:bg-terracotta-dark disabled:opacity-60">
              {loggingOut ? 'Logging out…' : 'Log out'}
            </button>
          </>
        ) : (
          <p className="mb-0 text-sm text-ink/60">You are not logged in. <a className="font-bold text-terracotta" href="/login">Log in</a> to view your profile.</p>
        )}
      </section>
    </main>
  );
}

function App() {
  const [items, setItems] = useState(initialItems);
  const [loading, setLoading] = useState(true);
  const [menuError, setMenuError] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deletingId, setDeletingId] = useState('');
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [pathname, setPathname] = useState(window.location.pathname);

  async function loadMenuItems() {
    setMenuError('');
    try {
      const [recipesResponse, foodItemsResponse] = await Promise.all([
        fetch('/api/food-items?type=recipe'),
        fetch('/api/food-items?type=food-item')
      ]);
      const [recipesResult, foodItemsResult] = await Promise.all([
        recipesResponse.json(),
        foodItemsResponse.json()
      ]);
      if (!recipesResponse.ok || !foodItemsResponse.ok) {
        throw new Error(recipesResult.error || foodItemsResult.error || 'Unable to load menu items.');
      }
      setItems({ recipes: recipesResult.items, foodItems: foodItemsResult.items });
    } catch (error) {
      setMenuError(`${error.message || 'Unable to load menu items.'} Saved items will appear when the database is available.`);
    } finally {
      setLoading(false);
    }
  }

  async function deleteMenuItem(item) {
    if (!window.confirm(`Are you sure you want to delete "${item.name}"? This cannot be undone.`)) return;

    setDeletingId(item.id);
    setMenuError('');
    try {
      const response = await fetch(`/api/food-items/${encodeURIComponent(item.id)}`, { method: 'DELETE' });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Unable to delete this menu item.');
      await loadMenuItems();
    } catch (error) {
      setMenuError(error.message || 'Unable to delete this menu item. Please try again.');
    } finally {
      setDeletingId('');
    }
  }

  useEffect(() => {
    fetch('/api/auth/me')
      .then(async (response) => {
        if (response.status === 401) return null;
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || 'Unable to check your account.');
        return result.user;
      })
      .then(setUser)
      .catch((error) => console.error(error.message))
      .finally(() => setAuthLoading(false));
    function handlePopState() { setPathname(window.location.pathname); }
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  useEffect(() => {
    if (pathname === '/') loadMenuItems();
  }, [pathname]);

  const isEditor = user?.role === 'Admin' || user?.role === 'Nutritionist';
  const profileLink = user ? (
    <a href="/profile" className="rounded-xl bg-forest px-4 py-3 text-xs font-bold text-white no-underline transition hover:bg-forest-light sm:px-5 sm:text-sm">
      Profile
    </a>
  ) : (
    <a href="/login" className="rounded-xl bg-forest px-4 py-3 text-xs font-bold text-white no-underline transition hover:bg-forest-light sm:px-5 sm:text-sm">
      Login
    </a>
  );

  return (
    <div className="min-h-screen bg-cream text-ink">
      <header className="sticky top-0 z-30 border-b border-forest/10 bg-cream/95 backdrop-blur">
        <div className="mx-auto flex min-h-[76px] max-w-7xl items-center justify-between gap-4 px-5 sm:px-8">
          <a className="flex items-center gap-3 text-forest no-underline" href="/" aria-label="Quality Food home">
            <span className="grid size-10 place-items-center rounded-full bg-forest text-sage"><LeafIcon /></span>
            <span className="flex flex-col text-lg font-bold leading-tight">Quality Food<span className="mt-1 text-[9px] font-bold uppercase tracking-[0.18em] text-ink/50">Thoughtful meal prep</span></span>
          </a>
          <nav aria-label="Main navigation" className="flex items-center gap-4 sm:gap-8">
            {pathname === '/' && <>
              <a className="hidden text-sm font-semibold text-ink/70 transition hover:text-terracotta sm:inline" href="#menu">The menu</a>
              <a className="hidden text-sm font-semibold text-ink/70 transition hover:text-terracotta md:inline" href="#approach">Our approach</a>
              <button type="button" onClick={() => user ? setDialogOpen(true) : window.location.assign('/login')} className="rounded-xl bg-terracotta px-3 py-2.5 text-xs font-bold text-white transition hover:bg-terracotta-dark sm:px-4 sm:py-2.5 sm:text-sm">
                {user && !isEditor ? 'Add recipe' : 'Add to menu'} <span aria-hidden="true">+</span>
              </button>
            </>}
            {profileLink}
          </nav>
        </div>
      </header>

      {pathname === '/login' || pathname === '/register' ? (
        <AuthPage register={pathname === '/register'} onAuthenticated={setUser} />
      ) : pathname === '/profile' ? (
        authLoading ? <main className="mx-auto max-w-2xl px-5 py-16 text-sm text-ink/60" role="status">Loading your profile…</main> : (
          <ProfilePage user={user} onLogout={() => setUser(null)} onUserUpdated={setUser} />
        )
      ) : <main id="home">
        <section className="relative isolate min-h-[590px] overflow-hidden bg-forest sm:min-h-[650px]">
          <img
            className="absolute inset-0 -z-20 size-full object-cover object-[58%_center]"
            src="https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&w=2400&q=85"
            alt=""
          />
          <div className="absolute inset-0 -z-10 bg-gradient-to-r from-forest/95 via-forest/70 to-forest/15" />
          <div className="mx-auto flex min-h-[590px] max-w-7xl items-center px-6 py-20 sm:min-h-[650px] sm:px-10">
            <div className="max-w-2xl text-white">
              <p className="mb-6 flex items-center gap-3 text-xs font-bold uppercase tracking-[0.2em] text-sage"><span className="h-px w-8 bg-sage" />A better kind of ready-made</p>
              <h1 className="mb-6 font-display text-5xl leading-[1.03] sm:text-7xl">A little more good in every day.</h1>
              <p className="mb-9 max-w-lg text-base leading-7 text-white/80 sm:text-lg sm:leading-8">Thoughtful, feel-good meals for the days that fill up before you do. Fresh food, made with room for real life.</p>
              <a href="#menu" className="inline-flex items-center gap-3 rounded-xl bg-sage px-6 py-4 text-sm font-bold text-forest transition hover:bg-white">
                Explore this week’s menu <ArrowIcon />
              </a>
              <div className="mt-12 flex items-center gap-3 text-xs font-semibold text-white/75">
                <span className="grid size-9 place-items-center rounded-full border border-white/30"><LeafIcon /></span>
                Simple ingredients. Thoughtfully made.
              </div>
            </div>
          </div>
          <div className="absolute bottom-8 right-6 hidden rounded-2xl border border-white/25 bg-white/10 px-5 py-4 text-white backdrop-blur-md lg:block">
            <p className="mb-1 text-xs uppercase tracking-widest text-white/70">A good place to start</p>
            <p className="mb-0 font-display text-xl">Find your new favorite.</p>
          </div>
        </section>

        <section id="menu" className="scroll-mt-24 px-5 py-20 sm:px-8 sm:py-28">
          <div className="mx-auto max-w-7xl">
            <div className="mb-12 grid gap-6 border-b border-forest/15 pb-10 md:grid-cols-[1fr_auto] md:items-end">
              <div>
                <p className="mb-3 text-xs font-bold uppercase tracking-[0.2em] text-terracotta">Good things, gathered</p>
                <h2 className="font-display text-4xl leading-tight text-forest sm:text-5xl">This week, on the table.</h2>
              </div>
              <p className="mb-1 max-w-sm text-sm leading-6 text-ink/60">A little inspiration for your next meal, made from good ingredients and shared with care.</p>
            </div>
            {menuError && (
              <p className="mb-8 rounded-xl border border-terracotta/20 bg-terracotta/5 px-5 py-4 text-sm text-terracotta-dark" role="status">
                {menuError}
              </p>
            )}
            <div className="grid gap-14">
              <MenuGroup title="Latest recipes" items={items.recipes} loading={loading} type="recipe" canDelete={isEditor} onDelete={deleteMenuItem} deletingId={deletingId} />
              <MenuGroup title="Latest food items" items={items.foodItems} loading={loading} type="food" canDelete={isEditor} onDelete={deleteMenuItem} deletingId={deletingId} />
            </div>
          </div>
        </section>

        <section id="approach" className="scroll-mt-24 bg-forest px-5 py-16 text-white sm:px-8 sm:py-20">
          <div className="mx-auto grid max-w-7xl gap-8 md:grid-cols-[1fr_1fr] md:items-end">
            <div>
              <p className="mb-3 text-xs font-bold uppercase tracking-[0.2em] text-sage">Our approach</p>
              <h2 className="max-w-xl font-display text-4xl leading-tight sm:text-5xl">Food that fits real life.</h2>
            </div>
            <p className="mb-1 max-w-xl text-sm leading-7 text-white/75 sm:text-base">Good food does not need to be complicated. We bring together wholesome ingredients and simple recipes to help make your week feel a little easier, one meal at a time.</p>
          </div>
        </section>
      </main>}

      <footer className="bg-forest-light px-5 py-7 text-white/75 sm:px-8">
        <div className="mx-auto flex max-w-7xl flex-col gap-2 text-xs sm:flex-row sm:items-center sm:justify-between">
          <p className="mb-0 font-bold uppercase tracking-[0.12em]">Quality Food · Meal prep, thoughtfully made</p>
          <p className="mb-0">Good food for the week ahead.</p>
        </div>
      </footer>

      {user && <AddItemDialog open={dialogOpen} onClose={() => setDialogOpen(false)} onSaved={loadMenuItems} user={user} />}
    </div>
  );
}

createRoot(document.getElementById('root')).render(<App />);

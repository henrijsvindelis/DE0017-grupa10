import { useState } from 'react';
import { FormField } from '../components/FormFields';
import { ProfileFields, profileValuesFrom } from '../components/ProfileFields';

export function AuthPage({ register, onAuthenticated }) {
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

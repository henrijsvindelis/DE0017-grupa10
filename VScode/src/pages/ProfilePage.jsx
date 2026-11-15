import { useState } from 'react';
import { ProfileFields, profileValuesFrom } from '../components/ProfileFields';

export function ProfilePage({ user, onLogout, onUserUpdated }) {
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

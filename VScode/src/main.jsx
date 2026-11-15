import { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './style.css';
import { AddItemDialog } from './components/AddItemDialog';
import { AddProductDialog } from './components/AddProductDialog';
import { SiteFooter } from './components/SiteFooter';
import { SiteHeader } from './components/SiteHeader';
import { AuthPage } from './pages/AuthPage';
import { HomePage } from './pages/HomePage';
import { MealPlannerPage } from './pages/MealPlannerPage';
import { ProfilePage } from './pages/ProfilePage';

function App() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [productDialogOpen, setProductDialogOpen] = useState(false);
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [pathname, setPathname] = useState(window.location.pathname);
  // Sākumlapas izvēlnes pārlādes funkcija (iestata HomePage), ko izsauc dialogi pēc saglabāšanas
  const reloadMenuRef = useRef(null);

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

  const isEditor = user?.role === 'Admin' || user?.role === 'Nutritionist';

  function openAddDialog() {
    if (!user) return window.location.assign('/login');
    setEditingItem(null);
    if (isEditor) setDialogOpen(true);
    else setProductDialogOpen(true);
  }

  function openEditDialog(item) {
    setEditingItem(item);
    setDialogOpen(true);
  }

  function closeDialog() {
    setDialogOpen(false);
    setEditingItem(null);
  }

  function reloadMenu() {
    return reloadMenuRef.current?.();
  }

  return (
    <div className="min-h-screen bg-cream text-ink">
      <SiteHeader pathname={pathname} user={user} onAdd={openAddDialog} />

      {pathname === '/login' || pathname === '/register' ? (
        <AuthPage register={pathname === '/register'} onAuthenticated={setUser} />
      ) : pathname === '/planner' ? (
        authLoading ? <main className="mx-auto max-w-2xl px-5 py-16 text-sm text-ink/60" role="status">Loading…</main> : <MealPlannerPage user={user} />
      ) : pathname === '/profile' ? (
        authLoading ? <main className="mx-auto max-w-2xl px-5 py-16 text-sm text-ink/60" role="status">Loading your profile…</main> : (
          <ProfilePage user={user} onLogout={() => setUser(null)} onUserUpdated={setUser} />
        )
      ) : <HomePage isEditor={isEditor} onEdit={openEditDialog} reloadRef={reloadMenuRef} />}

      <SiteFooter />

      {user && isEditor && <AddItemDialog key={editingItem?.id || 'new'} open={dialogOpen} onClose={closeDialog} onSaved={reloadMenu} user={user} item={editingItem} />}
      {user && <AddProductDialog open={productDialogOpen} onClose={() => setProductDialogOpen(false)} onSaved={reloadMenu} />}
    </div>
  );
}

document.addEventListener('wheel', () => {
  if (document.activeElement?.type === 'number') document.activeElement.blur();
}, { passive: true });

createRoot(document.getElementById('root')).render(<App />);

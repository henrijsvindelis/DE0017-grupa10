import { LeafIcon } from './Icons';

export function SiteHeader({ pathname, user, onAdd }) {
  const addButtonLabel = !user || user.role === 'User' ? 'Add product' : user.role === 'Admin' ? 'Add food item' : 'Add to menu';
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
    <header className="sticky top-0 z-30 border-b border-forest/10 bg-cream/95 backdrop-blur">
      <div className="mx-auto flex min-h-[76px] max-w-7xl items-center justify-between gap-4 px-5 sm:px-8">
        <a className="flex items-center gap-3 text-forest no-underline" href="/" aria-label="Quality Food home">
          <span className="grid size-10 place-items-center rounded-full bg-forest text-sage"><LeafIcon /></span>
          <span className="flex flex-col text-lg font-bold leading-tight">Quality Food<span className="mt-1 text-[9px] font-bold uppercase tracking-[0.18em] text-ink/50">Thoughtful meal prep</span></span>
        </a>
        <nav aria-label="Main navigation" className="flex items-center gap-2 sm:gap-4">
          {pathname === '/' && <>
            <a className="hidden text-sm font-semibold text-ink/70 transition hover:text-terracotta sm:inline" href="#menu">The menu</a>
            <a className="hidden text-sm font-semibold text-ink/70 transition hover:text-terracotta md:inline" href="#approach">Our approach</a>
            <button type="button" onClick={onAdd} className="rounded-xl bg-terracotta px-3 py-2.5 text-xs font-bold text-white transition hover:bg-terracotta-dark sm:px-4 sm:py-2.5 sm:text-sm">
              {addButtonLabel} <span aria-hidden="true">+</span>
            </button>
          </>}
          {user && <a href="/planner" className="rounded-xl bg-yellow-300 px-4 py-3 text-xs font-bold text-forest no-underline transition hover:bg-yellow-200 sm:px-5 sm:text-sm">Meal planner</a>}
          {profileLink}
        </nav>
      </div>
    </header>
  );
}

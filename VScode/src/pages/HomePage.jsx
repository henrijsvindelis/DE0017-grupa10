import { useEffect, useRef, useState } from 'react';
import { ArrowIcon, LeafIcon } from '../components/Icons';
import { MenuGroup } from '../components/MenuGroup';

const initialItems = { recipes: [], foodItems: [] };

// reloadRef ļauj App dialogiem pēc saglabāšanas pārlādēt izvēlni un sagaidīt, kad tas beidzies
export function HomePage({ isEditor, onEdit, reloadRef }) {
  const [items, setItems] = useState(initialItems);
  const [loading, setLoading] = useState(true);
  const [menuError, setMenuError] = useState('');
  const [deletingId, setDeletingId] = useState('');
  const [search, setSearch] = useState('');
  const [vegetarianOnly, setVegetarianOnly] = useState(false);
  const menuFilters = useRef({ q: '', vegetarian: false });
  const menuRequest = useRef(0);
  const filtered = search.trim() !== '' || vegetarianOnly;

  function menuUrl(base) {
    const params = new URLSearchParams(base);
    const { q, vegetarian } = menuFilters.current;
    if (q) params.set('q', q);
    if (vegetarian) params.set('vegetarian', 'true');
    return `/api/food-items?${params}`;
  }

  async function loadMenuItems() {
    setMenuError('');
    // Ja filtrs mainās, kamēr iepriekšējais pieprasījums vēl nav beidzies, vecā atbilde tiek ignorēta
    const requestId = ++menuRequest.current;
    try {
      const [recipesResponse, foodItemsResponse] = await Promise.all([
        fetch(menuUrl('type=recipe&sort=popular&limit=6')),
        fetch(menuUrl('type=food-item&limit=50'))
      ]);
      if (requestId !== menuRequest.current) return;
      const [recipesResult, foodItemsResult] = await Promise.all([
        recipesResponse.json(),
        foodItemsResponse.json()
      ]);
      if (!recipesResponse.ok || !foodItemsResponse.ok) {
        throw new Error(recipesResult.error || foodItemsResult.error || 'Unable to load menu items.');
      }
      setItems({
        recipes: recipesResult.items,
        foodItems: foodItemsResult.items
      });
    } catch (error) {
      if (requestId !== menuRequest.current) return;
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
    loadMenuItems();
  }, []);

  useEffect(() => {
    reloadRef.current = loadMenuItems;
    return () => { reloadRef.current = null; };
  });

  // Meklēšana tiek palaista ar nelielu aizturi, lai nesūtītu pieprasījumu pēc katra burta
  useEffect(() => {
    const q = search.trim();
    if (q === menuFilters.current.q && vegetarianOnly === menuFilters.current.vegetarian) return undefined;
    const timer = setTimeout(() => {
      menuFilters.current = { q, vegetarian: vegetarianOnly };
      loadMenuItems();
    }, q === menuFilters.current.q ? 0 : 300);
    return () => clearTimeout(timer);
  }, [search, vegetarianOnly]);

  return (
    <main id="home">
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
          <div className="mb-12 flex flex-wrap items-center gap-4">
            <label className="min-w-0 flex-1 basis-64">
              <span className="sr-only">Search recipes and food items</span>
              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                maxLength={50}
                placeholder="Search recipes and food items…"
                className="w-full rounded-xl border border-forest/15 bg-white px-4 py-3 text-sm text-ink outline-none transition placeholder:text-ink/40 focus:border-forest focus:ring-4 focus:ring-forest/10"
              />
            </label>
            <label className="flex cursor-pointer items-center gap-2 text-sm font-semibold text-forest">
              <input
                type="checkbox"
                checked={vegetarianOnly}
                onChange={(event) => setVegetarianOnly(event.target.checked)}
                className="size-4 accent-forest"
              />
              Vegetarian only
            </label>
          </div>
          <div className="grid gap-14">
            <MenuGroup title="Popular recipes" items={items.recipes} loading={loading} type="recipe" canDelete={isEditor} canEdit={isEditor} onDelete={deleteMenuItem} onEdit={onEdit} deletingId={deletingId} filtered={filtered} carousel />
            <MenuGroup title="Food items" items={items.foodItems} loading={loading} type="food" canDelete={isEditor} canEdit={isEditor} onDelete={deleteMenuItem} onEdit={onEdit} deletingId={deletingId} filtered={filtered} carousel />
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
    </main>
  );
}

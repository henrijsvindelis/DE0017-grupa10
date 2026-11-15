import { useRef } from 'react';
import { MenuCard } from './MenuCard';

export function MenuGroup({ title, items, loading, type, canDelete, canEdit, onDelete, onEdit, deletingId, filtered = false, carousel = false }) {
  const trackRef = useRef(null);

  function scrollCards(direction) {
    const track = trackRef.current;
    if (track) track.scrollBy({ left: direction * track.clientWidth * 0.9, behavior: 'smooth' });
  }

  const cards = items.map((item) => (
    <MenuCard
      key={item.id}
      item={item}
      canDelete={canDelete}
      canEdit={canEdit}
      onDelete={onDelete}
      onEdit={onEdit}
      deleting={deletingId === item.id}
      className={carousel ? 'w-[85%] shrink-0 snap-start sm:w-[calc(50%-0.5rem)] xl:w-[calc(33.333%-0.67rem)]' : ''}
    />
  ));

  return (
    <section aria-labelledby={`${type}-title`} className="min-w-0">
      <div className="mb-5 flex items-end justify-between gap-4">
        <div>
          <p className="mb-2 text-xs font-bold uppercase tracking-[0.18em] text-terracotta">Made with care</p>
          <h3 id={`${type}-title`} className="font-display text-3xl text-forest">{title}</h3>
        </div>
        <div className="flex items-center gap-3">
          <span className="hidden text-sm text-ink/50 sm:block">{items.length ? `${items.length} on the menu` : 'Fresh ideas welcome'}</span>
          {carousel && items.length > 1 && (
            <>
              <button type="button" onClick={() => scrollCards(-1)} aria-label="Previous" className="grid size-10 place-items-center rounded-full border border-forest/15 bg-white text-lg text-forest transition hover:bg-forest hover:text-white">‹</button>
              <button type="button" onClick={() => scrollCards(1)} aria-label="Next" className="grid size-10 place-items-center rounded-full border border-forest/15 bg-white text-lg text-forest transition hover:bg-forest hover:text-white">›</button>
            </>
          )}
        </div>
      </div>
      {loading ? (
        <p className="rounded-2xl border border-forest/10 bg-white p-6 text-sm text-ink/60" role="status">Loading the menu…</p>
      ) : items.length ? (
        carousel ? (
          <div ref={trackRef} className="-mx-2 flex snap-x snap-mandatory gap-4 overflow-x-auto scroll-smooth px-2 pb-4 pt-1 [scrollbar-width:none]">
            {cards}
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{cards}</div>
        )
      ) : filtered ? (
        <div className="rounded-2xl border border-dashed border-forest/20 bg-white/70 px-6 py-10 text-center">
          <p className="mb-2 font-display text-xl text-forest">No matches</p>
          <p className="mb-0 text-sm text-ink/55">Nothing matches your search. Try another name or clear the filters.</p>
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-forest/20 bg-white/70 px-6 py-10 text-center">
          <p className="mb-2 font-display text-xl text-forest">A place for something delicious</p>
          <p className="mb-0 text-sm text-ink/55">Nothing here yet. {type === 'recipe' ? 'Recipes appear here when people save meal plans or share their own.' : 'Add the first food item to get started.'}</p>
        </div>
      )}
    </section>
  );
}

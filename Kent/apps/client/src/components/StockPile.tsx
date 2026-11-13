/** The face-down stock, drawn as a small stack whose height follows how many cards are left. */
export function StockPile({ count }: { count: number }) {
  const layers = count === 0 ? 0 : Math.min(4, Math.ceil(count / 10));
  return (
    <div className="flex flex-col items-center gap-1">
      <div data-anchor="stock" className="relative h-12 w-9">
        {layers === 0 ? (
          <div className="h-full w-full rounded-md border border-dashed border-cream-100/15" />
        ) : (
          Array.from({ length: layers }, (_, i) => (
            <div
              key={i}
              className="card-back-pattern absolute inset-0 rounded-md border border-gold-400/30"
              style={{ transform: `translate(${-i * 1.5}px, ${-i * 1.5}px)`, boxShadow: "0 2px 4px rgba(0,0,0,0.45)" }}
            />
          ))
        )}
      </div>
      <span className="text-[10px] font-medium tracking-wider text-cream-100/50 uppercase tabular-nums">Stock {count}</span>
    </div>
  );
}

/** Played-out cards, face-down and slightly scattered. */
export function DiscardPile({ count }: { count: number }) {
  const layers = count === 0 ? 0 : Math.min(3, Math.ceil(count / 8));
  const tilt = [-8, 5, -2];
  return (
    <div className="flex flex-col items-center gap-1">
      <div data-anchor="discard" className="relative h-12 w-9">
        {layers === 0 ? (
          <div className="h-full w-full rounded-md border border-dashed border-cream-100/15" />
        ) : (
          Array.from({ length: layers }, (_, i) => (
            <div
              key={i}
              className="card-back-pattern absolute inset-0 rounded-md border border-gold-400/20 brightness-75"
              style={{ transform: `rotate(${tilt[i]}deg)`, boxShadow: "0 2px 4px rgba(0,0,0,0.45)" }}
            />
          ))
        )}
      </div>
      <span className="text-[10px] font-medium tracking-wider text-cream-100/50 uppercase tabular-nums">Discard {count}</span>
    </div>
  );
}

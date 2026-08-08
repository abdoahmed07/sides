export function DiscardPile({ count }: { count: number }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative flex h-14 w-11 items-end justify-center">
        {count === 0 ? (
          <div className="h-12 w-9 rounded-md border border-dashed border-cream-500/20" />
        ) : (
          <div className="h-12 w-9 rounded-md border border-black/40 bg-gradient-to-br from-felt-800 to-felt-950 shadow-card" />
        )}
      </div>
      <span className="text-[10px] uppercase tracking-wide text-cream-500">Discard · {count}</span>
    </div>
  );
}

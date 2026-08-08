export function StockPile({ count }: { count: number }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative flex h-14 w-11 items-end justify-center">
        {count === 0 ? (
          <div className="h-12 w-9 rounded-md border border-dashed border-cream-500/20" />
        ) : (
          <div className="h-12 w-9 rounded-md border border-black/30 bg-gradient-to-br from-felt-600 to-felt-800 shadow-card" />
        )}
      </div>
      <span className="text-[10px] tracking-wide text-cream-500 uppercase">Stock · {count}</span>
    </div>
  );
}

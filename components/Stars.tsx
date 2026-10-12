export function Stars({ rating, size = 16 }: { rating: number; size?: number }) {
  const pct = Math.max(0, Math.min(100, (rating / 5) * 100));
  return (
    <span className="relative inline-block align-middle leading-none" style={{ width: size * 5, height: size }} aria-hidden="true">
      <span className="absolute inset-0 overflow-hidden whitespace-nowrap text-slate-300" style={{ fontSize: size, lineHeight: `${size}px` }}>
        ★★★★★
      </span>
      <span
        className="absolute inset-y-0 left-0 overflow-hidden whitespace-nowrap text-amber-500"
        style={{ width: `${pct}%`, fontSize: size, lineHeight: `${size}px` }}
      >
        ★★★★★
      </span>
    </span>
  );
}

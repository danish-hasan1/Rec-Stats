export function FunnelBar({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className="flex items-center gap-3">
      <span className="w-20 shrink-0 text-sm text-muted-foreground">{label}</span>
      <div className="h-3 flex-1 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${Math.max(pct, value > 0 ? 4 : 0)}%`, background: color }}
        />
      </div>
      <span className="w-10 shrink-0 text-right text-sm font-medium">{value}</span>
    </div>
  );
}

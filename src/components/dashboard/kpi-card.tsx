import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

export function KpiCard({
  label,
  value,
  sub,
  extra,
  icon: Icon,
  accent,
}: {
  label: string;
  value: number | string;
  sub?: string;
  extra?: ReactNode;
  icon: LucideIcon;
  accent?: "primary" | "chart-2" | "chart-3" | "chart-4";
}) {
  return (
    <Card className="glass overflow-hidden">
      <CardContent className="flex items-center justify-between gap-3 py-2">
        <div>
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="text-3xl font-semibold tracking-tight">{value}</p>
          {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
          {extra && <div className="mt-1">{extra}</div>}
        </div>
        <div
          className={cn(
            "flex size-11 shrink-0 items-center justify-center rounded-2xl",
            accent === "chart-2" && "bg-chart-2/15 text-chart-2",
            accent === "chart-3" && "bg-chart-3/15 text-chart-3",
            accent === "chart-4" && "bg-chart-4/15 text-chart-4",
            (!accent || accent === "primary") && "bg-primary/15 text-primary"
          )}
        >
          <Icon className="size-5" />
        </div>
      </CardContent>
    </Card>
  );
}

"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Line,
  LineChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Legend,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { fetchEntries, fetchRoles, fetchSubmitters } from "@/lib/data/queries";
import {
  byMonth,
  conversionRates,
  dealStats,
  monthLabel,
  recruiterMonthlyPerformance,
  trailingMonthKeys,
  type RecruiterMonthRow,
} from "@/lib/data/aggregate";
import type { EntryView, RoleView, Submitter } from "@/types/db";
import { cn } from "@/lib/utils";
import {
  Lock,
  LockKeyholeOpen,
  Users2,
  TrendingUp,
  TrendingDown,
  Minus,
  Trophy,
  AlertTriangle,
  Eye,
} from "lucide-react";

const UNLOCK_KEY = "rec-stats-performance-unlocked";
const PASSWORD = "9977";
const MONTHS_BACK_OPTIONS = [3, 6, 12, 24];
const TREND_THRESHOLD = 12; // % change between early/late half of the window to call it a real trend, not noise
const CHART_COLORS = ["var(--primary)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)"];

type MetricKey = "subs" | "interviews" | "subToL1" | "dealRatio";
const METRIC_OPTIONS: { key: MetricKey; label: string; isPercent: boolean }[] = [
  { key: "subs", label: "Submissions", isPercent: false },
  { key: "interviews", label: "Interviews", isPercent: false },
  { key: "subToL1", label: "Subs → L1 %", isPercent: true },
  { key: "dealRatio", label: "Deal Ratio %", isPercent: true },
];

function metricValue(row: RecruiterMonthRow | undefined, metric: MetricKey): number {
  if (!row) return 0;
  if (metric === "subs") return row.totals.totalSubs;
  if (metric === "interviews") return row.totals.interviews;
  if (metric === "subToL1") return row.rates.subToL1 ?? 0;
  return row.deal.ratio ?? 0;
}

type Trend = { pctChange: number | null; direction: "up" | "down" | "flat" | "unknown" };

// Compares the average of the first half of the window to the average of
// the second half. A single month-to-month delta is noisy (one slow week
// swings it); this gives a steadier read on whether someone's trajectory is
// actually up or down over the selected window.
function splitHalfTrend(series: number[], hasActivity: boolean): Trend {
  if (!hasActivity || series.length < 2) return { pctChange: null, direction: "unknown" };
  const mid = Math.floor(series.length / 2);
  const avg = (arr: number[]) => (arr.length ? arr.reduce((s, v) => s + v, 0) / arr.length : 0);
  const earlyAvg = avg(series.slice(0, mid));
  const recentAvg = avg(series.slice(mid));
  if (earlyAvg === 0 && recentAvg === 0) return { pctChange: 0, direction: "flat" };
  if (earlyAvg === 0) return { pctChange: 100, direction: "up" };
  const pct = ((recentAvg - earlyAvg) / earlyAvg) * 100;
  const direction = pct > TREND_THRESHOLD ? "up" : pct < -TREND_THRESHOLD ? "down" : "flat";
  return { pctChange: pct, direction };
}

function fmtPct(v: number | null) {
  return v === null ? "—" : `${v > 0 ? "+" : ""}${Math.round(v)}%`;
}

function TrendBadge({ trend }: { trend: Trend }) {
  if (trend.direction === "unknown") {
    return <span className="text-xs text-muted-foreground">Not enough data</span>;
  }
  if (trend.direction === "flat") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
        <Minus className="size-3" /> Stable
      </span>
    );
  }
  const up = trend.direction === "up";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
        up ? "bg-chart-2/15 text-chart-2" : "bg-destructive/15 text-destructive"
      )}
    >
      {up ? <TrendingUp className="size-3" /> : <TrendingDown className="size-3" />}
      {up ? "Improving" : "Declining"} {fmtPct(trend.pctChange)}
    </span>
  );
}

function MomDelta({ current, previous }: { current: number; previous: number }) {
  if (previous === 0 && current === 0) return <span className="text-muted-foreground">—</span>;
  if (previous === 0) return <span className="text-chart-2">new</span>;
  const pct = Math.round(((current - previous) / previous) * 100);
  if (pct === 0) return <span className="text-muted-foreground">flat</span>;
  const up = pct > 0;
  return <span className={up ? "text-chart-2" : "text-destructive"}>{up ? "+" : ""}{pct}%</span>;
}

function Sparkline({ values, color = "var(--primary)" }: { values: number[]; color?: string }) {
  const w = 96;
  const h = 28;
  const pad = 2;
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const range = max - min || 1;
  const points = values
    .map((v, i) => {
      const x = values.length > 1 ? (i / (values.length - 1)) * (w - pad * 2) + pad : w / 2;
      const y = h - pad - ((v - min) / range) * (h - pad * 2);
      return `${x},${y}`;
    })
    .join(" ");
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-7 w-24 shrink-0">
      <polyline points={points} fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

type RosterEntry = {
  id: string;
  name: string;
  type: string;
  status: string;
  series: number[];
  subsSeries: number[];
  trend: Trend;
};

function PasswordGate({ onUnlock }: { onUnlock: () => void }) {
  const [value, setValue] = useState("");
  const [wrong, setWrong] = useState(false);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (value === PASSWORD) {
      try {
        sessionStorage.setItem(UNLOCK_KEY, "1");
      } catch {
        // sessionStorage unavailable (private mode etc) — still unlock for this render
      }
      setWrong(false);
      onUnlock();
    } else {
      setWrong(true);
    }
  }

  return (
    <div className="flex flex-1 items-center justify-center py-24">
      <Card className="glass-strong w-full max-w-sm">
        <CardHeader className="items-center text-center">
          <div className="mb-2 flex size-12 items-center justify-center rounded-2xl bg-primary/15 text-primary">
            <Lock className="size-6" />
          </div>
          <CardTitle className="text-lg">Recruiter Performance</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            <Input
              type="password"
              autoFocus
              value={value}
              onChange={(e) => {
                setValue(e.target.value);
                setWrong(false);
              }}
              placeholder="Enter password"
              className={cn(wrong && "border-destructive")}
            />
            {wrong && <p className="text-xs text-destructive">Wrong password.</p>}
            <Button type="submit" className="w-full">
              Unlock
            </Button>
            <p className="text-center text-xs text-muted-foreground">
              This only hides the section from casual viewing in the browser — it&rsquo;s not real
              access control, since the app has no login system underneath.
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

export default function PerformancePage() {
  const [unlocked, setUnlocked] = useState(false);
  const [checkedUnlock, setCheckedUnlock] = useState(false);

  const [entries, setEntries] = useState<EntryView[]>([]);
  const [roles, setRoles] = useState<RoleView[]>([]);
  const [submitters, setSubmitters] = useState<Submitter[]>([]);
  const [loading, setLoading] = useState(true);

  const [monthsBack, setMonthsBack] = useState(6);
  const [metric, setMetric] = useState<MetricKey>("subs");
  const [includeVendors, setIncludeVendors] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [detailId, setDetailId] = useState<string | null>(null);

  useEffect(() => {
    let stored = false;
    try {
      stored = sessionStorage.getItem(UNLOCK_KEY) === "1";
    } catch {
      stored = false;
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect -- client-only sessionStorage read, avoids SSR hydration mismatch
    setUnlocked(stored);
    setCheckedUnlock(true);
  }, []);

  useEffect(() => {
    if (!unlocked) return;
    Promise.all([fetchEntries("2000-01-01", "2100-01-01"), fetchRoles(), fetchSubmitters()])
      .then(([e, r, s]) => {
        setEntries(e);
        setRoles(r);
        setSubmitters(s);
      })
      .catch((err) => {
        toast.error("Failed to load data. Is local Supabase running?");
        console.error(err);
      })
      .finally(() => setLoading(false));
  }, [unlocked]);

  const months = useMemo(() => trailingMonthKeys(monthsBack, new Date()), [monthsBack]);
  const monthLabels = useMemo(() => months.map((m) => monthLabel(m)), [months]);
  const monthShortLabels = useMemo(
    () => months.map((m) => monthLabel(m).replace(/^(\w{3})\w* /, "$1 ")),
    [months]
  );

  const perfBySubmitter = useMemo(() => {
    const perf = recruiterMonthlyPerformance(entries, roles);
    const map = new Map<string, Map<string, RecruiterMonthRow>>();
    for (const row of perf) {
      const inner = map.get(row.submitterId) ?? new Map<string, RecruiterMonthRow>();
      inner.set(row.monthKey, row);
      map.set(row.submitterId, inner);
    }
    return map;
  }, [entries, roles]);

  const roster: RosterEntry[] = useMemo(() => {
    return submitters
      .filter((s) => s.type === "recruiter" || (includeVendors && s.type === "vendor"))
      .map((s) => {
        const monthly = perfBySubmitter.get(s.id);
        const series = months.map((m) => metricValue(monthly?.get(m), metric));
        const subsSeries = months.map((m) => monthly?.get(m)?.totals.totalSubs ?? 0);
        const hasActivity = subsSeries.some((v) => v > 0);
        return {
          id: s.id,
          name: s.name,
          type: s.type,
          status: s.status,
          series,
          subsSeries,
          trend: splitHalfTrend(series, hasActivity),
        };
      })
      .filter((r) => r.subsSeries.some((v) => v > 0));
  }, [submitters, perfBySubmitter, months, metric, includeVendors]);

  const rankedRoster = useMemo(
    () => [...roster].sort((a, b) => b.series[b.series.length - 1] - a.series[a.series.length - 1]),
    [roster]
  );

  const topFiveIds = useMemo(
    () =>
      [...roster]
        .sort((a, b) => b.subsSeries.reduce((s, v) => s + v, 0) - a.subsSeries.reduce((s, v) => s + v, 0))
        .slice(0, 5)
        .map((r) => r.id),
    [roster]
  );
  const effectiveSelectedIds = useMemo(
    () => (selectedIds.size > 0 ? selectedIds : new Set(topFiveIds)),
    [selectedIds, topFiveIds]
  );

  const rosterIds = useMemo(() => new Set(roster.map((r) => r.id)), [roster]);
  const teamMonthly = useMemo(() => {
    const rosterEntries = entries.filter((e) => rosterIds.has(e.submitter_id));
    return new Map(byMonth(rosterEntries).map((p) => [p.key, p]));
  }, [entries, rosterIds]);
  const teamSeries = useMemo(
    () =>
      months.map((m) => {
        const period = teamMonthly.get(m);
        if (!period) return 0;
        if (metric === "subs") return period.totals.totalSubs;
        if (metric === "interviews") return period.totals.interviews;
        if (metric === "subToL1") return conversionRates(period.totals).subToL1 ?? 0;
        return dealStats(period.entries, roles).ratio ?? 0;
      }),
    [months, teamMonthly, metric, roles]
  );

  const withTrend = useMemo(() => roster.filter((r) => r.trend.direction !== "unknown"), [roster]);
  const mostImproved = withTrend.length
    ? [...withTrend].sort((a, b) => (b.trend.pctChange ?? 0) - (a.trend.pctChange ?? 0))[0]
    : null;
  const mostDeclined = withTrend.length
    ? [...withTrend].sort((a, b) => (a.trend.pctChange ?? 0) - (b.trend.pctChange ?? 0))[0]
    : null;

  const metricOption = METRIC_OPTIONS.find((m) => m.key === metric)!;
  const maxCellValue = Math.max(1, ...roster.flatMap((r) => r.series));
  function cellIntensity(v: number) {
    if (metricOption.isPercent) return Math.min(100, Math.max(0, v));
    return maxCellValue > 0 ? Math.min(100, (v / maxCellValue) * 100) : 0;
  }
  function cellLabel(v: number) {
    return metricOption.isPercent ? `${Math.round(v)}%` : `${Math.round(v)}`;
  }

  const comparisonChartData = useMemo(
    () =>
      months.map((m, i) => {
        const point: Record<string, string | number> = { month: monthShortLabels[i] };
        for (const r of roster) {
          if (effectiveSelectedIds.has(r.id)) point[r.name] = r.series[i];
        }
        return point;
      }),
    [months, monthShortLabels, roster, effectiveSelectedIds]
  );

  const teamChartData = useMemo(
    () => months.map((m, i) => ({ month: monthShortLabels[i], value: teamSeries[i] })),
    [months, monthShortLabels, teamSeries]
  );

  function toggleSelected(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev.size > 0 ? prev : topFiveIds);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const detail = detailId ? roster.find((r) => r.id === detailId) : null;
  const detailChartData = detail
    ? months.map((m, i) => ({ month: monthShortLabels[i], value: detail.series[i] }))
    : [];

  if (!checkedUnlock) return null;

  if (!unlocked) {
    return <PasswordGate onUnlock={() => setUnlocked(true)} />;
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Recruiter Performance</h1>
          <p className="text-sm text-muted-foreground">
            Month-on-month trajectory — who&rsquo;s improving, who&rsquo;s stable, who&rsquo;s slipping.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            try {
              sessionStorage.removeItem(UNLOCK_KEY);
            } catch {
              // ignore
            }
            setUnlocked(false);
          }}
        >
          <LockKeyholeOpen className="mr-1 size-4" /> Lock
        </Button>
      </div>

      <Card className="glass">
        <CardHeader>
          <CardTitle className="text-lg">Controls</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="flex flex-col gap-1.5">
              <Label>Window</Label>
              <Select value={String(monthsBack)} onValueChange={(v) => setMonthsBack(Number(v))}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MONTHS_BACK_OPTIONS.map((n) => (
                    <SelectItem key={n} value={String(n)}>
                      Last {n} months
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Metric</Label>
              <Select value={metric} onValueChange={(v) => setMetric(v as MetricKey)}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {METRIC_OPTIONS.map((m) => (
                    <SelectItem key={m.key} value={m.key}>
                      {m.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end pb-1.5">
              <label className="flex items-center gap-2 text-sm text-muted-foreground">
                <Checkbox checked={includeVendors} onCheckedChange={(v) => setIncludeVendors(v === true)} />
                Include vendors
              </label>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard label="Recruiters tracked" value={loading ? "…" : roster.length} icon={Users2} accent="primary" />
        <KpiCard
          label={`Team ${metricOption.label} — this month`}
          value={loading ? "…" : metricOption.isPercent ? `${Math.round(teamSeries[teamSeries.length - 1] ?? 0)}%` : teamSeries[teamSeries.length - 1] ?? 0}
          sub={
            teamSeries.length > 1
              ? undefined
              : "Not enough months in window"
          }
          extra={
            teamSeries.length > 1 && !loading ? (
              <MomDelta current={teamSeries[teamSeries.length - 1]} previous={teamSeries[teamSeries.length - 2]} />
            ) : undefined
          }
          icon={TrendingUp}
          accent="chart-2"
        />
        <KpiCard
          label="Most improved"
          value={loading ? "…" : mostImproved ? mostImproved.name : "—"}
          sub={mostImproved ? fmtPct(mostImproved.trend.pctChange) : "No clear trend yet"}
          icon={Trophy}
          accent="chart-3"
          onClick={mostImproved ? () => setDetailId(mostImproved.id) : undefined}
        />
        <KpiCard
          label="Most declined"
          value={loading ? "…" : mostDeclined && mostDeclined.trend.direction === "down" ? mostDeclined.name : "—"}
          sub={mostDeclined && mostDeclined.trend.direction === "down" ? fmtPct(mostDeclined.trend.pctChange) : "Nobody trending down"}
          icon={AlertTriangle}
          accent="chart-4"
          onClick={mostDeclined && mostDeclined.trend.direction === "down" ? () => setDetailId(mostDeclined.id) : undefined}
        />
      </div>

      <Card className="glass">
        <CardHeader>
          <CardTitle className="text-lg">Team trend — {metricOption.label}</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : (
            <div className="h-56 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={teamChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="month" tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} />
                  <YAxis tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 12, fontSize: 12 }}
                  />
                  <Line type="monotone" dataKey="value" name={metricOption.label} stroke="var(--primary)" strokeWidth={2} dot={{ r: 3 }} isAnimationActive={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="glass">
        <CardHeader>
          <CardTitle className="text-lg">Recruiter comparison — {metricOption.label}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : roster.length === 0 ? (
            <p className="text-sm text-muted-foreground">No activity in this window.</p>
          ) : (
            <>
              <div className="flex flex-wrap gap-1.5">
                {rankedRoster.map((r) => {
                  const active = effectiveSelectedIds.has(r.id);
                  return (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => toggleSelected(r.id)}
                      className={cn(
                        "rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
                        active ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:bg-accent"
                      )}
                    >
                      {r.name}
                    </button>
                  );
                })}
              </div>
              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={comparisonChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="month" tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} />
                    <YAxis tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} allowDecimals={false} />
                    <Tooltip
                      contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 12, fontSize: 12 }}
                    />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    {rankedRoster
                      .filter((r) => effectiveSelectedIds.has(r.id))
                      .map((r, i) => (
                        <Line
                          key={r.id}
                          type="monotone"
                          dataKey={r.name}
                          stroke={CHART_COLORS[i % CHART_COLORS.length]}
                          strokeWidth={2}
                          dot={{ r: 2.5 }}
                          isAnimationActive={false}
                        />
                      ))}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Card className="glass">
        <CardHeader>
          <CardTitle className="text-lg">Matrix — {metricOption.label} by month</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : roster.length === 0 ? (
            <p className="text-sm text-muted-foreground">No activity in this window.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-separate border-spacing-1 text-sm">
                <thead>
                  <tr>
                    <th className="sticky left-0 bg-card px-2 py-1 text-left text-xs font-medium text-muted-foreground">
                      Recruiter
                    </th>
                    {monthShortLabels.map((label) => (
                      <th key={label} className="px-2 py-1 text-center text-xs font-medium text-muted-foreground">
                        {label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rankedRoster.map((r) => (
                    <tr key={r.id}>
                      <td className="sticky left-0 whitespace-nowrap bg-card px-2 py-1 font-medium">{r.name}</td>
                      {r.series.map((v, i) => (
                        <td
                          key={i}
                          className="min-w-14 rounded-md px-2 py-1 text-center text-xs font-medium"
                          style={{ background: `color-mix(in oklch, var(--primary) ${cellIntensity(v)}%, transparent)` }}
                          title={`${r.name} — ${monthLabels[i]}: ${cellLabel(v)}`}
                        >
                          {cellLabel(v)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="glass">
        <CardHeader>
          <CardTitle className="text-lg">Scorecard</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : roster.length === 0 ? (
            <p className="text-sm text-muted-foreground">No activity in this window.</p>
          ) : (
            <div className="max-h-[32rem] overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead className="text-right">This month</TableHead>
                    <TableHead className="text-right">Last month</TableHead>
                    <TableHead className="text-right">MoM</TableHead>
                    <TableHead>Trend ({monthsBack}mo)</TableHead>
                    <TableHead>Sparkline</TableHead>
                    <TableHead className="w-16" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rankedRoster.map((r) => {
                    const cur = r.series[r.series.length - 1] ?? 0;
                    const prev = r.series[r.series.length - 2] ?? 0;
                    return (
                      <TableRow key={r.id}>
                        <TableCell className="font-medium">{r.name}</TableCell>
                        <TableCell className="capitalize text-muted-foreground">{r.type}</TableCell>
                        <TableCell className="text-right">{cellLabel(cur)}</TableCell>
                        <TableCell className="text-right text-muted-foreground">
                          {r.series.length > 1 ? cellLabel(prev) : "—"}
                        </TableCell>
                        <TableCell className="text-right">
                          {r.series.length > 1 ? <MomDelta current={cur} previous={prev} /> : <span className="text-muted-foreground">—</span>}
                        </TableCell>
                        <TableCell>
                          <TrendBadge trend={r.trend} />
                        </TableCell>
                        <TableCell>
                          <Sparkline
                            values={r.series}
                            color={r.trend.direction === "up" ? "var(--chart-2)" : r.trend.direction === "down" ? "var(--destructive)" : "var(--muted-foreground)"}
                          />
                        </TableCell>
                        <TableCell>
                          <Button variant="ghost" size="icon" onClick={() => setDetailId(r.id)} aria-label={`View ${r.name} details`}>
                            <Eye className="size-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={detail !== null} onOpenChange={(open) => !open && setDetailId(null)}>
        <DialogContent className="glass-strong flex max-h-[92vh] w-[95vw] max-w-2xl flex-col overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{detail?.name}</DialogTitle>
            <DialogDescription>
              {metricOption.label} — last {monthsBack} months
            </DialogDescription>
          </DialogHeader>
          {detail && (
            <div className="flex flex-col gap-4">
              <div className="h-56 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={detailChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="month" tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} />
                    <YAxis tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} allowDecimals={false} />
                    <Tooltip
                      contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 12, fontSize: 12 }}
                    />
                    <Line type="monotone" dataKey="value" name={metricOption.label} stroke="var(--primary)" strokeWidth={2} dot={{ r: 3 }} isAnimationActive={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Month</TableHead>
                    <TableHead className="text-right">Subs</TableHead>
                    <TableHead className="text-right">Interviews</TableHead>
                    <TableHead className="text-right">Subs → L1</TableHead>
                    <TableHead className="text-right">Deal Ratio</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {months.map((m, i) => {
                    const row = perfBySubmitter.get(detail.id)?.get(m);
                    return (
                      <TableRow key={m}>
                        <TableCell>{monthLabels[i]}</TableCell>
                        <TableCell className="text-right">{row?.totals.totalSubs ?? 0}</TableCell>
                        <TableCell className="text-right">{row?.totals.interviews ?? 0}</TableCell>
                        <TableCell className="text-right">{row?.rates.subToL1 !== undefined && row?.rates.subToL1 !== null ? `${Math.round(row.rates.subToL1)}%` : "—"}</TableCell>
                        <TableCell className="text-right">{row?.deal.ratio !== undefined && row?.deal.ratio !== null ? `${Math.round(row.deal.ratio)}%` : "—"}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

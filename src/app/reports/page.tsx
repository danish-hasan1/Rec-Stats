"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { fetchEntries, fetchRoles } from "@/lib/data/queries";
import { downloadReport, downloadReportCsv, type ReportRow } from "@/lib/data/report";
import {
  downloadSummaryReport,
  downloadSummaryReportCsv,
  type SummaryReportRow,
} from "@/lib/data/summary-report";
import {
  byMonth,
  byWeek,
  conversionRates,
  dealStats,
  groupByRoleWithEntries,
  groupBySubmitterWithEntries,
  periodDealStats,
  startOfMonth,
  sumEntries,
  toISODate,
  unaccountedDeals,
} from "@/lib/data/aggregate";
import { ROLE_STATUSES, roleStatusVariant } from "@/lib/data/role-status";
import type { EntryView, RoleView, RoleStatus, SubmitterType } from "@/types/db";
import {
  Download,
  FileSpreadsheet,
  FileText,
  Handshake,
  Save,
  Trash2,
  Users2,
} from "lucide-react";
import { cn } from "@/lib/utils";

const PRESETS_KEY = "rec-stats-report-presets";

type Preset = {
  name: string;
  from: string;
  to: string;
  sourceFilter: "all" | SubmitterType;
  search: string;
  statusFilter: RoleStatus[];
};

function loadPresets(): Preset[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(PRESETS_KEY);
    return raw ? (JSON.parse(raw) as Preset[]) : [];
  } catch {
    return [];
  }
}

function savePresets(presets: Preset[]) {
  window.localStorage.setItem(PRESETS_KEY, JSON.stringify(presets));
}

function pctLabel(v: number | null) {
  return v === null ? "—" : `${Math.round(v)}%`;
}

function SummaryTable({ rows, labelHeader, sublabelHeader }: { rows: SummaryReportRow[]; labelHeader: string; sublabelHeader?: string }) {
  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground">No entries match these filters.</p>;
  }
  return (
    <div className="max-h-96 overflow-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{labelHeader}</TableHead>
            {sublabelHeader && <TableHead>{sublabelHeader}</TableHead>}
            <TableHead className="text-right">Subs</TableHead>
            <TableHead className="text-right">L1</TableHead>
            <TableHead className="text-right">L2</TableHead>
            <TableHead className="text-right">L3</TableHead>
            <TableHead className="text-right">Subs → L1</TableHead>
            <TableHead className="text-right">L1 → L2</TableHead>
            <TableHead className="text-right">L2 → L3</TableHead>
            <TableHead className="text-right">Subs → L2</TableHead>
            <TableHead className="text-right">Deals</TableHead>
            <TableHead className="text-right">Deal Ratio</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r, i) => (
            <TableRow key={`${r.label}-${i}`}>
              <TableCell className="font-medium">{r.label}</TableCell>
              {sublabelHeader && <TableCell className="capitalize text-muted-foreground">{r.sublabel}</TableCell>}
              <TableCell className="text-right">{r.totals.totalSubs}</TableCell>
              <TableCell className="text-right">{r.totals.interviewL1 || "—"}</TableCell>
              <TableCell className="text-right">{r.totals.interviewL2 || "—"}</TableCell>
              <TableCell className="text-right">{r.totals.interviewL3 || "—"}</TableCell>
              <TableCell className="text-right">{pctLabel(r.rates.subToL1)}</TableCell>
              <TableCell className="text-right">{pctLabel(r.rates.l1ToL2)}</TableCell>
              <TableCell className="text-right">{pctLabel(r.rates.l2ToL3)}</TableCell>
              <TableCell className="text-right font-semibold">{pctLabel(r.rates.subToL2)}</TableCell>
              <TableCell className="text-right">{r.deal.deals || "—"}</TableCell>
              <TableCell className="text-right">{pctLabel(r.deal.ratio)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function DownloadRow({
  reportKey,
  loading,
  downloading,
  onDownload,
}: {
  reportKey: string;
  loading: boolean;
  downloading: string | null;
  onDownload: (format: "xlsx" | "csv") => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      <Button
        size="sm"
        variant="outline"
        disabled={loading || downloading === `${reportKey}-xlsx`}
        onClick={() => onDownload("xlsx")}
      >
        <FileSpreadsheet className="mr-1 size-4" />
        {downloading === `${reportKey}-xlsx` ? "Generating…" : "Excel"}
      </Button>
      <Button size="sm" variant="outline" disabled={loading} onClick={() => onDownload("csv")}>
        <Download className="mr-1 size-4" />
        CSV
      </Button>
    </div>
  );
}

export default function ReportsPage() {
  const [entries, setEntries] = useState<EntryView[]>([]);
  const [roles, setRoles] = useState<RoleView[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState<string | null>(null);

  const today = useMemo(() => new Date(), []);
  const [from, setFrom] = useState(toISODate(startOfMonth(today)));
  const [to, setTo] = useState(toISODate(today));
  const [sourceFilter, setSourceFilter] = useState<"all" | SubmitterType>("all");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<Set<RoleStatus>>(new Set(ROLE_STATUSES));

  // Starts empty so server and client render the same markup on first paint;
  // loaded from localStorage in an effect below (client-only, post-hydration).
  const [presets, setPresets] = useState<Preset[]>([]);
  const [presetName, setPresetName] = useState("");
  const [selectedPreset, setSelectedPreset] = useState<string>("");

  useEffect(() => {
    Promise.all([fetchEntries("2000-01-01", "2100-01-01"), fetchRoles()])
      .then(([e, r]) => {
        setEntries(e);
        setRoles(r);
      })
      .catch((err) => {
        toast.error("Failed to load data. Is local Supabase running?");
        console.error(err);
      })
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/set-state-in-effect -- client-only localStorage read, avoids SSR hydration mismatch
    setPresets(loadPresets());
  }, []);

  const roleStatusById = useMemo(() => new Map(roles.map((r) => [r.id, r.status])), [roles]);

  const filteredEntries: EntryView[] = useMemo(() => {
    const q = search.trim().toLowerCase();
    return entries
      .filter((e) => e.date >= from && e.date <= to)
      .filter((e) => sourceFilter === "all" || e.submitter_type === sourceFilter)
      .filter((e) => statusFilter.has(roleStatusById.get(e.role_id) ?? "open"))
      .filter(
        (e) =>
          !q ||
          e.submitter_name.toLowerCase().includes(q) ||
          e.role_name.toLowerCase().includes(q)
      );
  }, [entries, from, to, sourceFilter, search, statusFilter, roleStatusById]);

  const rawRows: ReportRow[] = useMemo(
    () =>
      filteredEntries
        .map((e) => ({ ...e, role_status: roleStatusById.get(e.role_id) ?? "open" }))
        .sort((a, b) => b.date.localeCompare(a.date)),
    [filteredEntries, roleStatusById]
  );

  const summary = useMemo(() => {
    const totalSubs = filteredEntries.reduce((s, r) => s + r.submissions, 0);
    const totalInterviews = filteredEntries.reduce(
      (s, r) => s + r.interview_l1 + r.interview_l2 + r.interview_l3,
      0
    );
    const uniqueRoles = new Set(filteredEntries.map((r) => r.role_id)).size;
    const uniquePeople = new Set(filteredEntries.map((r) => r.submitter_id)).size;
    return { totalSubs, totalInterviews, uniqueRoles, uniquePeople };
  }, [filteredEntries]);

  // Deal roles with zero entries ever (e.g. a placement tracked purely via
  // role status in Admin, never logged through Daily Entry) can't appear in
  // any of the groupings below since those are all built from entries. Merge
  // them back in — but only the ones still matching the current filters
  // (role status must include "deal"; source/search still apply). They have
  // no date of their own, so they're not filtered by the date range.
  const unaccountedFiltered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return unaccountedDeals(roles, entries).filter((d) => {
      if (!statusFilter.has("deal")) return false;
      if (sourceFilter !== "all" && d.closedByType !== sourceFilter) return false;
      if (q && !d.roleName.toLowerCase().includes(q) && !(d.closedByName ?? "").toLowerCase().includes(q)) return false;
      return true;
    });
  }, [roles, entries, statusFilter, sourceFilter, search]);

  const weeklyPeriods = useMemo(() => byWeek(filteredEntries), [filteredEntries]);
  const weeklyDeals = useMemo(() => periodDealStats(weeklyPeriods, roles), [weeklyPeriods, roles]);
  const weeklyRows: SummaryReportRow[] = useMemo(
    () =>
      weeklyPeriods.map((w, i) => ({
        label: w.label,
        totals: w.totals,
        rates: conversionRates(w.totals),
        deal: weeklyDeals[i],
      })),
    [weeklyPeriods, weeklyDeals]
  );

  const monthlyPeriods = useMemo(() => byMonth(filteredEntries), [filteredEntries]);
  const monthlyDeals = useMemo(() => periodDealStats(monthlyPeriods, roles), [monthlyPeriods, roles]);
  const monthlyRows: SummaryReportRow[] = useMemo(
    () =>
      monthlyPeriods.map((m, i) => ({
        label: m.label,
        totals: m.totals,
        rates: conversionRates(m.totals),
        deal: monthlyDeals[i],
      })),
    [monthlyPeriods, monthlyDeals]
  );

  const roleRows: SummaryReportRow[] = useMemo(() => {
    const map = new Map<string, SummaryReportRow>();
    for (const g of groupByRoleWithEntries(filteredEntries)) {
      map.set(g.id, {
        label: g.name,
        sublabel: roleStatusById.get(g.id) ?? "open",
        totals: g.totals,
        rates: conversionRates(g.totals),
        deal: dealStats(g.entries, roles),
      });
    }
    for (const d of unaccountedFiltered) {
      if (map.has(d.roleId)) continue;
      map.set(d.roleId, {
        label: d.roleName,
        sublabel: "deal",
        totals: sumEntries([]),
        rates: conversionRates(sumEntries([])),
        deal: { roles: 1, deals: 1, ratio: 100 },
      });
    }
    return [...map.values()].sort((a, b) => b.totals.totalSubs - a.totals.totalSubs);
  }, [filteredEntries, roles, roleStatusById, unaccountedFiltered]);

  const recruiterRows: SummaryReportRow[] = useMemo(() => {
    const map = new Map<string, SummaryReportRow>();
    for (const g of groupBySubmitterWithEntries(filteredEntries)) {
      map.set(g.id, {
        label: g.name,
        sublabel: g.type,
        totals: g.totals,
        rates: conversionRates(g.totals),
        deal: dealStats(g.entries, roles, g.id),
      });
    }
    for (const d of unaccountedFiltered) {
      if (!d.closedById) continue;
      const existing = map.get(d.closedById);
      if (existing) {
        const roles2 = existing.deal.roles + 1;
        const deals2 = existing.deal.deals + 1;
        existing.deal = { roles: roles2, deals: deals2, ratio: (deals2 / roles2) * 100 };
      } else {
        map.set(d.closedById, {
          label: d.closedByName ?? "Unknown",
          sublabel: d.closedByType ?? "recruiter",
          totals: sumEntries([]),
          rates: conversionRates(sumEntries([])),
          deal: { roles: 1, deals: 1, ratio: 100 },
        });
      }
    }
    return [...map.values()].sort((a, b) => b.totals.totalSubs - a.totals.totalSubs);
  }, [filteredEntries, roles, unaccountedFiltered]);

  function toggleStatus(status: RoleStatus) {
    setStatusFilter((prev) => {
      const next = new Set(prev);
      if (next.has(status)) next.delete(status);
      else next.add(status);
      return next;
    });
  }

  function handleSavePreset() {
    const name = presetName.trim();
    if (!name) {
      toast.error("Name the preset first.");
      return;
    }
    const preset: Preset = { name, from, to, sourceFilter, search, statusFilter: [...statusFilter] };
    const next = [...presets.filter((p) => p.name !== name), preset];
    setPresets(next);
    savePresets(next);
    setSelectedPreset(name);
    setPresetName("");
    toast.success(`Saved preset "${name}"`);
  }

  function handleLoadPreset(name: string) {
    setSelectedPreset(name);
    const preset = presets.find((p) => p.name === name);
    if (!preset) return;
    setFrom(preset.from);
    setTo(preset.to);
    setSourceFilter(preset.sourceFilter);
    setSearch(preset.search);
    setStatusFilter(new Set(preset.statusFilter));
  }

  function handleDeletePreset(name: string) {
    const next = presets.filter((p) => p.name !== name);
    setPresets(next);
    savePresets(next);
    if (selectedPreset === name) setSelectedPreset("");
    toast.success(`Deleted preset "${name}"`);
  }

  function filterLine() {
    const parts = [`${from} to ${to}`, `Source: ${sourceFilter === "all" ? "All" : sourceFilter}`];
    if (statusFilter.size !== ROLE_STATUSES.length) {
      parts.push(`Status: ${[...statusFilter].join(", ") || "none"}`);
    }
    if (search.trim()) parts.push(`Search: "${search.trim()}"`);
    return parts.join(" · ");
  }

  async function handleDownloadRawExcel() {
    if (rawRows.length === 0) {
      toast.error("No rows match these filters.");
      return;
    }
    setDownloading("raw-xlsx");
    try {
      await downloadReport(rawRows, `Report ${from} to ${to}`, `rec-stats-report_${from}_to_${to}.xlsx`);
      toast.success(`Downloaded ${rawRows.length} rows (Excel)`);
    } catch (err) {
      toast.error("Report generation failed");
      console.error(err);
    } finally {
      setDownloading(null);
    }
  }

  function handleDownloadRawCsv() {
    if (rawRows.length === 0) {
      toast.error("No rows match these filters.");
      return;
    }
    downloadReportCsv(rawRows, `rec-stats-report_${from}_to_${to}.csv`);
    toast.success(`Downloaded ${rawRows.length} rows (CSV)`);
  }

  async function handleDownloadSummary(
    reportKey: string,
    reportTitle: string,
    labelHeader: string,
    sublabelHeader: string | undefined,
    rows: SummaryReportRow[],
    filenameBase: string,
    format: "xlsx" | "csv"
  ) {
    if (rows.length === 0) {
      toast.error("No rows match these filters.");
      return;
    }
    const input = { reportTitle, labelHeader, sublabelHeader, filterLine: filterLine(), rows };
    if (format === "csv") {
      downloadSummaryReportCsv(input, `${filenameBase}_${from}_to_${to}.csv`);
      toast.success(`Downloaded ${reportTitle} (CSV)`);
      return;
    }
    setDownloading(`${reportKey}-xlsx`);
    try {
      await downloadSummaryReport(input, `${filenameBase}_${from}_to_${to}.xlsx`);
      toast.success(`Downloaded ${reportTitle} (Excel)`);
    } catch (err) {
      toast.error("Report generation failed");
      console.error(err);
    } finally {
      setDownloading(null);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Reports</h1>
        <p className="text-sm text-muted-foreground">
          Weekly, monthly, per-role, and per-recruiter summaries — plus the raw entry log — all built from the filters below.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard label="Submissions" value={loading ? "…" : summary.totalSubs} icon={FileText} accent="primary" />
        <KpiCard label="Interviews" value={loading ? "…" : summary.totalInterviews} icon={Handshake} accent="chart-2" />
        <KpiCard label="Roles covered" value={loading ? "…" : summary.uniqueRoles} icon={Users2} accent="chart-3" />
        <KpiCard label="People involved" value={loading ? "…" : summary.uniquePeople} icon={Users2} accent="chart-4" />
      </div>

      <Card className="glass">
        <CardHeader>
          <CardTitle className="text-lg">Filters</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="flex flex-col gap-1.5">
              <Label>From</Label>
              <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>To</Label>
              <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Source</Label>
              <div className="flex gap-1 rounded-md border p-1">
                {(["all", "recruiter", "vendor"] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setSourceFilter(t)}
                    className={cn(
                      "flex-1 rounded px-3 py-1.5 text-sm capitalize transition-colors",
                      sourceFilter === t ? "bg-primary text-primary-foreground" : "hover:bg-accent"
                    )}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Search (name or role) — applies to all tabs</Label>
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="e.g. Dinesh, Python…" />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>Role status</Label>
            <div className="flex flex-wrap gap-4">
              {ROLE_STATUSES.map((status) => (
                <label key={status} className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Checkbox checked={statusFilter.has(status)} onCheckedChange={() => toggleStatus(status)} />
                  {status.replace("_", " ")}
                </label>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap items-end gap-2 border-t pt-4">
            <div className="flex flex-col gap-1.5">
              <Label>Saved presets</Label>
              <div className="flex items-center gap-1">
                <Select value={selectedPreset} onValueChange={handleLoadPreset}>
                  <SelectTrigger size="sm" className="w-48">
                    <SelectValue placeholder={presets.length ? "Load a preset…" : "No presets yet"} />
                  </SelectTrigger>
                  <SelectContent>
                    {presets.map((p) => (
                      <SelectItem key={p.name} value={p.name}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {selectedPreset && (
                  <Button variant="ghost" size="icon" onClick={() => handleDeletePreset(selectedPreset)} aria-label="Delete preset">
                    <Trash2 className="size-4" />
                  </Button>
                )}
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Save current filters as…</Label>
              <div className="flex items-center gap-1">
                <Input
                  value={presetName}
                  onChange={(e) => setPresetName(e.target.value)}
                  placeholder="e.g. Weekly team report"
                  className="w-56"
                />
                <Button variant="outline" size="icon" onClick={handleSavePreset} aria-label="Save preset">
                  <Save className="size-4" />
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="weekly">
        <TabsList className="glass w-fit">
          <TabsTrigger value="weekly">Weekly</TabsTrigger>
          <TabsTrigger value="monthly">Monthly</TabsTrigger>
          <TabsTrigger value="role">By Role</TabsTrigger>
          <TabsTrigger value="recruiter">By Recruiter</TabsTrigger>
          <TabsTrigger value="raw">Raw Log</TabsTrigger>
        </TabsList>

        <TabsContent value="weekly">
          <Card className="glass mt-4">
            <CardHeader className="flex flex-row items-center justify-between gap-4">
              <CardTitle className="text-lg">Weekly summary</CardTitle>
              <DownloadRow
                reportKey="weekly"
                loading={loading}
                downloading={downloading}
                onDownload={(format) =>
                  handleDownloadSummary("weekly", "Weekly Summary", "Week", undefined, weeklyRows, "rec-stats-weekly", format)
                }
              />
            </CardHeader>
            <CardContent>
              {loading ? <p className="text-sm text-muted-foreground">Loading…</p> : <SummaryTable rows={weeklyRows} labelHeader="Week" />}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="monthly">
          <Card className="glass mt-4">
            <CardHeader className="flex flex-row items-center justify-between gap-4">
              <CardTitle className="text-lg">Monthly summary</CardTitle>
              <DownloadRow
                reportKey="monthly"
                loading={loading}
                downloading={downloading}
                onDownload={(format) =>
                  handleDownloadSummary("monthly", "Monthly Summary", "Month", undefined, monthlyRows, "rec-stats-monthly", format)
                }
              />
            </CardHeader>
            <CardContent>
              {loading ? <p className="text-sm text-muted-foreground">Loading…</p> : <SummaryTable rows={monthlyRows} labelHeader="Month" />}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="role">
          <Card className="glass mt-4">
            <CardHeader className="flex flex-row items-center justify-between gap-4">
              <CardTitle className="text-lg">By role</CardTitle>
              <DownloadRow
                reportKey="role"
                loading={loading}
                downloading={downloading}
                onDownload={(format) =>
                  handleDownloadSummary("role", "Role Summary", "Role", "Status", roleRows, "rec-stats-by-role", format)
                }
              />
            </CardHeader>
            <CardContent>
              {loading ? (
                <p className="text-sm text-muted-foreground">Loading…</p>
              ) : (
                <SummaryTable rows={roleRows} labelHeader="Role" sublabelHeader="Status" />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="recruiter">
          <Card className="glass mt-4">
            <CardHeader className="flex flex-row items-center justify-between gap-4">
              <CardTitle className="text-lg">By recruiter</CardTitle>
              <DownloadRow
                reportKey="recruiter"
                loading={loading}
                downloading={downloading}
                onDownload={(format) =>
                  handleDownloadSummary("recruiter", "Recruiter Summary", "Name", "Type", recruiterRows, "rec-stats-by-recruiter", format)
                }
              />
            </CardHeader>
            <CardContent>
              {loading ? (
                <p className="text-sm text-muted-foreground">Loading…</p>
              ) : (
                <SummaryTable rows={recruiterRows} labelHeader="Name" sublabelHeader="Type" />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="raw">
          <Card className="glass mt-4">
            <CardHeader className="flex flex-row items-center justify-between gap-4">
              <CardTitle className="text-lg">Raw entry log ({rawRows.length} rows)</CardTitle>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" onClick={handleDownloadRawExcel} disabled={downloading === "raw-xlsx" || loading}>
                  <FileSpreadsheet className="mr-1 size-4" />
                  {downloading === "raw-xlsx" ? "Generating…" : "Excel"}
                </Button>
                <Button size="sm" onClick={handleDownloadRawCsv} disabled={loading} variant="outline">
                  <Download className="mr-1 size-4" />
                  CSV
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <p className="text-sm text-muted-foreground">Loading…</p>
              ) : rawRows.length === 0 ? (
                <p className="text-sm text-muted-foreground">No entries match these filters.</p>
              ) : (
                <div className="max-h-96 overflow-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Source</TableHead>
                        <TableHead>Name</TableHead>
                        <TableHead>Role</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Subs</TableHead>
                        <TableHead className="text-right">L1</TableHead>
                        <TableHead className="text-right">L2</TableHead>
                        <TableHead className="text-right">L3</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {rawRows.slice(0, 200).map((r) => (
                        <TableRow key={r.id}>
                          <TableCell className="whitespace-nowrap">{r.date}</TableCell>
                          <TableCell>
                            <Badge variant={r.submitter_type === "recruiter" ? "default" : "secondary"}>
                              {r.submitter_type}
                            </Badge>
                          </TableCell>
                          <TableCell>{r.submitter_name}</TableCell>
                          <TableCell>{r.role_name}</TableCell>
                          <TableCell>
                            <Badge variant={roleStatusVariant(r.role_status)}>{r.role_status.replace("_", " ")}</Badge>
                          </TableCell>
                          <TableCell className="text-right">{r.submissions}</TableCell>
                          <TableCell className="text-right">{r.interview_l1 || "—"}</TableCell>
                          <TableCell className="text-right">{r.interview_l2 || "—"}</TableCell>
                          <TableCell className="text-right">{r.interview_l3 || "—"}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  {rawRows.length > 200 && (
                    <p className="pt-2 text-xs text-muted-foreground">
                      Showing first 200 of {rawRows.length} rows — download includes all.
                    </p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

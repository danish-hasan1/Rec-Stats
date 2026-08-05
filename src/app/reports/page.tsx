"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
import { startOfMonth, toISODate } from "@/lib/data/aggregate";
import { ROLE_STATUSES, roleStatusVariant } from "@/lib/data/role-status";
import type { EntryView, Role, RoleStatus, SubmitterType } from "@/types/db";
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

export default function ReportsPage() {
  const [entries, setEntries] = useState<EntryView[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);

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

  const filtered: ReportRow[] = useMemo(() => {
    const q = search.trim().toLowerCase();
    return entries
      .filter((e) => e.date >= from && e.date <= to)
      .filter((e) => sourceFilter === "all" || e.submitter_type === sourceFilter)
      .filter((e) => {
        const status = roleStatusById.get(e.role_id) ?? "open";
        return statusFilter.has(status);
      })
      .filter(
        (e) =>
          !q ||
          e.submitter_name.toLowerCase().includes(q) ||
          e.role_name.toLowerCase().includes(q)
      )
      .map((e) => ({ ...e, role_status: roleStatusById.get(e.role_id) ?? "open" }))
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [entries, from, to, sourceFilter, search, statusFilter, roleStatusById]);

  const summary = useMemo(() => {
    const totalSubs = filtered.reduce((s, r) => s + r.submissions, 0);
    const totalInterviews = filtered.reduce(
      (s, r) => s + r.interview_l1 + r.interview_l2 + r.interview_l3,
      0
    );
    const uniqueRoles = new Set(filtered.map((r) => r.role_id)).size;
    const uniquePeople = new Set(filtered.map((r) => r.submitter_id)).size;
    return { totalSubs, totalInterviews, uniqueRoles, uniquePeople };
  }, [filtered]);

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
    const preset: Preset = {
      name,
      from,
      to,
      sourceFilter,
      search,
      statusFilter: [...statusFilter],
    };
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

  async function handleDownloadExcel() {
    if (filtered.length === 0) {
      toast.error("No rows match these filters.");
      return;
    }
    setDownloading(true);
    try {
      const title = `Report ${from} to ${to}`;
      const filename = `rec-stats-report_${from}_to_${to}.xlsx`;
      await downloadReport(filtered, title, filename);
      toast.success(`Downloaded ${filtered.length} rows (Excel)`);
    } catch (err) {
      toast.error("Report generation failed");
      console.error(err);
    } finally {
      setDownloading(false);
    }
  }

  function handleDownloadCsv() {
    if (filtered.length === 0) {
      toast.error("No rows match these filters.");
      return;
    }
    const filename = `rec-stats-report_${from}_to_${to}.csv`;
    downloadReportCsv(filtered, filename);
    toast.success(`Downloaded ${filtered.length} rows (CSV)`);
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Reports</h1>
        <p className="text-sm text-muted-foreground">Filter entries and download as Excel or CSV.</p>
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
                      sourceFilter === t
                        ? "bg-primary text-primary-foreground"
                        : "hover:bg-accent"
                    )}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Search (name or role)</Label>
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="e.g. Dinesh, Python…"
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>Role status</Label>
            <div className="flex flex-wrap gap-4">
              {ROLE_STATUSES.map((status) => (
                <label key={status} className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Checkbox
                    checked={statusFilter.has(status)}
                    onCheckedChange={() => toggleStatus(status)}
                  />
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
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDeletePreset(selectedPreset)}
                    aria-label="Delete preset"
                  >
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

          <div className="flex flex-wrap gap-2">
            <Button onClick={handleDownloadExcel} disabled={downloading || loading} className="w-fit">
              <FileSpreadsheet className="mr-1 size-4" />
              {downloading ? "Generating…" : `Download ${filtered.length} rows — Excel`}
            </Button>
            <Button
              onClick={handleDownloadCsv}
              disabled={loading}
              variant="outline"
              className="w-fit"
            >
              <Download className="mr-1 size-4" />
              CSV
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="glass">
        <CardHeader>
          <CardTitle className="text-lg">Preview ({filtered.length} rows)</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : filtered.length === 0 ? (
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
                  {filtered.slice(0, 200).map((r) => (
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
                        <Badge variant={roleStatusVariant(r.role_status)}>
                          {r.role_status.replace("_", " ")}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">{r.submissions}</TableCell>
                      <TableCell className="text-right">{r.interview_l1 || "—"}</TableCell>
                      <TableCell className="text-right">{r.interview_l2 || "—"}</TableCell>
                      <TableCell className="text-right">{r.interview_l3 || "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {filtered.length > 200 && (
                <p className="pt-2 text-xs text-muted-foreground">
                  Showing first 200 of {filtered.length} rows — download includes all.
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

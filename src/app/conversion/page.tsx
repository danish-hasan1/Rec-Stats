"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { FunnelBar } from "@/components/dashboard/funnel-bar";
import { fetchEntries, fetchRoles, fetchSubmitters } from "@/lib/data/queries";
import {
  conversionRates,
  dealStats,
  startOfMonth,
  sumEntries,
  toISODate,
  type DealStats,
  type Totals,
} from "@/lib/data/aggregate";
import { downloadConversionReport, downloadConversionReportCsv } from "@/lib/data/conversion-report";
import { roleStatusVariant } from "@/lib/data/role-status";
import type { EntryView, RoleView, Submitter } from "@/types/db";
import { Send, UserCheck, Percent, Layers, Download, FileSpreadsheet, Handshake } from "lucide-react";

const ALL = "__all__";

function pctLabel(v: number | null) {
  return v === null ? "—" : `${Math.round(v)}%`;
}

function StageWiseCard({ totals, deal, title }: { totals: Totals; deal: DealStats; title: string }) {
  const rates = conversionRates(totals);
  const funnelMax = totals.totalSubs;
  return (
    <Card className="glass">
      <CardHeader>
        <CardTitle className="text-lg">{title}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {funnelMax === 0 ? (
          <p className="text-sm text-muted-foreground">No entries for this selection.</p>
        ) : (
          <>
            <FunnelBar label="Subs" value={totals.totalSubs} max={funnelMax} color="var(--primary)" />
            <FunnelBar label="L1" value={totals.interviewL1} max={funnelMax} color="var(--chart-2)" />
            <FunnelBar label="L2" value={totals.interviewL2} max={funnelMax} color="var(--chart-3)" />
            <FunnelBar label="L3" value={totals.interviewL3} max={funnelMax} color="var(--chart-4)" />
            <div className="grid grid-cols-2 gap-3 border-t pt-3 sm:grid-cols-3 lg:grid-cols-6">
              <div>
                <p className="text-xs text-muted-foreground">Subs → L1</p>
                <p className="text-lg font-semibold">{pctLabel(rates.subToL1)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">L1 → L2</p>
                <p className="text-lg font-semibold">{pctLabel(rates.l1ToL2)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">L2 → L3</p>
                <p className="text-lg font-semibold">{pctLabel(rates.l2ToL3)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Subs → L2</p>
                <p className="text-lg font-semibold">{pctLabel(rates.subToL2)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Deals closed</p>
                <p className="text-lg font-semibold">{deal.deals}</p>
                <p className="text-xs text-muted-foreground">of {deal.roles} roles worked</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Deal ratio</p>
                <p className="text-lg font-semibold">{pctLabel(deal.ratio)}</p>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

export default function ConversionPage() {
  const [entries, setEntries] = useState<EntryView[]>([]);
  const [roles, setRoles] = useState<RoleView[]>([]);
  const [submitters, setSubmitters] = useState<Submitter[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);

  const today = useMemo(() => new Date(), []);
  const [from, setFrom] = useState(toISODate(startOfMonth(today)));
  const [to, setTo] = useState(toISODate(today));
  const [roleFilter, setRoleFilter] = useState<string>(ALL);
  const [recruiterFilter, setRecruiterFilter] = useState<string>(ALL);

  useEffect(() => {
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
  }, []);

  const recruiters = useMemo(
    () => submitters.filter((s) => s.type === "recruiter").sort((a, b) => a.name.localeCompare(b.name)),
    [submitters]
  );
  const rolesById = useMemo(() => new Map(roles.map((r) => [r.id, r])), [roles]);

  const dateEntries = useMemo(
    () => entries.filter((e) => e.date >= from && e.date <= to),
    [entries, from, to]
  );

  // Respects both filters — the headline numbers for whatever combination is selected.
  const selectedEntries = useMemo(
    () =>
      dateEntries
        .filter((e) => roleFilter === ALL || e.role_id === roleFilter)
        .filter((e) => recruiterFilter === ALL || e.submitter_id === recruiterFilter),
    [dateEntries, roleFilter, recruiterFilter]
  );
  const selectedTotals = sumEntries(selectedEntries);

  // Role-wise breakdown honors the recruiter filter, so you can see a single
  // recruiter's conversion across every role they touched.
  const roleWiseEntries = useMemo(
    () => dateEntries.filter((e) => recruiterFilter === ALL || e.submitter_id === recruiterFilter),
    [dateEntries, recruiterFilter]
  );
  const roleWiseRows = useMemo(() => {
    const map = new Map<string, EntryView[]>();
    for (const e of roleWiseEntries) {
      const list = map.get(e.role_id) ?? [];
      list.push(e);
      map.set(e.role_id, list);
    }
    return [...map.entries()]
      .map(([roleId, es]) => {
        const role = rolesById.get(roleId);
        return {
          id: roleId,
          name: es[0].role_name,
          status: role?.status ?? "open",
          closedByName: role?.status === "deal" ? role.closed_by_name : null,
          totals: sumEntries(es),
        };
      })
      .sort((a, b) => b.totals.totalSubs - a.totals.totalSubs);
  }, [roleWiseEntries, rolesById]);

  // Recruiter-wise breakdown honors the role filter, so you can see every
  // recruiter's conversion for a single role.
  const recruiterWiseEntries = useMemo(
    () => dateEntries.filter((e) => roleFilter === ALL || e.role_id === roleFilter),
    [dateEntries, roleFilter]
  );
  const recruiterWiseRows = useMemo(() => {
    const map = new Map<string, EntryView[]>();
    for (const e of recruiterWiseEntries) {
      const list = map.get(e.submitter_id) ?? [];
      list.push(e);
      map.set(e.submitter_id, list);
    }
    return [...map.entries()]
      .map(([submitterId, es]) => ({
        id: submitterId,
        name: es[0].submitter_name,
        type: es[0].submitter_type,
        totals: sumEntries(es),
        deal: dealStats(es, roles, submitterId),
      }))
      .sort((a, b) => b.totals.totalSubs - a.totals.totalSubs);
  }, [recruiterWiseEntries, roles]);

  const scopeIsFiltered = roleFilter !== ALL || recruiterFilter !== ALL;
  const scopeEntries = scopeIsFiltered ? selectedEntries : dateEntries;
  const scopeTotals = scopeIsFiltered ? selectedTotals : sumEntries(dateEntries);
  const scopeDeal = useMemo(
    () => dealStats(scopeEntries, roles, recruiterFilter !== ALL ? recruiterFilter : undefined),
    [scopeEntries, roles, recruiterFilter]
  );

  const roleFilterName = roleFilter === ALL ? null : rolesById.get(roleFilter)?.name ?? null;
  const recruiterFilterName = recruiterFilter === ALL ? null : submitters.find((s) => s.id === recruiterFilter)?.name ?? null;

  function buildReportInput() {
    return {
      from,
      to,
      roleFilterName,
      recruiterFilterName,
      summary: {
        totals: scopeTotals,
        rates: conversionRates(scopeTotals),
        deal: scopeDeal,
      },
      byRole: roleWiseRows.map((r) => ({
        name: r.name,
        status: r.status,
        closedByName: r.closedByName,
        totals: r.totals,
        rates: conversionRates(r.totals),
      })),
      byRecruiter: recruiterWiseRows.map((r) => ({
        name: r.name,
        type: r.type,
        totals: r.totals,
        rates: conversionRates(r.totals),
        deal: r.deal,
      })),
    };
  }

  async function handleDownloadExcel() {
    setDownloading(true);
    try {
      await downloadConversionReport(buildReportInput(), `conversion-report_${from}_to_${to}.xlsx`);
      toast.success("Downloaded conversion report (Excel)");
    } catch (err) {
      toast.error("Report generation failed");
      console.error(err);
    } finally {
      setDownloading(false);
    }
  }

  function handleDownloadCsv() {
    downloadConversionReportCsv(buildReportInput(), `conversion-report_${from}_to_${to}.csv`);
    toast.success("Downloaded conversion report (CSV)");
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Conversion</h1>
          <p className="text-sm text-muted-foreground">
            Percentage conversion from submissions to L1/L2/deal — by stage, role, and recruiter.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={handleDownloadExcel} disabled={downloading || loading} variant="outline">
            <FileSpreadsheet className="mr-1 size-4" />
            {downloading ? "Generating…" : "Download report — Excel"}
          </Button>
          <Button onClick={handleDownloadCsv} disabled={loading} variant="outline">
            <Download className="mr-1 size-4" />
            CSV
          </Button>
        </div>
      </div>

      <Card className="glass">
        <CardHeader>
          <CardTitle className="text-lg">Filters</CardTitle>
        </CardHeader>
        <CardContent>
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
              <Label>Role</Label>
              <Select value={roleFilter} onValueChange={setRoleFilter}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="All roles" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>All roles</SelectItem>
                  {roles.map((r) => (
                    <SelectItem key={r.id} value={r.id}>
                      {r.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Recruiter</Label>
              <Select value={recruiterFilter} onValueChange={setRecruiterFilter}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="All recruiters" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>All recruiters</SelectItem>
                  {recruiters.map((r) => (
                    <SelectItem key={r.id} value={r.id}>
                      {r.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {scopeIsFiltered && (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-6">
          <KpiCard
            label="Selection — Submissions"
            value={loading ? "…" : selectedTotals.totalSubs}
            icon={Send}
            accent="primary"
          />
          <KpiCard
            label="Selection — Interviews"
            value={loading ? "…" : selectedTotals.interviews}
            icon={UserCheck}
            accent="chart-2"
          />
          <KpiCard
            label="Subs → L1"
            value={loading ? "…" : pctLabel(conversionRates(selectedTotals).subToL1)}
            icon={Percent}
            accent="chart-3"
          />
          <KpiCard
            label="L1 → L2"
            value={loading ? "…" : pctLabel(conversionRates(selectedTotals).l1ToL2)}
            icon={Layers}
            accent="chart-4"
          />
          <KpiCard
            label="Deals closed"
            value={loading ? "…" : scopeDeal.deals}
            sub={`of ${scopeDeal.roles} roles worked`}
            icon={Handshake}
            accent="chart-2"
          />
          <KpiCard
            label="Deal ratio"
            value={loading ? "…" : pctLabel(scopeDeal.ratio)}
            icon={Percent}
            accent="primary"
          />
        </div>
      )}

      <StageWiseCard
        totals={scopeTotals}
        deal={scopeDeal}
        title={scopeIsFiltered ? "Stage-wise conversion — current selection" : "Stage-wise conversion — selected period"}
      />

      <Card className="glass">
        <CardHeader>
          <CardTitle className="text-lg">
            Role-wise conversion{recruiterFilter !== ALL ? " — filtered by recruiter" : ""}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : roleWiseRows.length === 0 ? (
            <p className="text-sm text-muted-foreground">No entries for this selection.</p>
          ) : (
            <div className="max-h-96 overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Role</TableHead>
                    <TableHead>Deal</TableHead>
                    <TableHead className="text-right">Subs</TableHead>
                    <TableHead className="text-right">L1</TableHead>
                    <TableHead className="text-right">L2</TableHead>
                    <TableHead className="text-right">Subs → L1</TableHead>
                    <TableHead className="text-right">L1 → L2</TableHead>
                    <TableHead className="text-right">Subs → L2</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {roleWiseRows.map((r) => {
                    const rates = conversionRates(r.totals);
                    return (
                      <TableRow key={r.id}>
                        <TableCell className="font-medium">{r.name}</TableCell>
                        <TableCell>
                          {r.status === "deal" ? (
                            <Badge variant={roleStatusVariant(r.status)}>
                              {r.closedByName ?? "deal"}
                            </Badge>
                          ) : (
                            <span className="text-sm text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">{r.totals.totalSubs}</TableCell>
                        <TableCell className="text-right">{r.totals.interviewL1 || "—"}</TableCell>
                        <TableCell className="text-right">{r.totals.interviewL2 || "—"}</TableCell>
                        <TableCell className="text-right">{pctLabel(rates.subToL1)}</TableCell>
                        <TableCell className="text-right">{pctLabel(rates.l1ToL2)}</TableCell>
                        <TableCell className="text-right font-semibold">{pctLabel(rates.subToL2)}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="glass">
        <CardHeader>
          <CardTitle className="text-lg">
            Recruiter-wise conversion{roleFilter !== ALL ? " — filtered by role" : ""}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : recruiterWiseRows.length === 0 ? (
            <p className="text-sm text-muted-foreground">No entries for this selection.</p>
          ) : (
            <div className="max-h-96 overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead className="text-right">Subs</TableHead>
                    <TableHead className="text-right">L1</TableHead>
                    <TableHead className="text-right">L2</TableHead>
                    <TableHead className="text-right">Roles</TableHead>
                    <TableHead className="text-right">Deals</TableHead>
                    <TableHead className="text-right">Deal Ratio</TableHead>
                    <TableHead className="text-right">Subs → L1</TableHead>
                    <TableHead className="text-right">L1 → L2</TableHead>
                    <TableHead className="text-right">Subs → L2</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recruiterWiseRows.map((r) => {
                    const rates = conversionRates(r.totals);
                    return (
                      <TableRow key={r.id}>
                        <TableCell className="font-medium">{r.name}</TableCell>
                        <TableCell className="capitalize text-muted-foreground">{r.type}</TableCell>
                        <TableCell className="text-right">{r.totals.totalSubs}</TableCell>
                        <TableCell className="text-right">{r.totals.interviewL1 || "—"}</TableCell>
                        <TableCell className="text-right">{r.totals.interviewL2 || "—"}</TableCell>
                        <TableCell className="text-right">{r.deal.roles}</TableCell>
                        <TableCell className="text-right">{r.deal.deals || "—"}</TableCell>
                        <TableCell className="text-right font-semibold">{pctLabel(r.deal.ratio)}</TableCell>
                        <TableCell className="text-right">{pctLabel(rates.subToL1)}</TableCell>
                        <TableCell className="text-right">{pctLabel(rates.l1ToL2)}</TableCell>
                        <TableCell className="text-right">{pctLabel(rates.subToL2)}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

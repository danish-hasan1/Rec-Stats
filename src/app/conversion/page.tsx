"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  startOfMonth,
  sumEntries,
  toISODate,
  type Totals,
} from "@/lib/data/aggregate";
import type { EntryView, RoleView, Submitter } from "@/types/db";
import { Send, UserCheck, Percent, Layers } from "lucide-react";

const ALL = "__all__";

function pctLabel(v: number | null) {
  return v === null ? "—" : `${Math.round(v)}%`;
}

function StageWiseCard({ totals, title }: { totals: Totals; title: string }) {
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
            <div className="grid grid-cols-2 gap-3 border-t pt-3 sm:grid-cols-4">
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
    const map = new Map<string, { id: string; name: string; totals: Totals }>();
    for (const e of roleWiseEntries) {
      const row = map.get(e.role_id) ?? { id: e.role_id, name: e.role_name, totals: sumEntries([]) };
      map.set(e.role_id, row);
    }
    for (const row of map.values()) {
      row.totals = sumEntries(roleWiseEntries.filter((e) => e.role_id === row.id));
    }
    return [...map.values()].sort((a, b) => b.totals.totalSubs - a.totals.totalSubs);
  }, [roleWiseEntries]);

  // Recruiter-wise breakdown honors the role filter, so you can see every
  // recruiter's conversion for a single role.
  const recruiterWiseEntries = useMemo(
    () => dateEntries.filter((e) => roleFilter === ALL || e.role_id === roleFilter),
    [dateEntries, roleFilter]
  );
  const recruiterWiseRows = useMemo(() => {
    const byId = new Map<string, { id: string; name: string; type: string }>();
    for (const e of recruiterWiseEntries) {
      if (!byId.has(e.submitter_id)) {
        byId.set(e.submitter_id, { id: e.submitter_id, name: e.submitter_name, type: e.submitter_type });
      }
    }
    return [...byId.values()]
      .map((s) => ({
        ...s,
        totals: sumEntries(recruiterWiseEntries.filter((e) => e.submitter_id === s.id)),
      }))
      .sort((a, b) => b.totals.totalSubs - a.totals.totalSubs);
  }, [recruiterWiseEntries]);

  const stageTotals = sumEntries(dateEntries);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Conversion</h1>
        <p className="text-sm text-muted-foreground">
          Percentage conversion from submissions to L1/L2 — by stage, role, and recruiter.
        </p>
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

      {(roleFilter !== ALL || recruiterFilter !== ALL) && (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
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
        </div>
      )}

      <StageWiseCard
        totals={roleFilter === ALL && recruiterFilter === ALL ? stageTotals : selectedTotals}
        title={
          roleFilter === ALL && recruiterFilter === ALL
            ? "Stage-wise conversion — selected period"
            : "Stage-wise conversion — current selection"
        }
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
    </div>
  );
}

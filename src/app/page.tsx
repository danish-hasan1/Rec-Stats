"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
import { TrendChart } from "@/components/dashboard/trend-chart";
import { FunnelBar } from "@/components/dashboard/funnel-bar";
import { fetchEntries, fetchRoles, fetchSubmitters } from "@/lib/data/queries";
import { byDate, byRole, bySubmitter, startOfMonth, startOfWeek, sumEntries, toISODate } from "@/lib/data/aggregate";
import { roleStatusVariant } from "@/lib/data/role-status";
import { cn } from "@/lib/utils";
import type { EntryView, RoleView, Submitter } from "@/types/db";
import {
  Send,
  Building2,
  Users2,
  CalendarCheck2,
  Briefcase,
  Trophy,
  Handshake,
  XCircle,
  TrendingUp,
  TrendingDown,
  Minus,
  UserCheck,
} from "lucide-react";

function DeltaBadge({ current, previous }: { current: number; previous: number }) {
  if (previous === 0 && current === 0) return null;
  if (previous === 0) {
    return (
      <span className="inline-flex items-center gap-0.5 text-xs font-medium text-chart-2">
        <TrendingUp className="size-3" /> new
      </span>
    );
  }
  const pct = Math.round(((current - previous) / previous) * 100);
  if (pct === 0) {
    return (
      <span className="inline-flex items-center gap-0.5 text-xs font-medium text-muted-foreground">
        <Minus className="size-3" /> flat vs last period
      </span>
    );
  }
  const up = pct > 0;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 text-xs font-medium",
        up ? "text-chart-2" : "text-destructive"
      )}
    >
      {up ? <TrendingUp className="size-3" /> : <TrendingDown className="size-3" />}
      {up ? "+" : ""}
      {pct}% vs last period
    </span>
  );
}

type Detail =
  | { kind: "entries"; metric: "submissions" | "interviews"; title: string; rows: EntryView[] }
  | { kind: "roles"; title: string; rows: RoleView[] }
  | { kind: "submitters"; title: string; rows: Submitter[] }
  | null;

export default function DashboardPage() {
  const [entries, setEntries] = useState<EntryView[]>([]);
  const [roles, setRoles] = useState<RoleView[]>([]);
  const [submitters, setSubmitters] = useState<Submitter[]>([]);
  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState<Detail>(null);

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

  const today = useMemo(() => new Date(), []);
  const todayISO = toISODate(today);
  const yesterdayISO = toISODate(new Date(today.getTime() - 86400000));
  const weekStartISO = toISODate(startOfWeek(today));
  const monthStartISO = toISODate(startOfMonth(today));

  const todayTotals = sumEntries(entries.filter((e) => e.date === todayISO));
  const yesterdayTotals = sumEntries(entries.filter((e) => e.date === yesterdayISO));
  const weekTotals = sumEntries(entries.filter((e) => e.date >= weekStartISO && e.date <= todayISO));
  const monthTotals = sumEntries(entries.filter((e) => e.date >= monthStartISO && e.date <= todayISO));

  const prevWeekEndDate = new Date(startOfWeek(today).getTime() - 86400000);
  const prevWeekStartDate = new Date(prevWeekEndDate.getTime() - 6 * 86400000);
  const prevWeekTotals = sumEntries(
    entries.filter((e) => e.date >= toISODate(prevWeekStartDate) && e.date <= toISODate(prevWeekEndDate))
  );

  const prevMonthEndDate = new Date(startOfMonth(today).getTime() - 86400000);
  const prevMonthStartDate = startOfMonth(prevMonthEndDate);
  const prevMonthTotals = sumEntries(
    entries.filter((e) => e.date >= toISODate(prevMonthStartDate) && e.date <= toISODate(prevMonthEndDate))
  );

  const trend = byDate(entries.filter((e) => e.date >= monthStartISO)).map((d) => ({
    date: d.date,
    totalSubs: d.totalSubs,
    interviews: d.interviews,
  }));

  const submitterRows = bySubmitter(entries.filter((e) => e.date >= monthStartISO));
  const roleRows = byRole(entries.filter((e) => e.date >= monthStartISO)).slice(0, 8);

  const roleCounts = {
    open: roles.filter((r) => r.status === "open").length,
    on_hold: roles.filter((r) => r.status === "on_hold").length,
    deal: roles.filter((r) => r.status === "deal").length,
    lost: roles.filter((r) => r.status === "lost").length,
    cancelled: roles.filter((r) => r.status === "cancelled").length,
  };

  const activeRecruiters = submitters.filter((s) => s.type === "recruiter" && s.status === "active").length;
  const activeVendors = submitters.filter((s) => s.type === "vendor" && s.status === "active").length;

  const topRecruiter = [...submitterRows]
    .filter((r) => r.type === "recruiter")
    .sort((a, b) => b.recruiterSubs - a.recruiterSubs)[0];

  const topVendor = [...submitterRows]
    .filter((r) => r.type === "vendor")
    .sort((a, b) => b.vendorSubs - a.vendorSubs)[0];

  const rolesById = new Map(roles.map((r) => [r.id, r]));

  const funnelMax = monthTotals.totalSubs;

  const showEntries = (title: string, rows: EntryView[]) =>
    setDetail({ kind: "entries", metric: "submissions", title, rows });
  const showInterviews = (title: string, rows: EntryView[]) =>
    setDetail({
      kind: "entries",
      metric: "interviews",
      title,
      rows: rows.filter((e) => e.interview_l1 + e.interview_l2 + e.interview_l3 > 0),
    });
  const showRoles = (title: string, rows: RoleView[]) => setDetail({ kind: "roles", title, rows });
  const showSubmitters = (title: string, rows: Submitter[]) =>
    setDetail({ kind: "submitters", title, rows });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          As of {today.toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard
          label="Today — Submissions"
          value={loading ? "…" : todayTotals.totalSubs}
          sub={`${todayTotals.interviews} interviews`}
          icon={Send}
          accent="primary"
          onClick={() => showEntries(`Today — ${todayISO}`, entries.filter((e) => e.date === todayISO))}
        />
        <KpiCard
          label="Yesterday — Submissions"
          value={loading ? "…" : yesterdayTotals.totalSubs}
          sub={`${yesterdayTotals.interviews} interviews`}
          icon={CalendarCheck2}
          accent="chart-2"
          onClick={() => showEntries(`Yesterday — ${yesterdayISO}`, entries.filter((e) => e.date === yesterdayISO))}
        />
        <KpiCard
          label="This Week — Submissions"
          value={loading ? "…" : weekTotals.totalSubs}
          sub={`${weekTotals.interviews} interviews`}
          extra={!loading && <DeltaBadge current={weekTotals.totalSubs} previous={prevWeekTotals.totalSubs} />}
          icon={Users2}
          accent="chart-3"
          onClick={() =>
            showEntries(
              "This Week",
              entries.filter((e) => e.date >= weekStartISO && e.date <= todayISO)
            )
          }
        />
        <KpiCard
          label="This Month — Submissions"
          value={loading ? "…" : monthTotals.totalSubs}
          sub={`${monthTotals.interviews} interviews`}
          extra={!loading && <DeltaBadge current={monthTotals.totalSubs} previous={prevMonthTotals.totalSubs} />}
          icon={Building2}
          accent="chart-4"
          onClick={() =>
            showEntries(
              "This Month",
              entries.filter((e) => e.date >= monthStartISO && e.date <= todayISO)
            )
          }
        />
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard
          label="Today — Interviews"
          value={loading ? "…" : todayTotals.interviews}
          sub={`${todayTotals.totalSubs} submissions`}
          icon={UserCheck}
          accent="primary"
          onClick={() => showInterviews(`Today — ${todayISO}`, entries.filter((e) => e.date === todayISO))}
        />
        <KpiCard
          label="Yesterday — Interviews"
          value={loading ? "…" : yesterdayTotals.interviews}
          sub={`${yesterdayTotals.totalSubs} submissions`}
          icon={UserCheck}
          accent="chart-2"
          onClick={() =>
            showInterviews(`Yesterday — ${yesterdayISO}`, entries.filter((e) => e.date === yesterdayISO))
          }
        />
        <KpiCard
          label="This Week — Interviews"
          value={loading ? "…" : weekTotals.interviews}
          sub={`${weekTotals.totalSubs} submissions`}
          icon={UserCheck}
          accent="chart-3"
          onClick={() =>
            showInterviews(
              "This Week",
              entries.filter((e) => e.date >= weekStartISO && e.date <= todayISO)
            )
          }
        />
        <KpiCard
          label="This Month — Interviews"
          value={loading ? "…" : monthTotals.interviews}
          sub={`${monthTotals.totalSubs} submissions`}
          icon={UserCheck}
          accent="chart-4"
          onClick={() =>
            showInterviews(
              "This Month",
              entries.filter((e) => e.date >= monthStartISO && e.date <= todayISO)
            )
          }
        />
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <KpiCard
          label="Open Roles"
          value={loading ? "…" : roleCounts.open}
          sub={`${roleCounts.on_hold} on hold`}
          icon={Briefcase}
          accent="primary"
          onClick={() => showRoles("Open Roles", roles.filter((r) => r.status === "open"))}
        />
        <KpiCard
          label="Deals Closed"
          value={loading ? "…" : roleCounts.deal}
          sub={`${roleCounts.lost + roleCounts.cancelled} lost/cancelled`}
          icon={Handshake}
          accent="chart-2"
          onClick={() => showRoles("Deals Closed", roles.filter((r) => r.status === "deal"))}
        />
        <KpiCard
          label="Active Team"
          value={loading ? "…" : activeRecruiters + activeVendors}
          sub={`${activeRecruiters} recruiters, ${activeVendors} vendors`}
          icon={Users2}
          accent="chart-3"
          onClick={() => showSubmitters("Active Team", submitters.filter((s) => s.status === "active"))}
        />
        <KpiCard
          label="Top Recruiter — this month"
          value={loading ? "…" : topRecruiter ? topRecruiter.name : "—"}
          sub={topRecruiter ? `${topRecruiter.recruiterSubs} self subs` : "No data yet"}
          icon={Trophy}
          accent="chart-4"
          onClick={
            topRecruiter
              ? () =>
                  showEntries(
                    `${topRecruiter.name} — this month`,
                    entries.filter(
                      (e) =>
                        e.submitter_name === topRecruiter.name &&
                        e.submitter_type === "recruiter" &&
                        e.date >= monthStartISO
                    )
                  )
              : undefined
          }
        />
        <KpiCard
          label="Top Vendor — this month"
          value={loading ? "…" : topVendor ? topVendor.name : "—"}
          sub={topVendor ? `${topVendor.vendorSubs} subs` : "No data yet"}
          icon={Building2}
          accent="chart-2"
          onClick={
            topVendor
              ? () =>
                  showEntries(
                    `${topVendor.name} — this month`,
                    entries.filter(
                      (e) =>
                        e.submitter_name === topVendor.name &&
                        e.submitter_type === "vendor" &&
                        e.date >= monthStartISO
                    )
                  )
              : undefined
          }
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card className="glass">
          <CardHeader>
            <CardTitle className="text-lg">This month — trend</CardTitle>
          </CardHeader>
          <CardContent>
            {trend.length === 0 ? (
              <p className="text-sm text-muted-foreground">No entries yet this month.</p>
            ) : (
              <TrendChart data={trend} />
            )}
          </CardContent>
        </Card>

        <Card className="glass">
          <CardHeader>
            <CardTitle className="text-lg">Interview funnel — this month</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {funnelMax === 0 ? (
              <p className="text-sm text-muted-foreground">No entries yet this month.</p>
            ) : (
              <>
                <FunnelBar label="Submissions" value={monthTotals.totalSubs} max={funnelMax} color="var(--primary)" />
                <FunnelBar label="L1" value={monthTotals.interviewL1} max={funnelMax} color="var(--chart-2)" />
                <FunnelBar label="L2" value={monthTotals.interviewL2} max={funnelMax} color="var(--chart-3)" />
                <FunnelBar label="L3" value={monthTotals.interviewL3} max={funnelMax} color="var(--chart-4)" />
                <div className="flex items-center gap-2 pt-1 text-xs text-muted-foreground">
                  <XCircle className="size-3.5" />
                  {roleCounts.lost} roles lost, {roleCounts.cancelled} cancelled (all time)
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card className="glass">
          <CardHeader>
            <CardTitle className="text-lg">Leaderboard — this month</CardTitle>
          </CardHeader>
          <CardContent>
            {submitterRows.length === 0 ? (
              <p className="text-sm text-muted-foreground">No data yet.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-8">#</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead className="text-right">Self Subs</TableHead>
                    <TableHead className="text-right">Deal Vendor Subs</TableHead>
                    <TableHead className="text-right">Interviews</TableHead>
                    <TableHead className="text-right">Conversion</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {submitterRows.map((r, i) => {
                    const conversion = r.totalSubs > 0 ? Math.round((r.interviews / r.totalSubs) * 100) : null;
                    return (
                      <TableRow key={r.name}>
                        <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                        <TableCell className="font-medium">
                          {r.name}
                          <span className="ml-2 text-xs text-muted-foreground capitalize">({r.type})</span>
                        </TableCell>
                        <TableCell className="text-right">
                          {r.type === "recruiter" ? r.recruiterSubs : r.vendorSubs}
                        </TableCell>
                        <TableCell className="text-right text-muted-foreground">
                          {r.type === "recruiter" ? r.dealVendorSubs || "—" : "—"}
                        </TableCell>
                        <TableCell className="text-right">{r.interviews || "—"}</TableCell>
                        <TableCell className="text-right text-muted-foreground">
                          {conversion === null ? "—" : `${conversion}%`}
                        </TableCell>
                        <TableCell className="text-right font-semibold">{r.totalSubs}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card className="glass">
          <CardHeader>
            <CardTitle className="text-lg">By role — this month</CardTitle>
          </CardHeader>
          <CardContent>
            {roleRows.length === 0 ? (
              <p className="text-sm text-muted-foreground">No data yet.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Role</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Closed By</TableHead>
                    <TableHead className="text-right">Submissions</TableHead>
                    <TableHead className="text-right">L1</TableHead>
                    <TableHead className="text-right">L2</TableHead>
                    <TableHead className="text-right">L3</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {roleRows.map((r) => {
                    const role = rolesById.get(r.id);
                    return (
                      <TableRow key={r.name}>
                        <TableCell className="font-medium">{r.name}</TableCell>
                        <TableCell>
                          {role ? (
                            <Badge variant={roleStatusVariant(role.status)}>
                              {role.status.replace("_", " ")}
                            </Badge>
                          ) : (
                            "—"
                          )}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {role?.status === "deal" && role.closed_by_name ? role.closed_by_name : "—"}
                        </TableCell>
                        <TableCell className="text-right">{r.totalSubs}</TableCell>
                        <TableCell className="text-right">{r.interviewL1 || "—"}</TableCell>
                        <TableCell className="text-right">{r.interviewL2 || "—"}</TableCell>
                        <TableCell className="text-right">{r.interviewL3 || "—"}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={detail !== null} onOpenChange={(open) => !open && setDetail(null)}>
        <DialogContent className="glass-strong flex max-h-[92vh] w-[95vw] max-w-4xl flex-col overflow-y-auto sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>{detail?.title}</DialogTitle>
            <DialogDescription>
              {detail?.rows.length ?? 0} {detail?.rows.length === 1 ? "row" : "rows"}
            </DialogDescription>
          </DialogHeader>

          {detail?.rows.length === 0 && (
            <p className="text-sm text-muted-foreground">Nothing here.</p>
          )}

          {detail?.kind === "entries" && detail.rows.length > 0 && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Role</TableHead>
                  {detail.metric === "submissions" ? (
                    <TableHead className="text-right">Subs</TableHead>
                  ) : (
                    <>
                      <TableHead className="text-right">L1</TableHead>
                      <TableHead className="text-right">L2</TableHead>
                      <TableHead className="text-right">L3</TableHead>
                    </>
                  )}
                </TableRow>
              </TableHeader>
              <TableBody>
                {detail.rows.map((e) => (
                  <TableRow key={e.id}>
                    <TableCell className="whitespace-nowrap">{e.date}</TableCell>
                    <TableCell>
                      <Badge variant={e.submitter_type === "recruiter" ? "default" : "secondary"}>
                        {e.submitter_type}
                      </Badge>
                    </TableCell>
                    <TableCell>{e.submitter_name}</TableCell>
                    <TableCell>{e.role_name}</TableCell>
                    {detail.metric === "submissions" ? (
                      <TableCell className="text-right">{e.submissions}</TableCell>
                    ) : (
                      <>
                        <TableCell className="text-right">{e.interview_l1 || "—"}</TableCell>
                        <TableCell className="text-right">{e.interview_l2 || "—"}</TableCell>
                        <TableCell className="text-right">{e.interview_l3 || "—"}</TableCell>
                      </>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}

          {detail?.kind === "roles" && detail.rows.length > 0 && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Role</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Closed By</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {detail.rows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">{r.name}</TableCell>
                    <TableCell className="text-muted-foreground">{r.client || "—"}</TableCell>
                    <TableCell>
                      <Badge variant={roleStatusVariant(r.status)}>{r.status.replace("_", " ")}</Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {r.status === "deal" && r.closed_by_name ? (
                        <>
                          {r.closed_by_name}
                          <span className="ml-1 text-xs capitalize">({r.closed_by_type})</span>
                        </>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}

          {detail?.kind === "submitters" && detail.rows.length > 0 && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {detail.rows.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="font-medium">{s.name}</TableCell>
                    <TableCell>
                      <Badge variant={s.type === "recruiter" ? "default" : "secondary"}>{s.type}</Badge>
                    </TableCell>
                    <TableCell className="capitalize text-muted-foreground">{s.status}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

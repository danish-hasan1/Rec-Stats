import type { EntryView, RoleView } from "@/types/db";

export type Totals = {
  recruiterSubs: number;
  vendorSubs: number;
  totalSubs: number;
  interviewL1: number;
  interviewL2: number;
  interviewL3: number;
  interviews: number;
};

const emptyTotals = (): Totals => ({
  recruiterSubs: 0,
  vendorSubs: 0,
  totalSubs: 0,
  interviewL1: 0,
  interviewL2: 0,
  interviewL3: 0,
  interviews: 0,
});

function addEntry(t: Totals, e: EntryView) {
  if (e.submitter_type === "recruiter") t.recruiterSubs += e.submissions;
  else t.vendorSubs += e.submissions;
  t.totalSubs += e.submissions;
  t.interviewL1 += e.interview_l1;
  t.interviewL2 += e.interview_l2;
  t.interviewL3 += e.interview_l3;
  t.interviews += e.interviews;
}

export function sumEntries(entries: EntryView[]): Totals {
  const t = emptyTotals();
  for (const e of entries) addEntry(t, e);
  return t;
}

export function byDate(entries: EntryView[]) {
  const map = new Map<string, Totals>();
  for (const e of entries) {
    const t = map.get(e.date) ?? emptyTotals();
    addEntry(t, e);
    map.set(e.date, t);
  }
  return [...map.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, totals]) => ({ date, ...totals }));
}

export type SubmitterRow = Totals & {
  id: string;
  name: string;
  type: string;
  // Vendor submissions credited to this recruiter's deals — kept separate
  // from recruiterSubs (self-submitted) so vendor volume never inflates it.
  dealVendorSubs: number;
};

export function bySubmitter(entries: EntryView[]): SubmitterRow[] {
  const map = new Map<string, SubmitterRow>();
  const ensure = (id: string, name: string, type: string) => {
    let t = map.get(id);
    if (!t) {
      t = { ...emptyTotals(), id, name, type, dealVendorSubs: 0 };
      map.set(id, t);
    }
    return t;
  };
  for (const e of entries) {
    const t = ensure(e.submitter_id, e.submitter_name, e.submitter_type);
    addEntry(t, e);

    if (e.submitter_type === "vendor" && e.deal_recruiter_id) {
      const dealT = ensure(e.deal_recruiter_id, e.deal_recruiter_name ?? "Unknown", "recruiter");
      dealT.dealVendorSubs += e.submissions;
    }
  }
  return [...map.values()].sort((a, b) => b.totalSubs - a.totalSubs);
}

export type ConversionRates = {
  subToL1: number | null;
  l1ToL2: number | null;
  l2ToL3: number | null;
  subToL2: number | null;
  subToL3: number | null;
};

export function conversionRates(t: Totals): ConversionRates {
  const pct = (num: number, den: number) => (den > 0 ? (num / den) * 100 : null);
  return {
    subToL1: pct(t.interviewL1, t.totalSubs),
    l1ToL2: pct(t.interviewL2, t.interviewL1),
    l2ToL3: pct(t.interviewL3, t.interviewL2),
    subToL2: pct(t.interviewL2, t.totalSubs),
    subToL3: pct(t.interviewL3, t.totalSubs),
  };
}

export type DealStats = {
  roles: number;
  deals: number;
  ratio: number | null;
};

// Deal ratio = roles that closed as a "deal" / distinct roles touched by the
// given entries. When closedById is set, only deals credited to that person
// count (e.g. a recruiter's own placements out of the roles they worked).
export function dealStats(entries: EntryView[], roles: RoleView[], closedById?: string | null): DealStats {
  const rolesById = new Map(roles.map((r) => [r.id, r]));
  const roleIds = new Set(entries.map((e) => e.role_id));
  let deals = 0;
  for (const id of roleIds) {
    const role = rolesById.get(id);
    if (!role || role.status !== "deal") continue;
    if (closedById && role.closed_by_id !== closedById) continue;
    deals += 1;
  }
  const total = roleIds.size;
  return { roles: total, deals, ratio: total > 0 ? (deals / total) * 100 : null };
}

// Weekly/Monthly reports call dealStats() once per period, using only that
// period's entries. A role touched across several periods (e.g. submissions
// logged over three different weeks) would then get credited as a fresh deal
// in every one of them. This computes deal stats for a whole set of periods
// at once, attributing each deal-role's credit to exactly one period — the
// one containing its most recent entry — so the same deal is never counted
// twice across periods.
export function periodDealStats(periods: PeriodRow[], roles: RoleView[], closedById?: string | null): DealStats[] {
  const rolesById = new Map(roles.map((r) => [r.id, r]));

  const lastDateByRole = new Map<string, string>();
  for (const p of periods) {
    for (const e of p.entries) {
      const prev = lastDateByRole.get(e.role_id);
      if (!prev || e.date > prev) lastDateByRole.set(e.role_id, e.date);
    }
  }
  const homePeriodByRole = new Map<string, string>();
  for (const p of periods) {
    for (const e of p.entries) {
      if (lastDateByRole.get(e.role_id) === e.date) homePeriodByRole.set(e.role_id, p.key);
    }
  }

  return periods.map((p) => {
    const touchedRoleIds = new Set(p.entries.map((e) => e.role_id));
    let deals = 0;
    for (const roleId of touchedRoleIds) {
      const role = rolesById.get(roleId);
      if (!role || role.status !== "deal") continue;
      if (closedById && role.closed_by_id !== closedById) continue;
      if (homePeriodByRole.get(roleId) !== p.key) continue;
      deals += 1;
    }
    return { roles: touchedRoleIds.size, deals, ratio: touchedRoleIds.size > 0 ? (deals / touchedRoleIds.size) * 100 : null };
  });
}

export type UnaccountedDeal = {
  roleId: string;
  roleName: string;
  closedById: string | null;
  closedByName: string | null;
  closedByType: string | null;
};

// A role can be marked "deal" in Admin with zero entries ever logged against
// it (the placement was tracked purely via status, not through Daily
// Entry). Every other report/breakdown here is built by grouping *entries*,
// so a deal like that is invisible everywhere — it never has a row to attach
// to. This finds those roles so callers can merge them back in explicitly.
export function unaccountedDeals(roles: RoleView[], allEntries: EntryView[]): UnaccountedDeal[] {
  const touchedRoleIds = new Set(allEntries.map((e) => e.role_id));
  return roles
    .filter((r) => r.status === "deal" && !touchedRoleIds.has(r.id))
    .map((r) => ({
      roleId: r.id,
      roleName: r.name,
      closedById: r.closed_by_id,
      closedByName: r.closed_by_name,
      closedByType: r.closed_by_type,
    }));
}

export function byRole(entries: EntryView[]) {
  const map = new Map<string, Totals & { id: string; name: string }>();
  for (const e of entries) {
    const t = map.get(e.role_id) ?? { ...emptyTotals(), id: e.role_id, name: e.role_name };
    addEntry(t, e);
    map.set(e.role_id, t);
  }
  return [...map.values()].sort((a, b) => b.totalSubs - a.totalSubs);
}

export type GroupRow = {
  id: string;
  name: string;
  type?: string;
  totals: Totals;
  entries: EntryView[];
};

function groupEntriesBy(entries: EntryView[], keyOf: (e: EntryView) => string, labelOf: (e: EntryView) => string, typeOf?: (e: EntryView) => string): GroupRow[] {
  const map = new Map<string, EntryView[]>();
  for (const e of entries) {
    const key = keyOf(e);
    const list = map.get(key) ?? [];
    list.push(e);
    map.set(key, list);
  }
  return [...map.entries()]
    .map(([id, es]) => ({
      id,
      name: labelOf(es[0]),
      type: typeOf?.(es[0]),
      totals: sumEntries(es),
      entries: es,
    }))
    .sort((a, b) => b.totals.totalSubs - a.totals.totalSubs);
}

// Like byRole, but keeps each role's raw entries around so callers can
// derive deal stats (dealStats needs the entry list, not just totals).
export function groupByRoleWithEntries(entries: EntryView[]): GroupRow[] {
  return groupEntriesBy(entries, (e) => e.role_id, (e) => e.role_name);
}

// Like bySubmitter, but keeps each submitter's raw entries around for the
// same reason, and skips the vendor-deal-credit bookkeeping bySubmitter does
// (reports want plain per-submitter totals, not credited totals).
export function groupBySubmitterWithEntries(entries: EntryView[]): GroupRow[] {
  return groupEntriesBy(entries, (e) => e.submitter_id, (e) => e.submitter_name, (e) => e.submitter_type);
}

export type PeriodRow = {
  key: string;
  label: string;
  totals: Totals;
  entries: EntryView[];
};

function groupByPeriod(entries: EntryView[], keyOf: (date: string) => string, labelOf: (key: string) => string): PeriodRow[] {
  const map = new Map<string, EntryView[]>();
  for (const e of entries) {
    const key = keyOf(e.date);
    const list = map.get(key) ?? [];
    list.push(e);
    map.set(key, list);
  }
  return [...map.entries()]
    .map(([key, es]) => ({ key, label: labelOf(key), totals: sumEntries(es), entries: es }))
    .sort((a, b) => a.key.localeCompare(b.key));
}

export function weekKey(dateStr: string) {
  const d = new Date(`${dateStr}T00:00:00`);
  const day = d.getDay();
  const diff = (day + 6) % 7; // Monday start, matches startOfWeek()
  d.setDate(d.getDate() - diff);
  return toISODate(d);
}

export function weekLabel(mondayISO: string) {
  const start = new Date(`${mondayISO}T00:00:00`);
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  const fmt = (d: Date) => d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  const sameYear = start.getFullYear() === end.getFullYear();
  return `${fmt(start)} – ${fmt(end)}${sameYear ? `, ${end.getFullYear()}` : ""}`;
}

export function monthKey(dateStr: string) {
  return dateStr.slice(0, 7); // YYYY-MM
}

export function monthLabel(key: string) {
  const [y, m] = key.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

export function byWeek(entries: EntryView[]): PeriodRow[] {
  return groupByPeriod(entries, weekKey, weekLabel);
}

export function byMonth(entries: EntryView[]): PeriodRow[] {
  return groupByPeriod(entries, monthKey, monthLabel);
}

// Trailing N month keys ending at (and including) the month containing `end`,
// oldest first — e.g. trailingMonthKeys(6, new Date()) run in March gives
// ["2025-10", ..., "2026-03"]. Used so a trend chart/table shows every month
// in the window (as zeros) even ones with no entries at all, instead of
// silently skipping gaps.
export function trailingMonthKeys(count: number, end: Date): string[] {
  const keys: string[] = [];
  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(end.getFullYear(), end.getMonth() - i, 1);
    keys.push(monthKey(toISODate(d)));
  }
  return keys;
}

export type RecruiterMonthRow = {
  submitterId: string;
  submitterName: string;
  submitterType: string;
  monthKey: string;
  totals: Totals;
  rates: ConversionRates;
  deal: DealStats;
};

// Per-submitter, per-month breakdown — the base series a performance trend
// view is built from (byMonth alone only gives the team-wide total).
export function recruiterMonthlyPerformance(entries: EntryView[], roles: RoleView[]): RecruiterMonthRow[] {
  const map = new Map<string, EntryView[]>();
  for (const e of entries) {
    const key = `${e.submitter_id}|${monthKey(e.date)}`;
    const list = map.get(key) ?? [];
    list.push(e);
    map.set(key, list);
  }
  return [...map.entries()].map(([key, es]) => {
    const [submitterId, mKey] = key.split("|");
    const totals = sumEntries(es);
    return {
      submitterId,
      submitterName: es[0].submitter_name,
      submitterType: es[0].submitter_type,
      monthKey: mKey,
      totals,
      rates: conversionRates(totals),
      deal: dealStats(es, roles, submitterId),
    };
  });
}

export function toISODate(d: Date) {
  // Local calendar date, not UTC — toISOString() would roll back a day
  // in timezones behind UTC for local-midnight Dates like startOfMonth/startOfWeek.
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function startOfWeek(d: Date) {
  const date = new Date(d);
  const day = date.getDay();
  const diff = (day + 6) % 7; // Monday start
  date.setDate(date.getDate() - diff);
  date.setHours(0, 0, 0, 0);
  return date;
}

export function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

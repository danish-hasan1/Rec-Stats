import type { EntryView } from "@/types/db";

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
      t = { ...emptyTotals(), name, type, dealVendorSubs: 0 };
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

export function byRole(entries: EntryView[]) {
  const map = new Map<string, Totals & { id: string; name: string }>();
  for (const e of entries) {
    const t = map.get(e.role_id) ?? { ...emptyTotals(), id: e.role_id, name: e.role_name };
    addEntry(t, e);
    map.set(e.role_id, t);
  }
  return [...map.values()].sort((a, b) => b.totalSubs - a.totalSubs);
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

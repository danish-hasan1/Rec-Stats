"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
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
import { fetchEntries } from "@/lib/data/queries";
import { bySubmitter, sumEntries } from "@/lib/data/aggregate";
import type { EntryView } from "@/types/db";

function monthLabel(key: string) {
  const [y, m] = key.split("-");
  return new Date(Number(y), Number(m) - 1, 1).toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
  });
}

export default function SummaryPage() {
  const [entries, setEntries] = useState<EntryView[]>([]);
  const [loading, setLoading] = useState(true);
  const [month, setMonth] = useState<string>("");

  useEffect(() => {
    fetchEntries("2000-01-01", "2100-01-01")
      .then((e) => {
        setEntries(e);
        const current = new Date().toISOString().slice(0, 7);
        setMonth(current);
      })
      .catch((err) => {
        toast.error("Failed to load data");
        console.error(err);
      })
      .finally(() => setLoading(false));
  }, []);

  const months = useMemo(() => {
    const set = new Set(entries.map((e) => e.date.slice(0, 7)));
    set.add(new Date().toISOString().slice(0, 7));
    return [...set].sort().reverse();
  }, [entries]);

  const monthEntries = entries.filter((e) => e.date.startsWith(month));
  const rows = bySubmitter(monthEntries);
  const totals = sumEntries(monthEntries);
  const dealVendorTotal = rows.reduce((sum, r) => sum + r.dealVendorSubs, 0);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Monthly Summary</h1>
          <p className="text-sm text-muted-foreground">Per-submitter rollup, one month at a time.</p>
        </div>
        <Select value={month} onValueChange={setMonth}>
          <SelectTrigger className="w-52 glass">
            <SelectValue placeholder="Select month" />
          </SelectTrigger>
          <SelectContent>
            {months.map((m) => (
              <SelectItem key={m} value={m}>
                {monthLabel(m)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Card className="glass">
        <CardHeader>
          <CardTitle className="text-lg">{month && monthLabel(month)}</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">No entries for this month.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-right">Self Subs</TableHead>
                  <TableHead className="text-right">Deal Vendor Subs</TableHead>
                  <TableHead className="text-right">L1</TableHead>
                  <TableHead className="text-right">L2</TableHead>
                  <TableHead className="text-right">L3</TableHead>
                  <TableHead className="text-right">Total Subs</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.name}>
                    <TableCell className="font-medium">{r.name}</TableCell>
                    <TableCell className="capitalize text-muted-foreground">{r.type}</TableCell>
                    <TableCell className="text-right">
                      {r.type === "recruiter" ? r.recruiterSubs : r.vendorSubs}
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {r.type === "recruiter" ? r.dealVendorSubs || "—" : "—"}
                    </TableCell>
                    <TableCell className="text-right">{r.interviewL1 || "—"}</TableCell>
                    <TableCell className="text-right">{r.interviewL2 || "—"}</TableCell>
                    <TableCell className="text-right">{r.interviewL3 || "—"}</TableCell>
                    <TableCell className="text-right font-semibold">{r.totalSubs}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
              <TableFooter>
                <TableRow>
                  <TableCell colSpan={2}>Team Totals</TableCell>
                  <TableCell className="text-right">{totals.totalSubs}</TableCell>
                  <TableCell className="text-right">{dealVendorTotal || "—"}</TableCell>
                  <TableCell className="text-right">{totals.interviewL1}</TableCell>
                  <TableCell className="text-right">{totals.interviewL2}</TableCell>
                  <TableCell className="text-right">{totals.interviewL3}</TableCell>
                  <TableCell className="text-right">{totals.totalSubs}</TableCell>
                </TableRow>
              </TableFooter>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

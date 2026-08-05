"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { parsePastedBlock, type ParsedRow } from "@/lib/data/paste-parser";
import { fetchRoles, fetchSubmitters, upsertEntries, upsertRole, upsertSubmitter } from "@/lib/data/queries";
import type { Role, Submitter } from "@/types/db";
import { AlertTriangle, Sparkles } from "lucide-react";

const SAMPLE = `04/08/2026\t\t\t\t\nSource\tName\tRole\tSubmissions\tInterview\nrecruiter\tDinesh\tPython developer\t1\tL1\nrecruiter\tDinesh\tJava Developer\t2\t\nrecruiter\tDinesh\tMarketing Head\t1\t\nVendor\tAptask\tpython developer\t1\tL2\nVendor\tVedantix\tChange Manager\t\tL1`;

export default function ImportPage() {
  const [raw, setRaw] = useState("");
  const [date, setDate] = useState("");
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [submitters, setSubmitters] = useState<Submitter[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [committing, setCommitting] = useState(false);

  useEffect(() => {
    Promise.all([fetchSubmitters(), fetchRoles()])
      .then(([s, r]) => {
        setSubmitters(s);
        setRoles(r);
      })
      .catch((err) => console.error(err));
  }, []);

  const knownSubmitterKeys = useMemo(
    () => new Set(submitters.map((s) => `${s.type}:${s.name.toLowerCase()}`)),
    [submitters]
  );
  const knownRoleNames = useMemo(
    () => new Set(roles.map((r) => r.name.toLowerCase())),
    [roles]
  );

  function handleParse() {
    const result = parsePastedBlock(raw);
    setRows(result.rows);
    setWarnings(result.warnings);
    setDate(result.date ?? "");
    if (result.rows.length === 0) {
      toast.error("Nothing parsed — check the format.");
    } else {
      toast.success(`Parsed ${result.rows.length} row(s).`);
    }
  }

  async function handleCommit() {
    if (!date) {
      toast.error("Set a date before committing.");
      return;
    }
    if (rows.length === 0) {
      toast.error("Nothing to commit.");
      return;
    }
    setCommitting(true);
    try {
      const submitterCache = new Map<string, string>();
      const roleCache = new Map<string, string>();

      for (const row of rows) {
        const sKey = `${row.source}:${row.submitterName.toLowerCase()}`;
        if (!submitterCache.has(sKey)) {
          const s = await upsertSubmitter(row.submitterName, row.source);
          submitterCache.set(sKey, s.id);
        }
        const rKey = row.roleName.toLowerCase();
        if (!roleCache.has(rKey)) {
          const r = await upsertRole(row.roleName);
          roleCache.set(rKey, r.id);
        }
      }

      const payload = rows.map((row) => ({
        date,
        submitter_id: submitterCache.get(`${row.source}:${row.submitterName.toLowerCase()}`)!,
        role_id: roleCache.get(row.roleName.toLowerCase())!,
        submissions: row.submissions,
        interview_l1: row.interviewL1,
        interview_l2: row.interviewL2,
        interview_l3: row.interviewL3,
      }));

      await upsertEntries(payload);
      toast.success(`Imported ${payload.length} entries for ${date}.`);
      setRaw("");
      setRows([]);
      setWarnings([]);
      const [s, r] = await Promise.all([fetchSubmitters(), fetchRoles()]);
      setSubmitters(s);
      setRoles(r);
    } catch (err) {
      toast.error("Import failed");
      console.error(err);
    } finally {
      setCommitting(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <Card className="glass">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-xl">Paste Import</CardTitle>
          <Button variant="ghost" size="sm" onClick={() => setRaw(SAMPLE)}>
            <Sparkles className="mr-1 size-4" /> Load sample
          </Button>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <p className="text-sm text-muted-foreground">
            Paste the recruiter&rsquo;s report: an optional date line, then a header row
            (Source, Name, Role, Submissions, Interview) and data rows — tab-separated,
            same as pasted straight from Excel/Sheets.
          </p>
          <Textarea
            rows={10}
            value={raw}
            onChange={(e) => setRaw(e.target.value)}
            placeholder={SAMPLE}
            className="font-mono text-sm"
          />
          <Button onClick={handleParse} className="w-fit">
            Parse
          </Button>
        </CardContent>
      </Card>

      {(rows.length > 0 || warnings.length > 0) && (
        <Card className="glass">
          <CardHeader>
            <CardTitle className="text-lg">Preview</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="flex items-end gap-3">
              <div className="flex flex-col gap-1.5">
                <Label>Date</Label>
                <Input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-fit"
                />
              </div>
            </div>

            {warnings.length > 0 && (
              <div className="flex flex-col gap-1 rounded-lg border border-destructive/30 bg-destructive/5 p-3">
                {warnings.map((w, i) => (
                  <div key={i} className="flex items-start gap-2 text-sm text-destructive">
                    <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                    <span>{w}</span>
                  </div>
                ))}
              </div>
            )}

            {rows.length > 0 && (
              <>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Source</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead className="text-right">Submissions</TableHead>
                      <TableHead className="text-right">L1</TableHead>
                      <TableHead className="text-right">L2</TableHead>
                      <TableHead className="text-right">L3</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((row, i) => {
                      const isNewSubmitter = !knownSubmitterKeys.has(
                        `${row.source}:${row.submitterName.toLowerCase()}`
                      );
                      const isNewRole = !knownRoleNames.has(row.roleName.toLowerCase());
                      return (
                        <TableRow key={i}>
                          <TableCell>
                            <Badge variant={row.source === "recruiter" ? "default" : "secondary"}>
                              {row.source}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {row.submitterName}
                            {isNewSubmitter && (
                              <Badge variant="outline" className="ml-2 text-xs">
                                new
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            {row.roleName}
                            {isNewRole && (
                              <Badge variant="outline" className="ml-2 text-xs">
                                new
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-right">{row.submissions}</TableCell>
                          <TableCell className="text-right">{row.interviewL1 || "—"}</TableCell>
                          <TableCell className="text-right">{row.interviewL2 || "—"}</TableCell>
                          <TableCell className="text-right">{row.interviewL3 || "—"}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>

                <Button onClick={handleCommit} disabled={committing} className="w-fit">
                  {committing ? "Importing…" : `Confirm & import ${rows.length} entries`}
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

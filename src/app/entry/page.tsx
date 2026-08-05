"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Combobox } from "@/components/entry/combobox";
import {
  deleteEntry,
  fetchEntries,
  fetchRoles,
  fetchSubmitters,
  setRoleStatus,
  updateEntry,
  upsertEntries,
  upsertRole,
  upsertSubmitter,
} from "@/lib/data/queries";
import type { EntryView, Role, Submitter, SubmitterType } from "@/types/db";
import { AlertTriangle, Pencil, Trash2, X } from "lucide-react";
import { cn } from "@/lib/utils";

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export default function EntryPage() {
  const [submitters, setSubmitters] = useState<Submitter[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [entries, setEntries] = useState<EntryView[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [date, setDate] = useState(todayISO());
  const [submitterType, setSubmitterType] = useState<SubmitterType>("recruiter");
  const [submitterId, setSubmitterId] = useState<string | null>(null);
  const [roleId, setRoleId] = useState<string | null>(null);
  const [submissions, setSubmissions] = useState("0");
  const [interviewL1, setInterviewL1] = useState("0");
  const [interviewL2, setInterviewL2] = useState("0");
  const [interviewL3, setInterviewL3] = useState("0");
  const [dealRecruiterId, setDealRecruiterId] = useState<string | null>(null);
  const [markDeal, setMarkDeal] = useState(false);

  const pendingDeletes = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  async function reloadAll() {
    setLoading(true);
    try {
      const [s, r, e] = await Promise.all([
        fetchSubmitters(),
        fetchRoles(),
        fetchEntries("2000-01-01", "2100-01-01"),
      ]);
      setSubmitters(s);
      setRoles(r);
      setEntries(e);
    } catch (err) {
      toast.error("Failed to load data. Is local Supabase running?");
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial data fetch on mount
    reloadAll();
  }, []);

  // Flush any pending (undo-able) deletes if the user navigates away mid-window.
  useEffect(() => {
    const pending = pendingDeletes.current;
    return () => {
      pending.forEach((timeoutId) => clearTimeout(timeoutId));
    };
  }, []);

  const submitterOptions = useMemo(
    () =>
      submitters
        .filter((s) => s.type === submitterType)
        .map((s) => ({ value: s.id, label: s.name, hint: s.status === "inactive" ? "inactive" : undefined })),
    [submitters, submitterType]
  );

  const recruiterOptions = useMemo(
    () =>
      submitters
        .filter((s) => s.type === "recruiter")
        .map((s) => ({ value: s.id, label: s.name, hint: s.status === "inactive" ? "inactive" : undefined })),
    [submitters]
  );

  const roleOptions = useMemo(
    () => roles.map((r) => ({ value: r.id, label: r.name, hint: r.status !== "open" ? r.status : undefined })),
    [roles]
  );

  const dateEntries = entries.filter((e) => e.date === date);

  const duplicateEntry =
    !editingId && submitterId && roleId
      ? entries.find(
          (e) => e.date === date && e.submitter_id === submitterId && e.role_id === roleId
        )
      : undefined;

  function resetForm() {
    setEditingId(null);
    setSubmitterType("recruiter");
    setSubmitterId(null);
    setRoleId(null);
    setSubmissions("0");
    setInterviewL1("0");
    setInterviewL2("0");
    setInterviewL3("0");
    setDealRecruiterId(null);
    setMarkDeal(false);
  }

  function handleEdit(e: EntryView) {
    setEditingId(e.id);
    setDate(e.date);
    setSubmitterType(e.submitter_type);
    setSubmitterId(e.submitter_id);
    setRoleId(e.role_id);
    setSubmissions(String(e.submissions));
    setInterviewL1(String(e.interview_l1));
    setInterviewL2(String(e.interview_l2));
    setInterviewL3(String(e.interview_l3));
    setDealRecruiterId(e.deal_recruiter_id);
    setMarkDeal(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function handleCreateSubmitter(name: string) {
    try {
      const created = await upsertSubmitter(name, submitterType);
      setSubmitters((prev) => [...prev, created]);
      setSubmitterId(created.id);
      toast.success(`Added ${submitterType}: ${name}`);
    } catch (err) {
      toast.error("Could not create submitter");
      console.error(err);
    }
  }

  async function handleCreateRole(name: string) {
    try {
      const created = await upsertRole(name);
      setRoles((prev) => [...prev, created]);
      setRoleId(created.id);
      toast.success(`Added role: ${name}`);
    } catch (err) {
      toast.error("Could not create role");
      console.error(err);
    }
  }

  async function handleSubmit() {
    if (!submitterId || !roleId) {
      toast.error("Pick a submitter and role first.");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        date,
        submitter_id: submitterId,
        role_id: roleId,
        submissions: parseInt(submissions || "0", 10) || 0,
        interview_l1: parseInt(interviewL1 || "0", 10) || 0,
        interview_l2: parseInt(interviewL2 || "0", 10) || 0,
        interview_l3: parseInt(interviewL3 || "0", 10) || 0,
        deal_recruiter_id: submitterType === "vendor" ? dealRecruiterId : null,
      };

      if (editingId) {
        await updateEntry(editingId, payload);
      } else {
        await upsertEntries([payload]);
      }

      if (markDeal) {
        await setRoleStatus(roleId, "deal");
      }

      toast.success(
        markDeal
          ? `Entry ${editingId ? "updated" : "saved"}, role marked as deal`
          : `Entry ${editingId ? "updated" : "saved"}`
      );
      resetForm();
      await reloadAll();
    } catch (err) {
      toast.error("Save failed");
      console.error(err);
    } finally {
      setSaving(false);
    }
  }

  function handleDelete(id: string) {
    const entry = entries.find((e) => e.id === id);
    if (!entry) return;

    setEntries((prev) => prev.filter((e) => e.id !== id));
    if (editingId === id) resetForm();

    const timeoutId = setTimeout(async () => {
      pendingDeletes.current.delete(id);
      try {
        await deleteEntry(id);
      } catch (err) {
        toast.error("Delete failed — restoring row");
        console.error(err);
        setEntries((prev) => [...prev, entry]);
      }
    }, 5000);
    pendingDeletes.current.set(id, timeoutId);

    toast("Entry deleted", {
      duration: 5000,
      action: {
        label: "Undo",
        onClick: () => {
          const pending = pendingDeletes.current.get(id);
          if (pending) {
            clearTimeout(pending);
            pendingDeletes.current.delete(id);
          }
          setEntries((prev) => [...prev, entry]);
        },
      },
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <Card className="glass">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-xl">{editingId ? "Edit Entry" : "Daily Entry"}</CardTitle>
          {editingId && (
            <Button variant="ghost" size="sm" onClick={resetForm}>
              <X className="mr-1 size-4" /> Cancel edit
            </Button>
          )}
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div className="flex flex-col gap-1.5">
              <Label>Date</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label>Source</Label>
              <div className="flex gap-1 rounded-md border p-1">
                {(["recruiter", "vendor"] as SubmitterType[]).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => {
                      setSubmitterType(t);
                      setSubmitterId(null);
                      if (t === "recruiter") setDealRecruiterId(null);
                    }}
                    className={cn(
                      "flex-1 rounded px-3 py-1.5 text-sm capitalize transition-colors",
                      submitterType === t
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
              <Label>{submitterType === "recruiter" ? "Recruiter" : "Vendor"}</Label>
              <Combobox
                options={submitterOptions}
                value={submitterId}
                onChange={setSubmitterId}
                onCreate={handleCreateSubmitter}
                placeholder={`Select ${submitterType}…`}
                createLabel="Add"
              />
            </div>

            <div className="flex flex-col gap-1.5 sm:col-span-2">
              <Label>Role</Label>
              <Combobox
                options={roleOptions}
                value={roleId}
                onChange={setRoleId}
                onCreate={handleCreateRole}
                placeholder="Select role…"
                createLabel="Add role"
              />
              <label className="flex items-center gap-2 pt-1 text-sm text-muted-foreground">
                <Checkbox checked={markDeal} onCheckedChange={(v) => setMarkDeal(v === true)} />
                Mark role as deal (placement made) — sets role status to &ldquo;deal&rdquo;
              </label>
            </div>

            {submitterType === "vendor" && (
              <div className="flex flex-col gap-1.5">
                <Label>Deal recruiter (whose deal is this?)</Label>
                <Combobox
                  options={recruiterOptions}
                  value={dealRecruiterId}
                  onChange={setDealRecruiterId}
                  placeholder="Select recruiter…"
                />
              </div>
            )}

            <div className="flex flex-col gap-1.5">
              <Label>Submissions</Label>
              <Input
                type="number"
                min={0}
                value={submissions}
                onChange={(e) => setSubmissions(e.target.value)}
              />
            </div>

            <div className="flex flex-col gap-1.5 sm:col-span-2 lg:col-span-3">
              <Label>Interviews</Label>
              <div className="grid grid-cols-3 gap-3">
                <div className="flex items-center gap-2">
                  <span className="w-8 shrink-0 text-sm text-muted-foreground">L1</span>
                  <Input
                    type="number"
                    min={0}
                    value={interviewL1}
                    onChange={(e) => setInterviewL1(e.target.value)}
                  />
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-8 shrink-0 text-sm text-muted-foreground">L2</span>
                  <Input
                    type="number"
                    min={0}
                    value={interviewL2}
                    onChange={(e) => setInterviewL2(e.target.value)}
                  />
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-8 shrink-0 text-sm text-muted-foreground">L3</span>
                  <Input
                    type="number"
                    min={0}
                    value={interviewL3}
                    onChange={(e) => setInterviewL3(e.target.value)}
                  />
                </div>
              </div>
            </div>
          </div>

          {duplicateEntry && (
            <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-sm text-amber-600 dark:text-amber-400">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" />
              <span>
                An entry already exists for this date, submitter, and role
                ({duplicateEntry.submissions} subs, L1 {duplicateEntry.interview_l1} / L2{" "}
                {duplicateEntry.interview_l2} / L3 {duplicateEntry.interview_l3}). Saving will
                overwrite it — edit that row instead if you didn&rsquo;t mean to replace it.
              </span>
            </div>
          )}

          <Button onClick={handleSubmit} disabled={saving} className="w-fit">
            {saving ? "Saving…" : editingId ? "Update entry" : "Save entry"}
          </Button>
        </CardContent>
      </Card>

      <Card className="glass">
        <CardHeader>
          <CardTitle className="text-lg">Entries for {date}</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : dateEntries.length === 0 ? (
            <p className="text-sm text-muted-foreground">No entries yet for this date.</p>
          ) : (
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
                  <TableHead>Deal recruiter</TableHead>
                  <TableHead className="w-20" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {dateEntries.map((e) => (
                  <TableRow key={e.id} className={cn(editingId === e.id && "bg-accent/50")}>
                    <TableCell>
                      <Badge variant={e.submitter_type === "recruiter" ? "default" : "secondary"}>
                        {e.submitter_type}
                      </Badge>
                    </TableCell>
                    <TableCell>{e.submitter_name}</TableCell>
                    <TableCell>{e.role_name}</TableCell>
                    <TableCell className="text-right">{e.submissions}</TableCell>
                    <TableCell className="text-right">{e.interview_l1 || "—"}</TableCell>
                    <TableCell className="text-right">{e.interview_l2 || "—"}</TableCell>
                    <TableCell className="text-right">{e.interview_l3 || "—"}</TableCell>
                    <TableCell className="text-muted-foreground">{e.deal_recruiter_name ?? "—"}</TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleEdit(e)}
                          aria-label="Edit entry"
                        >
                          <Pencil className="size-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(e.id)}
                          aria-label="Delete entry"
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

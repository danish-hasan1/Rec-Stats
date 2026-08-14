"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Combobox, type ComboboxOption } from "@/components/entry/combobox";
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
import { AlertTriangle, Check, Plus, RotateCcw, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

type RowState = {
  key: string;
  entryId: string | null;
  submitterType: SubmitterType;
  submitterId: string | null;
  roleId: string | null;
  submissions: string;
  interviewL1: string;
  interviewL2: string;
  interviewL3: string;
  dealRecruiterId: string | null;
  markDeal: boolean;
};

function emptyRow(key: string): RowState {
  return {
    key,
    entryId: null,
    submitterType: "recruiter",
    submitterId: null,
    roleId: null,
    submissions: "",
    interviewL1: "",
    interviewL2: "",
    interviewL3: "",
    dealRecruiterId: null,
    markDeal: false,
  };
}

function rowFromEntry(e: EntryView): RowState {
  return {
    key: e.id,
    entryId: e.id,
    submitterType: e.submitter_type,
    submitterId: e.submitter_id,
    roleId: e.role_id,
    submissions: String(e.submissions),
    interviewL1: String(e.interview_l1),
    interviewL2: String(e.interview_l2),
    interviewL3: String(e.interview_l3),
    dealRecruiterId: e.deal_recruiter_id,
    markDeal: false,
  };
}

let draftCounter = 0;
function newDraftKey() {
  draftCounter += 1;
  return `draft-${Date.now()}-${draftCounter}`;
}

function GridRow({
  row,
  isNew,
  dirty,
  saving,
  duplicate,
  recruiterOptions,
  vendorOptions,
  roleOptions,
  onChange,
  onSave,
  onDiscard,
  onDelete,
  onCreateSubmitter,
  onCreateRole,
}: {
  row: RowState;
  isNew: boolean;
  dirty: boolean;
  saving: boolean;
  duplicate: boolean;
  recruiterOptions: ComboboxOption[];
  vendorOptions: ComboboxOption[];
  roleOptions: ComboboxOption[];
  onChange: (patch: Partial<RowState>) => void;
  onSave: () => void;
  onDiscard: () => void;
  onDelete: () => void;
  onCreateSubmitter: (name: string, type: SubmitterType) => void;
  onCreateRole: (name: string) => void;
}) {
  const submitterOptions = row.submitterType === "recruiter" ? recruiterOptions : vendorOptions;
  const showActions = isNew || dirty;

  return (
    <TableRow className={cn(isNew && "bg-primary/5", dirty && !isNew && "bg-accent/40")}>
      <TableCell>
        <div className="flex gap-1 rounded-md border p-0.5">
          {(["recruiter", "vendor"] as SubmitterType[]).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => onChange({ submitterType: t, submitterId: null, dealRecruiterId: null })}
              className={cn(
                "flex-1 rounded px-2 py-1 text-xs capitalize transition-colors",
                row.submitterType === t ? "bg-primary text-primary-foreground" : "hover:bg-accent"
              )}
            >
              {t === "recruiter" ? "Rec" : "Ven"}
            </button>
          ))}
        </div>
      </TableCell>
      <TableCell className="min-w-[170px]">
        <Combobox
          options={submitterOptions}
          value={row.submitterId}
          onChange={(v) => onChange({ submitterId: v })}
          onCreate={(name) => onCreateSubmitter(name, row.submitterType)}
          placeholder={row.submitterType === "recruiter" ? "Select recruiter…" : "Select vendor…"}
          createLabel="Add"
        />
      </TableCell>
      <TableCell className="min-w-[200px]">
        <div className="flex items-center gap-1.5">
          <Combobox
            options={roleOptions}
            value={row.roleId}
            onChange={(v) => onChange({ roleId: v })}
            onCreate={onCreateRole}
            placeholder="Select role…"
            createLabel="Add role"
          />
          {duplicate && (
            <AlertTriangle
              className="size-4 shrink-0 text-amber-500"
              aria-label="Duplicate entry for this submitter and role"
            >
              <title>Already an entry for this submitter and role today — edit that row instead.</title>
            </AlertTriangle>
          )}
        </div>
      </TableCell>
      <TableCell className="w-20">
        <Input
          type="number"
          min={0}
          value={row.submissions}
          onChange={(e) => onChange({ submissions: e.target.value })}
          className="text-right"
        />
      </TableCell>
      <TableCell className="w-16">
        <Input
          type="number"
          min={0}
          value={row.interviewL1}
          onChange={(e) => onChange({ interviewL1: e.target.value })}
          className="text-right"
        />
      </TableCell>
      <TableCell className="w-16">
        <Input
          type="number"
          min={0}
          value={row.interviewL2}
          onChange={(e) => onChange({ interviewL2: e.target.value })}
          className="text-right"
        />
      </TableCell>
      <TableCell className="w-16">
        <Input
          type="number"
          min={0}
          value={row.interviewL3}
          onChange={(e) => onChange({ interviewL3: e.target.value })}
          className="text-right"
        />
      </TableCell>
      <TableCell className="min-w-[160px]">
        {row.submitterType === "vendor" ? (
          <Combobox
            options={recruiterOptions}
            value={row.dealRecruiterId}
            onChange={(v) => onChange({ dealRecruiterId: v })}
            placeholder="Deal recruiter…"
          />
        ) : (
          <span className="text-sm text-muted-foreground">—</span>
        )}
      </TableCell>
      <TableCell className="w-16 text-center">
        <Checkbox
          checked={row.markDeal}
          onCheckedChange={(v) => onChange({ markDeal: v === true })}
          aria-label="Mark role as deal"
          title="Mark role as deal (placement made)"
        />
      </TableCell>
      <TableCell className="w-24">
        <div className="flex justify-end gap-1">
          {showActions && (
            <Button
              variant="ghost"
              size="icon"
              onClick={onSave}
              disabled={saving || duplicate}
              aria-label="Save row"
              title="Save"
            >
              <Check className="size-4" />
            </Button>
          )}
          {!isNew && dirty && (
            <Button variant="ghost" size="icon" onClick={onDiscard} aria-label="Discard changes" title="Discard changes">
              <RotateCcw className="size-4" />
            </Button>
          )}
          <Button variant="ghost" size="icon" onClick={onDelete} aria-label={isNew ? "Remove row" : "Delete entry"} title={isNew ? "Remove row" : "Delete"}>
            <Trash2 className="size-4" />
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
}

export default function EntryPage() {
  const [submitters, setSubmitters] = useState<Submitter[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [entries, setEntries] = useState<EntryView[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingKeys, setSavingKeys] = useState<Set<string>>(new Set());

  const [date, setDate] = useState(todayISO());
  const [drafts, setDrafts] = useState<RowState[]>([]);
  const [savedEdits, setSavedEdits] = useState<Map<string, RowState>>(new Map());

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

  // Switching dates drops unsaved drafts/edits — they belong to the day being left.
  function handleDateChange(next: string) {
    setDate(next);
    setDrafts([]);
    setSavedEdits(new Map());
  }

  const dateEntries = useMemo(
    () =>
      entries
        .filter((e) => e.date === date)
        .sort((a, b) => a.submitter_name.localeCompare(b.submitter_name)),
    [entries, date]
  );

  const recruiterOptions = useMemo(
    () =>
      submitters
        .filter((s) => s.type === "recruiter")
        .map((s) => ({ value: s.id, label: s.name, hint: s.status === "inactive" ? "inactive" : undefined })),
    [submitters]
  );
  const vendorOptions = useMemo(
    () =>
      submitters
        .filter((s) => s.type === "vendor")
        .map((s) => ({ value: s.id, label: s.name, hint: s.status === "inactive" ? "inactive" : undefined })),
    [submitters]
  );
  const roleOptions = useMemo(
    () => roles.map((r) => ({ value: r.id, label: r.name, hint: r.status !== "open" ? r.status : undefined })),
    [roles]
  );

  function addDraftRow() {
    setDrafts((prev) => [...prev, emptyRow(newDraftKey())]);
  }

  function updateDraft(key: string, patch: Partial<RowState>) {
    setDrafts((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }

  function removeDraft(key: string) {
    setDrafts((prev) => prev.filter((r) => r.key !== key));
  }

  function updateSaved(entryId: string, patch: Partial<RowState>) {
    setSavedEdits((prev) => {
      const next = new Map(prev);
      const original = dateEntries.find((e) => e.id === entryId);
      if (!original) return prev;
      const base = next.get(entryId) ?? rowFromEntry(original);
      next.set(entryId, { ...base, ...patch });
      return next;
    });
  }

  function revertSaved(entryId: string) {
    setSavedEdits((prev) => {
      const next = new Map(prev);
      next.delete(entryId);
      return next;
    });
  }

  function isDirty(entryId: string) {
    const edited = savedEdits.get(entryId);
    const original = dateEntries.find((e) => e.id === entryId);
    if (!edited || !original) return false;
    return (
      edited.submitterType !== original.submitter_type ||
      edited.submitterId !== original.submitter_id ||
      edited.roleId !== original.role_id ||
      edited.submissions !== String(original.submissions) ||
      edited.interviewL1 !== String(original.interview_l1) ||
      edited.interviewL2 !== String(original.interview_l2) ||
      edited.interviewL3 !== String(original.interview_l3) ||
      edited.dealRecruiterId !== original.deal_recruiter_id ||
      edited.markDeal
    );
  }

  function duplicateOf(row: RowState) {
    if (!row.submitterId || !row.roleId) return false;
    return dateEntries.some(
      (e) => e.id !== row.entryId && e.submitter_id === row.submitterId && e.role_id === row.roleId
    );
  }

  async function saveRow(row: RowState, isNew: boolean) {
    if (!row.submitterId || !row.roleId) {
      toast.error("Pick a submitter and role first.");
      return;
    }
    if (duplicateOf(row)) {
      toast.error("An entry already exists for this submitter and role today — edit that row instead.");
      return;
    }

    const payload = {
      date,
      submitter_id: row.submitterId,
      role_id: row.roleId,
      submissions: parseInt(row.submissions || "0", 10) || 0,
      interview_l1: parseInt(row.interviewL1 || "0", 10) || 0,
      interview_l2: parseInt(row.interviewL2 || "0", 10) || 0,
      interview_l3: parseInt(row.interviewL3 || "0", 10) || 0,
      deal_recruiter_id: row.submitterType === "vendor" ? row.dealRecruiterId : null,
    };

    const isBlank =
      payload.submissions === 0 &&
      payload.interview_l1 === 0 &&
      payload.interview_l2 === 0 &&
      payload.interview_l3 === 0;
    if (isBlank && !row.markDeal) {
      toast.error("Nothing to save — enter submissions or an interview count.");
      return;
    }

    setSavingKeys((prev) => new Set(prev).add(row.key));
    try {
      if (row.entryId) {
        await updateEntry(row.entryId, payload);
      } else {
        await upsertEntries([payload]);
      }
      if (row.markDeal) {
        // Credit the deal to whoever actually gets credit for it: the vendor's
        // deal recruiter when one's set, otherwise the submitter themselves.
        const closedById = row.submitterType === "vendor" && row.dealRecruiterId ? row.dealRecruiterId : row.submitterId;
        await setRoleStatus(row.roleId, "deal", closedById);
      }
      toast.success(row.markDeal ? "Saved, role marked as deal" : "Saved");
      if (isNew) removeDraft(row.key);
      else revertSaved(row.entryId!);
      await reloadAll();
    } catch (err) {
      toast.error("Save failed");
      console.error(err);
    } finally {
      setSavingKeys((prev) => {
        const next = new Set(prev);
        next.delete(row.key);
        return next;
      });
    }
  }

  async function handleCreateSubmitter(name: string, type: SubmitterType, key: string, isNew: boolean) {
    try {
      const created = await upsertSubmitter(name, type);
      setSubmitters((prev) => [...prev, created]);
      if (isNew) updateDraft(key, { submitterId: created.id });
      else updateSaved(key, { submitterId: created.id });
      toast.success(`Added ${type}: ${name}`);
    } catch (err) {
      toast.error("Could not create submitter");
      console.error(err);
    }
  }

  async function handleCreateRole(name: string, key: string, isNew: boolean) {
    try {
      const created = await upsertRole(name);
      setRoles((prev) => [...prev, created]);
      if (isNew) updateDraft(key, { roleId: created.id });
      else updateSaved(key, { roleId: created.id });
      toast.success(`Added role: ${name}`);
    } catch (err) {
      toast.error("Could not create role");
      console.error(err);
    }
  }

  function handleDelete(id: string) {
    const entry = entries.find((e) => e.id === id);
    if (!entry) return;

    setEntries((prev) => prev.filter((e) => e.id !== id));
    revertSaved(id);

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

  const totalRows = dateEntries.length + drafts.length;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Daily Entry</h1>
          <p className="text-sm text-muted-foreground">
            Pick a date, then add or edit rows directly in the grid — no separate form.
          </p>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label>Date</Label>
          <Input type="date" value={date} onChange={(e) => handleDateChange(e.target.value)} className="w-44" />
        </div>
      </div>

      <Card className="glass">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg">Entries for {date}</CardTitle>
          <Button size="sm" onClick={addDraftRow}>
            <Plus className="mr-1 size-4" /> Add row
          </Button>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : totalRows === 0 ? (
            <p className="text-sm text-muted-foreground">
              No entries yet for this date — click &ldquo;Add row&rdquo; to start.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-24">Source</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead className="text-right">Subs</TableHead>
                    <TableHead className="text-right">L1</TableHead>
                    <TableHead className="text-right">L2</TableHead>
                    <TableHead className="text-right">L3</TableHead>
                    <TableHead>Deal recruiter</TableHead>
                    <TableHead className="text-center">Deal</TableHead>
                    <TableHead className="w-24" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {dateEntries.map((e) => {
                    const row = savedEdits.get(e.id) ?? rowFromEntry(e);
                    return (
                      <GridRow
                        key={e.id}
                        row={row}
                        isNew={false}
                        dirty={isDirty(e.id)}
                        saving={savingKeys.has(row.key)}
                        duplicate={duplicateOf(row)}
                        recruiterOptions={recruiterOptions}
                        vendorOptions={vendorOptions}
                        roleOptions={roleOptions}
                        onChange={(patch) => updateSaved(e.id, patch)}
                        onSave={() => saveRow(row, false)}
                        onDiscard={() => revertSaved(e.id)}
                        onDelete={() => handleDelete(e.id)}
                        onCreateSubmitter={(name, type) => handleCreateSubmitter(name, type, e.id, false)}
                        onCreateRole={(name) => handleCreateRole(name, e.id, false)}
                      />
                    );
                  })}
                  {drafts.map((row) => (
                    <GridRow
                      key={row.key}
                      row={row}
                      isNew
                      dirty={false}
                      saving={savingKeys.has(row.key)}
                      duplicate={duplicateOf(row)}
                      recruiterOptions={recruiterOptions}
                      vendorOptions={vendorOptions}
                      roleOptions={roleOptions}
                      onChange={(patch) => updateDraft(row.key, patch)}
                      onSave={() => saveRow(row, true)}
                      onDiscard={() => {}}
                      onDelete={() => removeDraft(row.key)}
                      onCreateSubmitter={(name, type) => handleCreateSubmitter(name, type, row.key, true)}
                      onCreateRole={(name) => handleCreateRole(name, row.key, true)}
                    />
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

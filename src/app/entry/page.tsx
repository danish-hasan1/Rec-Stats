"use client";

import { useState } from "react";
import { toast } from "sonner";
import { useEffect, useMemo, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
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
import { AlertTriangle, Check, Plus, RotateCcw, Trash2, UserRound } from "lucide-react";
import { cn } from "@/lib/utils";

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function hasDuplicate(
  dateEntries: EntryView[],
  submitterId: string | null,
  roleId: string | null,
  excludeEntryId?: string | null
) {
  if (!submitterId || !roleId) return false;
  return dateEntries.some(
    (e) => e.id !== excludeEntryId && e.submitter_id === submitterId && e.role_id === roleId
  );
}

let draftCounter = 0;
function newDraftKey() {
  draftCounter += 1;
  return `draft-${Date.now()}-${draftCounter}`;
}

// ---------- Grid row (editing an already-saved entry in place) ----------

type RowState = {
  key: string;
  entryId: string;
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

function GridRow({
  row,
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

  return (
    <TableRow className={cn(dirty && "bg-accent/40")}>
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
            <AlertTriangle className="size-4 shrink-0 text-amber-500" aria-label="Duplicate entry">
              <title>Already an entry for this submitter and role today.</title>
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
          {dirty && (
            <Button variant="ghost" size="icon" onClick={onSave} disabled={saving || duplicate} aria-label="Save row" title="Save">
              <Check className="size-4" />
            </Button>
          )}
          {dirty && (
            <Button variant="ghost" size="icon" onClick={onDiscard} aria-label="Discard changes" title="Discard changes">
              <RotateCcw className="size-4" />
            </Button>
          )}
          <Button variant="ghost" size="icon" onClick={onDelete} aria-label="Delete entry" title="Delete">
            <Trash2 className="size-4" />
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
}

// ---------- Quick Entry modal (one recruiter/vendor at a time, then next) ----------

type QuickRow = {
  key: string;
  roleId: string | null;
  submissions: string;
  interviewL1: string;
  interviewL2: string;
  interviewL3: string;
  markDeal: boolean;
};

function emptyQuickRow(key: string): QuickRow {
  return { key, roleId: null, submissions: "", interviewL1: "", interviewL2: "", interviewL3: "", markDeal: false };
}

type QuickEntryState = {
  submitterType: SubmitterType;
  submitterId: string | null;
  dealRecruiterId: string | null;
  rows: QuickRow[];
};

function freshQuickEntry(): QuickEntryState {
  return {
    submitterType: "recruiter",
    submitterId: null,
    dealRecruiterId: null,
    rows: [emptyQuickRow(newDraftKey())],
  };
}

function QuickEntryDialog({
  state,
  date,
  dateEntries,
  saving,
  recruiterOptions,
  vendorOptions,
  roleOptions,
  submitters,
  onChange,
  onClose,
  onSave,
  onCreateSubmitter,
  onCreateRole,
}: {
  state: QuickEntryState;
  date: string;
  dateEntries: EntryView[];
  saving: boolean;
  recruiterOptions: ComboboxOption[];
  vendorOptions: ComboboxOption[];
  roleOptions: ComboboxOption[];
  submitters: Submitter[];
  onChange: (patch: Partial<QuickEntryState>) => void;
  onClose: () => void;
  onSave: () => void;
  onCreateSubmitter: (name: string, type: SubmitterType) => Promise<Submitter | null>;
  onCreateRole: (name: string) => Promise<Role | null>;
}) {
  const selected = submitters.find((s) => s.id === state.submitterId);
  const submitterOptions = state.submitterType === "recruiter" ? recruiterOptions : vendorOptions;

  function updateRow(key: string, patch: Partial<QuickRow>) {
    onChange({ rows: state.rows.map((r) => (r.key === key ? { ...r, ...patch } : r)) });
  }

  function addRow() {
    onChange({ rows: [...state.rows, emptyQuickRow(newDraftKey())] });
  }

  function removeRow(key: string) {
    onChange({ rows: state.rows.filter((r) => r.key !== key) });
  }

  function rowDuplicate(row: QuickRow) {
    if (!row.roleId) return false;
    if (hasDuplicate(dateEntries, state.submitterId, row.roleId)) return true;
    return state.rows.some((r) => r.key !== row.key && r.roleId === row.roleId);
  }

  return (
    <DialogContent className="glass-strong flex max-h-[92vh] w-[95vw] max-w-2xl flex-col overflow-y-auto sm:max-w-2xl">
      <DialogHeader>
        <div className="flex flex-wrap items-start justify-between gap-4 pr-6">
          <div>
            <DialogTitle>Add Entries</DialogTitle>
            <DialogDescription>{date}</DialogDescription>
          </div>

          {state.submitterId ? (
            <div className="flex flex-col items-end gap-1">
              <span className="text-xs text-muted-foreground">Entries for</span>
              <div className="flex items-center gap-2">
                <span className="flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-sm font-semibold text-primary">
                  <UserRound className="size-3.5" />
                  {selected?.name ?? "…"}
                  <span className="font-normal capitalize text-primary/70">({state.submitterType})</span>
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onChange({ submitterId: null, dealRecruiterId: null, rows: [emptyQuickRow(newDraftKey())] })}
                >
                  Change
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex w-64 flex-col items-end gap-1.5">
              <div className="flex gap-1 self-end rounded-md border p-0.5">
                {(["recruiter", "vendor"] as SubmitterType[]).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => onChange({ submitterType: t })}
                    className={cn(
                      "flex-1 rounded px-2 py-1 text-xs capitalize transition-colors",
                      state.submitterType === t ? "bg-primary text-primary-foreground" : "hover:bg-accent"
                    )}
                  >
                    {t}
                  </button>
                ))}
              </div>
              <Combobox
                options={submitterOptions}
                value={state.submitterId}
                onChange={(v) => onChange({ submitterId: v })}
                onCreate={async (name) => {
                  const created = await onCreateSubmitter(name, state.submitterType);
                  if (created) onChange({ submitterId: created.id });
                }}
                placeholder={state.submitterType === "recruiter" ? "Select recruiter…" : "Select vendor…"}
                createLabel="Add"
              />
            </div>
          )}
        </div>
      </DialogHeader>

      {state.submitterId ? (
        <div className="flex flex-col gap-4">
          {state.submitterType === "vendor" && (
            <div className="flex flex-col gap-1.5">
              <Label>Deal recruiter (whose deal is this?)</Label>
              <Combobox
                options={recruiterOptions}
                value={state.dealRecruiterId}
                onChange={(v) => onChange({ dealRecruiterId: v })}
                placeholder="Select recruiter…"
              />
            </div>
          )}

          <div className="flex flex-col gap-2">
            {state.rows.map((row, i) => {
              const duplicate = rowDuplicate(row);
              return (
                <div key={row.key} className="flex flex-col gap-2 rounded-lg border p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-muted-foreground">Role #{i + 1}</span>
                    {state.rows.length > 1 && (
                      <Button variant="ghost" size="icon" onClick={() => removeRow(row.key)} aria-label="Remove role">
                        <Trash2 className="size-4" />
                      </Button>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Combobox
                      options={roleOptions}
                      value={row.roleId}
                      onChange={(v) => updateRow(row.key, { roleId: v })}
                      onCreate={async (name) => {
                        const created = await onCreateRole(name);
                        if (created) updateRow(row.key, { roleId: created.id });
                      }}
                      placeholder="Select role…"
                      createLabel="Add role"
                    />
                    {duplicate && (
                      <AlertTriangle className="size-4 shrink-0 text-amber-500" aria-label="Duplicate role">
                        <title>Already entered (or picked twice above) for this recruiter today.</title>
                      </AlertTriangle>
                    )}
                  </div>
                  <div className="grid grid-cols-4 gap-2">
                    <div className="flex items-center gap-1.5">
                      <span className="w-10 shrink-0 text-xs text-muted-foreground">Subs</span>
                      <Input
                        type="number"
                        min={0}
                        value={row.submissions}
                        onChange={(e) => updateRow(row.key, { submissions: e.target.value })}
                      />
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="w-8 shrink-0 text-xs text-muted-foreground">L1</span>
                      <Input
                        type="number"
                        min={0}
                        value={row.interviewL1}
                        onChange={(e) => updateRow(row.key, { interviewL1: e.target.value })}
                      />
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="w-8 shrink-0 text-xs text-muted-foreground">L2</span>
                      <Input
                        type="number"
                        min={0}
                        value={row.interviewL2}
                        onChange={(e) => updateRow(row.key, { interviewL2: e.target.value })}
                      />
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="w-8 shrink-0 text-xs text-muted-foreground">L3</span>
                      <Input
                        type="number"
                        min={0}
                        value={row.interviewL3}
                        onChange={(e) => updateRow(row.key, { interviewL3: e.target.value })}
                      />
                    </div>
                  </div>
                  <label className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Checkbox
                      checked={row.markDeal}
                      onCheckedChange={(v) => updateRow(row.key, { markDeal: v === true })}
                    />
                    Mark role as deal (placement made)
                  </label>
                </div>
              );
            })}
          </div>

          <Button variant="outline" size="sm" onClick={addRow} className="w-fit">
            <Plus className="mr-1 size-4" /> Add another role
          </Button>
        </div>
      ) : (
        <p className="py-6 text-center text-sm text-muted-foreground">
          Pick a recruiter or vendor above to start entering their roles for the day.
        </p>
      )}

      <DialogFooter>
        <Button variant="outline" onClick={onClose}>
          Done
        </Button>
        <Button onClick={onSave} disabled={!state.submitterId || saving}>
          {saving ? "Saving…" : "Save entries"}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}

// ---------- Page ----------

export default function EntryPage() {
  const [submitters, setSubmitters] = useState<Submitter[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [entries, setEntries] = useState<EntryView[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingKeys, setSavingKeys] = useState<Set<string>>(new Set());
  const [quickSaving, setQuickSaving] = useState(false);

  const [date, setDate] = useState(todayISO());
  const [savedEdits, setSavedEdits] = useState<Map<string, RowState>>(new Map());
  const [quickEntry, setQuickEntry] = useState<QuickEntryState | null>(null);

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

  // Switching dates drops unsaved edits/the quick-entry session — they belong to the day being left.
  function handleDateChange(next: string) {
    setDate(next);
    setSavedEdits(new Map());
    setQuickEntry(null);
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

  async function createSubmitter(name: string, type: SubmitterType): Promise<Submitter | null> {
    try {
      const created = await upsertSubmitter(name, type);
      setSubmitters((prev) => [...prev, created]);
      toast.success(`Added ${type}: ${name}`);
      return created;
    } catch (err) {
      toast.error("Could not create submitter");
      console.error(err);
      return null;
    }
  }

  async function createRole(name: string): Promise<Role | null> {
    try {
      const created = await upsertRole(name);
      setRoles((prev) => [...prev, created]);
      toast.success(`Added role: ${name}`);
      return created;
    } catch (err) {
      toast.error("Could not create role");
      console.error(err);
      return null;
    }
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

  async function saveEditedRow(row: RowState) {
    if (!row.submitterId || !row.roleId) {
      toast.error("Pick a submitter and role first.");
      return;
    }
    if (hasDuplicate(dateEntries, row.submitterId, row.roleId, row.entryId)) {
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
      await updateEntry(row.entryId, payload);
      if (row.markDeal) {
        const closedById = row.submitterType === "vendor" && row.dealRecruiterId ? row.dealRecruiterId : row.submitterId;
        await setRoleStatus(row.roleId, "deal", closedById);
      }
      toast.success(row.markDeal ? "Saved, role marked as deal" : "Saved");
      revertSaved(row.entryId);
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

  function requestCloseQuickEntry() {
    if (!quickEntry) return;
    const hasUnsavedInput =
      quickEntry.submitterId !== null &&
      quickEntry.rows.some((r) => r.roleId || r.submissions || r.interviewL1 || r.interviewL2 || r.interviewL3);
    if (hasUnsavedInput && !window.confirm("Discard unsaved entries for this recruiter?")) return;
    setQuickEntry(null);
  }

  async function handleSaveQuickEntry() {
    if (!quickEntry?.submitterId) return;
    const { submitterType, submitterId, dealRecruiterId, rows } = quickEntry;

    const roleIdsSeen = new Set<string>();
    for (const row of rows) {
      if (row.roleId && roleIdsSeen.has(row.roleId)) {
        toast.error("The same role is picked twice — remove one before saving.");
        return;
      }
      if (row.roleId) roleIdsSeen.add(row.roleId);
    }
    for (const row of rows) {
      if (row.roleId && hasDuplicate(dateEntries, submitterId, row.roleId)) {
        toast.error("One of these roles already has an entry today for this recruiter — edit it in the grid below instead.");
        return;
      }
    }

    const dealActions: { roleId: string; closedById: string }[] = [];
    const payloads = rows.flatMap((row) => {
      if (!row.roleId) return [];
      const submissions = parseInt(row.submissions || "0", 10) || 0;
      const interview_l1 = parseInt(row.interviewL1 || "0", 10) || 0;
      const interview_l2 = parseInt(row.interviewL2 || "0", 10) || 0;
      const interview_l3 = parseInt(row.interviewL3 || "0", 10) || 0;
      const isBlank = submissions === 0 && interview_l1 === 0 && interview_l2 === 0 && interview_l3 === 0;
      if (isBlank && !row.markDeal) return [];

      if (row.markDeal) {
        const closedById = submitterType === "vendor" && dealRecruiterId ? dealRecruiterId : submitterId;
        dealActions.push({ roleId: row.roleId, closedById });
      }

      return [
        {
          date,
          submitter_id: submitterId,
          role_id: row.roleId,
          submissions,
          interview_l1,
          interview_l2,
          interview_l3,
          deal_recruiter_id: submitterType === "vendor" ? dealRecruiterId : null,
        },
      ];
    });

    if (payloads.length === 0) {
      toast.error("Nothing to save — pick a role and enter submissions or an interview count.");
      return;
    }

    setQuickSaving(true);
    try {
      await upsertEntries(payloads);
      for (const action of dealActions) {
        await setRoleStatus(action.roleId, "deal", action.closedById);
      }
      const name = submitters.find((s) => s.id === submitterId)?.name ?? "recruiter";
      toast.success(`Saved ${payloads.length} ${payloads.length === 1 ? "entry" : "entries"} for ${name}`);
      await reloadAll();
      setQuickEntry(freshQuickEntry());
    } catch (err) {
      toast.error("Save failed");
      console.error(err);
    } finally {
      setQuickSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Daily Entry</h1>
          <p className="text-sm text-muted-foreground">
            Add entries recruiter-by-recruiter in the popup, or edit any saved row directly below.
          </p>
        </div>
        <div className="flex items-end gap-3">
          <div className="flex flex-col gap-1.5">
            <Label>Date</Label>
            <Input type="date" value={date} onChange={(e) => handleDateChange(e.target.value)} className="w-44" />
          </div>
          <Button onClick={() => setQuickEntry(freshQuickEntry())}>
            <Plus className="mr-1 size-4" /> Add entry
          </Button>
        </div>
      </div>

      <Card className="glass">
        <CardHeader>
          <CardTitle className="text-lg">Entries for {date}</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : dateEntries.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No entries yet for this date — click &ldquo;Add entry&rdquo; to start.
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
                        dirty={isDirty(e.id)}
                        saving={savingKeys.has(row.key)}
                        duplicate={hasDuplicate(dateEntries, row.submitterId, row.roleId, row.entryId)}
                        recruiterOptions={recruiterOptions}
                        vendorOptions={vendorOptions}
                        roleOptions={roleOptions}
                        onChange={(patch) => updateSaved(e.id, patch)}
                        onSave={() => saveEditedRow(savedEdits.get(e.id) ?? rowFromEntry(e))}
                        onDiscard={() => revertSaved(e.id)}
                        onDelete={() => handleDelete(e.id)}
                        onCreateSubmitter={async (name, type) => {
                          const created = await createSubmitter(name, type);
                          if (created) updateSaved(e.id, { submitterId: created.id });
                        }}
                        onCreateRole={async (name) => {
                          const created = await createRole(name);
                          if (created) updateSaved(e.id, { roleId: created.id });
                        }}
                      />
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={quickEntry !== null} onOpenChange={(open) => !open && requestCloseQuickEntry()}>
        {quickEntry && (
          <QuickEntryDialog
            state={quickEntry}
            date={date}
            dateEntries={dateEntries}
            saving={quickSaving}
            recruiterOptions={recruiterOptions}
            vendorOptions={vendorOptions}
            roleOptions={roleOptions}
            submitters={submitters}
            onChange={(patch) => setQuickEntry((prev) => (prev ? { ...prev, ...patch } : prev))}
            onClose={requestCloseQuickEntry}
            onSave={handleSaveQuickEntry}
            onCreateSubmitter={createSubmitter}
            onCreateRole={createRole}
          />
        )}
      </Dialog>
    </div>
  );
}

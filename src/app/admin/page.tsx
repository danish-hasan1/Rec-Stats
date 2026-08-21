"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
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
import { Combobox } from "@/components/entry/combobox";
import {
  deleteRole,
  fetchRoles,
  fetchSubmitters,
  setRoleStatus,
  setSubmitterStatus,
  updateRoleClient,
  upsertRole,
  upsertSubmitter,
} from "@/lib/data/queries";
import { ROLE_STATUSES, roleStatusVariant } from "@/lib/data/role-status";
import type { RoleStatus, RoleView, Submitter, SubmitterType } from "@/types/db";
import { Trash2 } from "lucide-react";

export default function AdminPage() {
  const [submitters, setSubmitters] = useState<Submitter[]>([]);
  const [roles, setRoles] = useState<RoleView[]>([]);
  const [newSubmitterName, setNewSubmitterName] = useState("");
  const [newSubmitterType, setNewSubmitterType] = useState<SubmitterType>("recruiter");
  const [newRoleName, setNewRoleName] = useState("");
  const [newRoleClient, setNewRoleClient] = useState("");
  const [editingClientId, setEditingClientId] = useState<string | null>(null);
  const [editingClientValue, setEditingClientValue] = useState("");
  const [dealPickerRole, setDealPickerRole] = useState<RoleView | null>(null);
  const [dealCloserId, setDealCloserId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<RoleView | null>(null);
  const [deleting, setDeleting] = useState(false);

  async function reload() {
    const [s, r] = await Promise.all([fetchSubmitters(), fetchRoles()]);
    setSubmitters(s);
    setRoles(r);
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial data fetch on mount
    reload().catch((err) => {
      toast.error("Failed to load admin data");
      console.error(err);
    });
  }, []);

  async function handleAddSubmitter() {
    if (!newSubmitterName.trim()) return;
    try {
      await upsertSubmitter(newSubmitterName.trim(), newSubmitterType);
      setNewSubmitterName("");
      toast.success("Added");
      reload();
    } catch (err) {
      toast.error("Failed to add");
      console.error(err);
    }
  }

  async function handleAddRole() {
    if (!newRoleName.trim()) return;
    try {
      await upsertRole(newRoleName.trim(), newRoleClient.trim() || null);
      setNewRoleName("");
      setNewRoleClient("");
      toast.success("Added");
      reload();
    } catch (err) {
      toast.error("Failed to add");
      console.error(err);
    }
  }

  function startEditClient(r: RoleView) {
    setEditingClientId(r.id);
    setEditingClientValue(r.client ?? "");
  }

  async function saveEditClient(id: string) {
    try {
      await updateRoleClient(id, editingClientValue.trim() || null);
      setEditingClientId(null);
      reload();
    } catch (err) {
      toast.error("Update failed");
      console.error(err);
    }
  }

  async function toggleSubmitter(s: Submitter) {
    try {
      await setSubmitterStatus(s.id, s.status === "active" ? "inactive" : "active");
      reload();
    } catch (err) {
      toast.error("Update failed");
      console.error(err);
    }
  }

  async function handleRoleStatusChange(r: RoleView, status: RoleStatus) {
    if (status === "deal") {
      setDealPickerRole(r);
      setDealCloserId(r.closed_by_id);
      return;
    }
    try {
      await setRoleStatus(r.id, status);
      reload();
    } catch (err) {
      toast.error("Update failed");
      console.error(err);
    }
  }

  async function confirmDeleteRole() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteRole(deleteTarget.id);
      toast.success(`Deleted "${deleteTarget.name}"`);
      setDeleteTarget(null);
      reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Delete failed");
      console.error(err);
    } finally {
      setDeleting(false);
    }
  }

  async function confirmDealCloser() {
    if (!dealPickerRole) return;
    if (!dealCloserId) {
      toast.error("Pick who closed it first.");
      return;
    }
    try {
      await setRoleStatus(dealPickerRole.id, "deal", dealCloserId);
      setDealPickerRole(null);
      setDealCloserId(null);
      reload();
    } catch (err) {
      toast.error("Update failed");
      console.error(err);
    }
  }

  const submitterOptions = submitters.map((s) => ({
    value: s.id,
    label: s.name,
    hint: s.type,
  }));


  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold tracking-tight">Admin</h1>

      <Tabs defaultValue="submitters">
        <TabsList className="glass w-fit">
          <TabsTrigger value="submitters">Recruiters & Vendors</TabsTrigger>
          <TabsTrigger value="roles">Roles</TabsTrigger>
        </TabsList>

        <TabsContent value="submitters">
          <Card className="glass mt-4">
            <CardHeader>
              <CardTitle className="text-lg">Recruiters & Vendors</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div className="flex flex-wrap items-end gap-2">
                <Input
                  placeholder="Name"
                  value={newSubmitterName}
                  onChange={(e) => setNewSubmitterName(e.target.value)}
                  className="w-56"
                />
                <div className="flex gap-1 rounded-md border p-1">
                  {(["recruiter", "vendor"] as SubmitterType[]).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setNewSubmitterType(t)}
                      className={`rounded px-3 py-1.5 text-sm capitalize ${
                        newSubmitterType === t ? "bg-primary text-primary-foreground" : "hover:bg-accent"
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
                <Button onClick={handleAddSubmitter}>Add</Button>
              </div>

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-24" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {submitters.map((s) => (
                    <TableRow key={s.id}>
                      <TableCell className="font-medium">{s.name}</TableCell>
                      <TableCell className="capitalize">{s.type}</TableCell>
                      <TableCell>
                        <Badge variant={s.status === "active" ? "default" : "secondary"}>
                          {s.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Button variant="outline" size="sm" onClick={() => toggleSubmitter(s)}>
                          {s.status === "active" ? "Deactivate" : "Activate"}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="roles">
          <Card className="glass mt-4">
            <CardHeader>
              <CardTitle className="text-lg">Roles</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div className="flex flex-wrap items-end gap-2">
                <Input
                  placeholder="Role name"
                  value={newRoleName}
                  onChange={(e) => setNewRoleName(e.target.value)}
                  className="w-64"
                />
                <Input
                  placeholder="Client (optional)"
                  value={newRoleClient}
                  onChange={(e) => setNewRoleClient(e.target.value)}
                  className="w-48"
                />
                <Button onClick={handleAddRole}>Add</Button>
              </div>

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Role</TableHead>
                    <TableHead>Client</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Closed By</TableHead>
                    <TableHead className="w-44" />
                    <TableHead className="w-12" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {roles.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-medium">{r.name}</TableCell>
                      <TableCell>
                        {editingClientId === r.id ? (
                          <Input
                            autoFocus
                            value={editingClientValue}
                            onChange={(e) => setEditingClientValue(e.target.value)}
                            onBlur={() => saveEditClient(r.id)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") saveEditClient(r.id);
                              if (e.key === "Escape") setEditingClientId(null);
                            }}
                            className="h-8 w-40"
                          />
                        ) : (
                          <button
                            type="button"
                            onClick={() => startEditClient(r)}
                            className="text-left text-muted-foreground hover:text-foreground hover:underline"
                          >
                            {r.client || "— add client —"}
                          </button>
                        )}
                      </TableCell>
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
                      <TableCell>
                        <Select
                          value={r.status}
                          onValueChange={(value) => handleRoleStatusChange(r, value as RoleStatus)}
                        >
                          <SelectTrigger size="sm" className="w-36">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {ROLE_STATUSES.map((status) => (
                              <SelectItem key={status} value={status}>
                                {status.replace("_", " ")}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setDeleteTarget(r)}
                          aria-label={`Delete ${r.name}`}
                          title="Delete role"
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog
        open={dealPickerRole !== null}
        onOpenChange={(open) => {
          if (!open) {
            setDealPickerRole(null);
            setDealCloserId(null);
          }
        }}
      >
        <DialogContent className="glass-strong">
          <DialogHeader>
            <DialogTitle>Who closed &ldquo;{dealPickerRole?.name}&rdquo;?</DialogTitle>
          </DialogHeader>
          <Combobox
            options={submitterOptions}
            value={dealCloserId}
            onChange={setDealCloserId}
            placeholder="Select recruiter or vendor…"
          />
          <DialogFooter>
            <Button onClick={confirmDealCloser}>Confirm deal</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteTarget !== null} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent className="glass-strong">
          <DialogHeader>
            <DialogTitle>Delete &ldquo;{deleteTarget?.name}&rdquo;?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            This can&rsquo;t be undone. Roles with entries logged against them can&rsquo;t be
            deleted — delete those entries first, or mark the role cancelled/lost instead if you
            just want it out of the active list.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={confirmDeleteRole} disabled={deleting}>
              {deleting ? "Deleting…" : "Delete role"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

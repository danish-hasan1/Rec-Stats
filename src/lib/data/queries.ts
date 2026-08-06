import { createClient } from "@/lib/supabase/client";
import type { Entry, EntryView, Role, RoleStatus, RoleView, Submitter, SubmitterType } from "@/types/db";

export async function fetchSubmitters(): Promise<Submitter[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("submitters")
    .select("*")
    .order("name");
  if (error) throw error;
  return data ?? [];
}

export async function fetchRoles(): Promise<RoleView[]> {
  const supabase = createClient();
  const { data, error } = await supabase.from("roles_view").select("*").order("name");
  if (error) throw error;
  return data ?? [];
}

export async function upsertSubmitter(name: string, type: SubmitterType) {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("submitters")
    .upsert({ name, type }, { onConflict: "name,type" })
    .select()
    .single();
  if (error) throw error;
  return data as Submitter;
}

export async function upsertRole(name: string, client?: string | null) {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("roles")
    .upsert({ name, ...(client !== undefined ? { client } : {}) }, { onConflict: "name" })
    .select()
    .single();
  if (error) throw error;
  return data as Role;
}

export async function updateRoleClient(id: string, client: string | null) {
  const supabase = createClient();
  const { error } = await supabase.from("roles").update({ client }).eq("id", id);
  if (error) throw error;
}

export async function setSubmitterStatus(id: string, status: "active" | "inactive") {
  const supabase = createClient();
  const { error } = await supabase.from("submitters").update({ status }).eq("id", id);
  if (error) throw error;
}

export async function setRoleStatus(id: string, status: RoleStatus, closedById: string | null = null) {
  const supabase = createClient();
  const { error } = await supabase
    .from("roles")
    .update({ status, closed_by_id: status === "deal" ? closedById : null })
    .eq("id", id);
  if (error) throw error;
}

export type NewEntry = {
  date: string;
  submitter_id: string;
  role_id: string;
  submissions: number;
  interview_l1?: number;
  interview_l2?: number;
  interview_l3?: number;
  deal_recruiter_id?: string | null;
  notes?: string | null;
};

export async function upsertEntries(entries: NewEntry[]) {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("entries")
    .upsert(entries, { onConflict: "date,submitter_id,role_id" })
    .select();
  if (error) throw error;
  return data as Entry[];
}

export async function updateEntry(id: string, entry: NewEntry) {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("entries")
    .update(entry)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data as Entry;
}

export async function fetchEntries(from: string, to: string): Promise<EntryView[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("entries_view")
    .select("*")
    .gte("date", from)
    .lte("date", to)
    .order("date", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function deleteEntry(id: string) {
  const supabase = createClient();
  const { error } = await supabase.from("entries").delete().eq("id", id);
  if (error) throw error;
}

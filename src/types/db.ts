export type SubmitterType = "recruiter" | "vendor";
export type SubmitterStatus = "active" | "inactive";
export type RoleStatus = "open" | "on_hold" | "cancelled" | "deal" | "lost";

export type Submitter = {
  id: string;
  name: string;
  type: SubmitterType;
  status: SubmitterStatus;
  notes: string | null;
  created_at: string;
};

export type Role = {
  id: string;
  name: string;
  client: string | null;
  status: RoleStatus;
  created_at: string;
};

export type Entry = {
  id: string;
  date: string;
  submitter_id: string;
  role_id: string;
  submissions: number;
  interview_l1: number;
  interview_l2: number;
  interview_l3: number;
  deal_recruiter_id: string | null;
  notes: string | null;
  created_at: string;
};

export type EntryView = {
  id: string;
  date: string;
  submissions: number;
  interview_l1: number;
  interview_l2: number;
  interview_l3: number;
  interviews: number;
  notes: string | null;
  submitter_id: string;
  submitter_name: string;
  submitter_type: SubmitterType;
  role_id: string;
  role_name: string;
  deal_recruiter_id: string | null;
  deal_recruiter_name: string | null;
};

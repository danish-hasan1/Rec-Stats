import type { RoleStatus } from "@/types/db";

export const ROLE_STATUSES: RoleStatus[] = ["open", "on_hold", "cancelled", "deal", "lost"];

export function roleStatusVariant(
  status: RoleStatus | string
): "default" | "secondary" | "outline" | "destructive" {
  switch (status) {
    case "open":
      return "default";
    case "deal":
      return "secondary";
    case "on_hold":
      return "outline";
    default:
      return "destructive";
  }
}

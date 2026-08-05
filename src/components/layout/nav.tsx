"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  PlusCircle,
  ClipboardPaste,
  Users,
  CalendarRange,
  FileDown,
} from "lucide-react";

const links = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/entry", label: "Daily Entry", icon: PlusCircle },
  { href: "/import", label: "Paste Import", icon: ClipboardPaste },
  { href: "/summary", label: "Summary", icon: CalendarRange },
  { href: "/reports", label: "Reports", icon: FileDown },
  { href: "/admin", label: "Admin", icon: Users },
];

export function Nav() {
  const pathname = usePathname();
  return (
    <nav className="glass-strong sticky top-4 z-50 mx-auto flex w-fit max-w-[95vw] items-center gap-1 rounded-full px-2 py-2 shadow-lg">
      {links.map(({ href, label, icon: Icon }) => {
        const active = pathname === href;
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-all",
              active
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-foreground/70 hover:bg-foreground/5 hover:text-foreground"
            )}
          >
            <Icon className="size-4" />
            <span className="hidden sm:inline">{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

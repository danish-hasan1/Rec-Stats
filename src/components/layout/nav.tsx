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
  Percent,
  Lock,
} from "lucide-react";

const links = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/entry", label: "Daily Entry", icon: PlusCircle },
  { href: "/import", label: "Paste Import", icon: ClipboardPaste },
  { href: "/summary", label: "Summary", icon: CalendarRange },
  { href: "/conversion", label: "Conversion", icon: Percent },
  { href: "/reports", label: "Reports", icon: FileDown },
  { href: "/performance", label: "Performance", icon: Lock },
  { href: "/admin", label: "Admin", icon: Users },
];

export function Nav() {
  const pathname = usePathname();
  return (
    <nav className="glass-strong sticky top-4 z-50 mx-auto flex w-fit max-w-[95vw] items-center gap-1 rounded-full px-2 py-2 shadow-lg">
      <Link href="/" className="mr-1 flex items-center pl-1" aria-label="Rec Stats">
        <svg viewBox="0 0 64 64" className="size-7 rounded-lg" fill="none">
          <rect width="64" height="64" rx="14" fill="#18181B" />
          <rect x="14" y="34" width="8" height="16" rx="2" fill="#FAFAFA" />
          <rect x="28" y="24" width="8" height="26" rx="2" fill="#FAFAFA" />
          <rect x="42" y="14" width="8" height="36" rx="2" fill="#60A5FA" />
          <circle cx="47" cy="16" r="6" fill="#34D399" />
          <path
            d="M44.2 16.1l1.8 1.8 3.4-3.6"
            stroke="#052e1f"
            strokeWidth={1.6}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </Link>
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

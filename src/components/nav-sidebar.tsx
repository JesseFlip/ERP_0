"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Inbox,
  FileText,
  Package,
  Users,
  Settings,
  LogOut,
  FileSignature,
  CalendarDays,
  HardHat,
  Menu,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { logoutAction } from "@/app/logout-action";

const links = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/estimates", label: "Estimates", icon: FileSignature },
  { href: "/schedule", label: "Schedule", icon: CalendarDays },
  { href: "/queue", label: "Uninvoiced queue", icon: Inbox },
  { href: "/invoices", label: "Invoices", icon: FileText },
  { href: "/catalog", label: "Catalog", icon: Package },
  { href: "/customers", label: "Customers", icon: Users },
  { href: "/crews", label: "Crews", icon: HardHat },
  { href: "/settings", label: "Settings", icon: Settings },
];

/**
 * A static sidebar on desktop; a hamburger-triggered slide-in drawer below the
 * `md` breakpoint. Crews and owners both use this from a phone in the field
 * (see the Phase 3 work-order flow), so this can't just be a cramped 256px
 * column on mobile.
 */
export function NavSidebar({ orgName, userName }: { orgName: string; userName: string }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <>
      <div className="fixed inset-x-0 top-0 z-20 flex items-center justify-between border-b border-neutral-200 bg-white px-4 py-3 md:hidden">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="text-neutral-600 hover:text-neutral-900"
          aria-label="Open menu"
        >
          <Menu className="h-5 w-5" />
        </button>
        <p className="text-sm font-semibold text-neutral-900">{orgName}</p>
        <div className="h-5 w-5" aria-hidden="true" />
      </div>

      {open && (
        <div
          className="fixed inset-0 z-30 bg-black/30 md:hidden"
          onClick={() => setOpen(false)}
          aria-hidden="true"
        />
      )}

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex w-64 shrink-0 flex-col border-r border-neutral-200 bg-white transition-transform duration-200 md:static md:translate-x-0 md:transition-none",
          open ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex items-center justify-between px-5 py-5">
          <div>
            <p className="text-sm font-semibold text-neutral-900">{orgName}</p>
            <p className="text-xs text-neutral-500">{userName}</p>
          </div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="text-neutral-400 hover:text-neutral-600 md:hidden"
            aria-label="Close menu"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <nav className="flex flex-1 flex-col gap-0.5 px-3">
          {links.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || pathname.startsWith(`${href}/`);
            return (
              <Link
                key={href}
                href={href}
                onClick={() => setOpen(false)}
                className={cn(
                  "flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  active ? "bg-emerald-50 text-emerald-800" : "text-neutral-600 hover:bg-neutral-100"
                )}
              >
                <Icon className="h-4 w-4" />
                {label}
              </Link>
            );
          })}
        </nav>
        <form action={logoutAction} className="border-t border-neutral-200 p-3">
          <button
            type="submit"
            className="flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium text-neutral-600 hover:bg-neutral-100"
          >
            <LogOut className="h-4 w-4" />
            Sign out
          </button>
        </form>
      </aside>
    </>
  );
}

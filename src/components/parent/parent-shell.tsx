"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Award, BarChart3, ClipboardList, FileText, Inbox, LayoutDashboard, Menu, Settings } from "lucide-react";
import { Logo } from "@/components/shared/logo";
import { RoleSwitcher } from "@/components/shared/role-switcher";
import { Dialog, DialogTitle, SheetContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useStudent, useSubmissions, useUsers } from "@/hooks/use-data";
import { cn, initials } from "@/lib/utils";

export const PARENT_NAV = [
  { href: "/parent", label: "Overview", icon: LayoutDashboard },
  { href: "/parent/assignments", label: "Assignments", icon: ClipboardList },
  { href: "/parent/submissions", label: "Submissions", icon: Inbox },
  { href: "/parent/progress", label: "Student Progress", icon: BarChart3 },
  { href: "/parent/rewards", label: "Rewards Management", icon: Award },
  { href: "/parent/reports", label: "Weekly Reports", icon: FileText },
  { href: "/parent/settings", label: "Settings", icon: Settings },
];

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const submissions = useSubmissions();
  const toReview = submissions?.filter((s) => s.status === "evaluated").length ?? 0;
  return (
    <nav className="space-y-0.5" aria-label="Parent navigation">
      {PARENT_NAV.map((item) => {
        const active = item.href === "/parent" ? pathname === "/parent" : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              active ? "bg-indigo text-white" : "text-indigo-500 hover:bg-secondary hover:text-indigo",
            )}
          >
            <item.icon className="h-4 w-4" />
            <span className="flex-1">{item.label}</span>
            {item.href === "/parent/submissions" && toReview > 0 && (
              <span className={cn("rounded-full px-1.5 text-[11px] font-bold", active ? "bg-sun text-indigo" : "bg-sun-light text-sun-dark")}>{toReview}</span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}

export function ParentShell({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const student = useStudent();
  const users = useUsers();
  const parent = users?.find((u) => u.id === "parent_1");

  const studentCard = (
    <div className="rounded-xl border bg-paper p-3">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Monitoring</p>
      <div className="mt-2 flex items-center gap-2.5">
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-sun font-heading text-sm font-bold">{student ? initials(student.name) : ""}</div>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{student?.name ?? "…"}</p>
          <p className="text-xs text-muted-foreground">Class {student?.grade} · {student?.curriculum}</p>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-paper">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r bg-card px-4 py-5 lg:flex">
        <Logo href="/parent" sub="Parent Console" className="px-2" />
        <div className="mt-6">{studentCard}</div>
        <div className="mt-5 flex-1">
          <NavLinks />
        </div>
        <div className="flex items-center gap-2.5 rounded-xl px-2 py-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-mint font-heading text-sm font-bold">{parent ? initials(parent.name) : ""}</div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{parent?.name}</p>
            <p className="truncate text-xs text-muted-foreground">{parent?.email}</p>
          </div>
        </div>
      </aside>

      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between gap-3 border-b bg-paper/90 px-4 backdrop-blur-md lg:px-8">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setOpen(true)} aria-label="Open navigation">
              <Menu className="h-5 w-5" />
            </Button>
            <Logo href="/parent" className="lg:hidden" />
            <p className="hidden text-sm text-muted-foreground lg:block">
              Welcome back, <span className="font-semibold text-foreground">{parent?.name.split(" ")[0] ?? ""}</span>
            </p>
          </div>
          <RoleSwitcher current="parent" />
        </header>
        <main className="mx-auto max-w-7xl px-4 py-6 lg:px-8 lg:py-8">{children}</main>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <SheetContent>
          <DialogTitle className="sr-only">Navigation</DialogTitle>
          <Logo href="/parent" sub="Parent Console" />
          {studentCard}
          <NavLinks onNavigate={() => setOpen(false)} />
        </SheetContent>
      </Dialog>
    </div>
  );
}

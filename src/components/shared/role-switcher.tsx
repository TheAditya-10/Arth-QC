"use client";

import { Check, ChevronDown, GraduationCap, LogOut, UserRound } from "lucide-react";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { settingsService } from "@/lib/client";
import { setActiveStudent, useStore } from "@/lib/client/store";
import type { Role } from "@/types";
import { cn, initials } from "@/lib/utils";

/** Account menu: who is signed in, student switcher (parents with several children) and sign out. */
export function AccountMenu({ current, compact, className }: { current: Role; compact?: boolean; className?: string }) {
  const viewer = useStore((db) => db.viewer);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size={compact ? "icon" : "sm"} className={cn("gap-2", className)} aria-label="Account menu">
          {compact ? <UserRound /> : (
            <>
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-sun text-[11px] font-bold text-indigo">{viewer ? initials(viewer.name) : ""}</span>
              <span className="max-w-[10rem] truncate">{viewer?.name ?? "Account"}</span>
              <ChevronDown className="opacity-60" />
            </>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuLabel>{current === "student" ? "Student account" : "Parent account"}</DropdownMenuLabel>
        <div className="px-2 pb-2 text-sm">
          <p className="font-semibold">{viewer?.name}</p>
          <p className="truncate text-xs text-muted-foreground">{current === "parent" ? viewer?.email : viewer?.familyName}</p>
        </div>
        {current === "parent" && viewer && viewer.students.length > 1 && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuLabel>Viewing student</DropdownMenuLabel>
            {viewer.students.map((s) => (
              <DropdownMenuItem
                key={s.id}
                onSelect={() => {
                  if (s.id === viewer.activeStudentId) return;
                  void setActiveStudent(s.id).then(() => toast.success(`Now viewing ${s.name}`));
                }}
              >
                <GraduationCap /> <span className="flex-1">{s.name}</span>
                {s.id === viewer.activeStudentId && <Check />}
              </DropdownMenuItem>
            ))}
          </>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => void settingsService.signOut()}>
          <LogOut /> Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** @deprecated Phase 1 name, kept so existing shells keep working. */
export const RoleSwitcher = AccountMenu;

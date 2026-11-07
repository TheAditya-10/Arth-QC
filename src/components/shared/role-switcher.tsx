"use client";

import { useRouter } from "next/navigation";
import { ArrowLeftRight, GraduationCap, RotateCcw, Users } from "lucide-react";
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
import { settingsService } from "@/lib/services";
import type { Role } from "@/types";
import { cn } from "@/lib/utils";

/** Demo-only role selector: switches between student and parent experiences. No real auth. */
export function RoleSwitcher({ current, compact, className }: { current: Role; compact?: boolean; className?: string }) {
  const router = useRouter();
  const go = (role: Role) => {
    settingsService.setDemoRole(role);
    router.push(role === "student" ? "/student" : "/parent");
  };
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size={compact ? "icon" : "sm"} className={cn("gap-2", className)} aria-label="Switch demo role">
          <ArrowLeftRight />
          {!compact && <span>Demo: {current === "student" ? "Student" : "Parent"}</span>}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>Switch demo view</DropdownMenuLabel>
        <DropdownMenuItem onSelect={() => go("student")} className={current === "student" ? "bg-secondary" : ""}>
          <GraduationCap /> Student view
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => go("parent")} className={current === "parent" ? "bg-secondary" : ""}>
          <Users /> Parent view
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={async () => {
            await settingsService.resetDemoData();
            toast.success("Demo data reset", { description: "All mock data is back to its starting state." });
          }}
        >
          <RotateCcw /> Reset demo data
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

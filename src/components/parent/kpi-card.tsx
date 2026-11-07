import type { LucideIcon } from "lucide-react";
import { Card } from "@/components/ui/card";

export function KpiCard({ icon: Icon, label, value, sub }: { icon: LucideIcon; label: string; value: React.ReactNode; sub?: string }) {
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-muted-foreground">{label}</p>
        <Icon className="h-4 w-4 text-indigo-300" />
      </div>
      <p className="mt-2 font-heading text-2xl font-bold">{value}</p>
      {sub && <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>}
    </Card>
  );
}

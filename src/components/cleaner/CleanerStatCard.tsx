import type { ReactNode } from "react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type CleanerStatCardProps = {
  icon: ReactNode;
  label: string;
  value: string;
  hint?: string;
  className?: string;
};

export function CleanerStatCard({ icon, label, value, hint, className }: CleanerStatCardProps) {
  return (
    <Card className={cn("p-4 sm:p-5", className)}>
      <div className="flex items-center gap-2 text-emerald-700">{icon}</div>
      <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-slate-500 sm:mt-4">{label}</p>
      <p className="mt-1 text-xl font-black text-slate-950 sm:text-2xl">{value}</p>
      {hint ? <p className="mt-1 text-xs text-slate-500">{hint}</p> : null}
    </Card>
  );
}

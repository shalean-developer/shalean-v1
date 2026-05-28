import { cn } from "@/lib/utils";
import { LIFECYCLE_STEPS } from "@/lib/cleaner/format";
import type { CleanerJobLifecycleMode } from "@/lib/cleaner/types";

type CleanerJobLifecycleProps = {
  current: CleanerJobLifecycleMode;
  compact?: boolean;
};

export function CleanerJobLifecycle({ current, compact = false }: CleanerJobLifecycleProps) {
  const currentIndex = LIFECYCLE_STEPS.findIndex((step) => step.mode === current);

  return (
    <ol
      className={cn(
        "flex w-full items-center gap-1",
        compact ? "text-[10px]" : "text-xs",
      )}
      aria-label="Job lifecycle"
    >
      {LIFECYCLE_STEPS.map((step, index) => {
        const isComplete = index < currentIndex;
        const isCurrent = index === currentIndex;

        return (
          <li key={step.mode} className="flex min-w-0 flex-1 items-center gap-1">
            <span
              className={cn(
                "flex h-6 w-6 shrink-0 items-center justify-center rounded-full border font-bold",
                isComplete && "border-emerald-600 bg-emerald-600 text-white",
                isCurrent && "border-emerald-700 bg-emerald-50 text-emerald-800",
                !isComplete && !isCurrent && "border-slate-200 bg-white text-slate-400",
              )}
              aria-current={isCurrent ? "step" : undefined}
            >
              {index + 1}
            </span>
            {!compact ? (
              <span
                className={cn(
                  "hidden truncate font-semibold sm:inline",
                  isCurrent ? "text-emerald-800" : isComplete ? "text-slate-700" : "text-slate-400",
                )}
              >
                {step.label}
              </span>
            ) : null}
            {index < LIFECYCLE_STEPS.length - 1 ? (
              <span
                className={cn(
                  "mx-0.5 hidden h-px min-w-2 flex-1 sm:block",
                  index < currentIndex ? "bg-emerald-500" : "bg-slate-200",
                )}
                aria-hidden
              />
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}

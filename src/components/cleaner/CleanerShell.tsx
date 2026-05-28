import type { ReactNode } from "react";
import { CleanerSidebar } from "@/components/cleaner/CleanerSidebar";

type CleanerShellProps = {
  children: ReactNode;
  cleanerName: string;
  photoUrl: string | null;
  available: boolean;
  offerCount: number;
  activeJobCount: number;
};

export function CleanerShell({
  children,
  cleanerName,
  photoUrl,
  available,
  offerCount,
  activeJobCount,
}: CleanerShellProps) {
  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto grid max-w-[1500px] lg:grid-cols-[286px_minmax(0,1fr)]">
        <CleanerSidebar
          cleanerName={cleanerName}
          photoUrl={photoUrl}
          available={available}
          offerCount={offerCount}
          activeJobCount={activeJobCount}
        />
        <div className="min-w-0 px-4 pb-8 pt-4 sm:px-6 lg:px-6 lg:py-5 xl:px-8">{children}</div>
      </div>
    </div>
  );
}

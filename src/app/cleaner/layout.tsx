import type { ReactNode } from "react";

export default function CleanerRootLayout({ children }: { children: ReactNode }) {
  return <main className="min-h-screen bg-slate-50">{children}</main>;
}

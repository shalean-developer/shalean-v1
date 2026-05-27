import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { loginCleanerWithPassword } from "@/lib/auth/server";

export const metadata: Metadata = {
  title: "Cleaner Login | Shalean",
};

type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function CleanerLoginPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const error = getParam(params, "error");

  return (
    <main className="grid min-h-screen place-items-center bg-slate-50 px-4 py-10">
      <Card className="w-full max-w-md p-6">
        <p className="text-sm font-black uppercase tracking-[0.2em] text-emerald-800">Shalean</p>
        <Badge>Cleaner access</Badge>
        <h1 className="mt-4 text-2xl font-black text-slate-950">Sign in to your cleaner dashboard</h1>
        <p className="mt-2 text-sm text-slate-600">Use your phone number and password to access assigned jobs, offers, and earnings.</p>
        {error ? (
          <div className="mt-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-800">
            Invalid phone number, password, or inactive cleaner account.
          </div>
        ) : null}
        <form action={cleanerPasswordLoginAction} className="mt-6 grid gap-4">
          <label>
            <span className="text-sm font-semibold text-slate-700">Phone number</span>
            <input className="mt-2 min-h-11 w-full rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-emerald-700" name="phone" type="tel" inputMode="tel" autoComplete="tel" placeholder="0792022648" required />
          </label>
          <label>
            <span className="text-sm font-semibold text-slate-700">Password</span>
            <input className="mt-2 min-h-11 w-full rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-emerald-700" name="password" type="password" autoComplete="current-password" required />
          </label>
          <button className="rounded-md bg-emerald-700 px-4 py-3 text-sm font-bold text-white" type="submit">
            Sign in
          </button>
        </form>
      </Card>
    </main>
  );
}

async function cleanerPasswordLoginAction(formData: FormData) {
  "use server";

  try {
    await loginCleanerWithPassword({
      phone: String(formData.get("phone") ?? ""),
      password: String(formData.get("password") ?? ""),
    });
  } catch {
    redirect("/cleaner/login?error=invalid");
  }

  redirect("/cleaner");
}

function getParam(params: Awaited<PageProps["searchParams"]>, key: string) {
  const value = params?.[key];
  return Array.isArray(value) ? value[0] : value;
}

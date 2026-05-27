import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { getAdminProfileForUser, getAdminSession } from "@/lib/auth/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Admin Login | Shalean",
};

type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function AdminLoginPage({ searchParams }: PageProps) {
  const session = await getAdminSession();
  if (session) {
    redirect("/admin");
  }

  const params = await searchParams;
  const error = getParam(params, "error");

  return (
    <main className="grid min-h-screen place-items-center bg-slate-950 px-4 py-10 text-white">
      <Card className="w-full max-w-md border-white/10 bg-white p-6 text-slate-950">
        <Badge>Admin access</Badge>
        <h1 className="mt-4 text-2xl font-black">Sign in to Shalean admin</h1>
        <p className="mt-2 text-sm text-slate-600">Use your Supabase admin account email and password.</p>
        {error ? (
          <div className="mt-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-800">
            {error === "unauthorized" ? "This account is not authorized for admin access." : "Unable to sign in."}
          </div>
        ) : null}
        <form action={adminLoginAction} className="mt-6 grid gap-4">
          <label>
            <span className="text-sm font-semibold text-slate-700">Email</span>
            <input className="mt-2 min-h-11 w-full rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-emerald-700" name="email" type="email" required />
          </label>
          <label>
            <span className="text-sm font-semibold text-slate-700">Password</span>
            <input className="mt-2 min-h-11 w-full rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-emerald-700" name="password" type="password" required />
          </label>
          <button className="rounded-md bg-emerald-700 px-4 py-3 text-sm font-bold text-white" type="submit">
            Sign in
          </button>
        </form>
      </Card>
    </main>
  );
}

async function adminLoginAction(formData: FormData) {
  "use server";

  const supabase = await createSupabaseServerClient();
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  const result = await supabase.auth.signInWithPassword({ email, password });

  if (result.error) {
    redirect("/admin/login?error=signin");
  }

  const user = result.data.user;
  if (!user) {
    await supabase.auth.signOut();
    redirect("/admin/login?error=signin");
  }

  const profile = await getAdminProfileForUser(user);
  if (!profile) {
    await supabase.auth.signOut();
    redirect("/admin/login?error=unauthorized");
  }

  redirect("/admin");
}

function getParam(params: Awaited<PageProps["searchParams"]>, key: string) {
  const value = params?.[key];
  return Array.isArray(value) ? value[0] : value;
}

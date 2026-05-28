"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import { signOutUserAction } from "@/lib/auth/actions";
import { cn } from "@/lib/utils";

export type DashboardNavLink = {
  href: string;
  label: string;
  key: string;
};

type DashboardNavProps = {
  links: DashboardNavLink[];
  activeKey?: string;
  loggedIn: boolean;
  dark?: boolean;
};

export function DashboardNav({ links, activeKey, loggedIn, dark = false }: DashboardNavProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    function handlePointer(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function handleKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointer);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handlePointer);
      document.removeEventListener("keydown", handleKey);
    };
  }, [open]);

  return (
    <>
      {/* Desktop / tablet inline nav */}
      <nav className="hidden items-center gap-2 sm:flex">
        {links.map((link) => (
          <Link
            key={`${link.href}-${link.label}`}
            href={link.href}
            className={navLinkClass(dark, activeKey === link.key)}
          >
            {link.label}
          </Link>
        ))}
        <AuthControls loggedIn={loggedIn} dark={dark} />
      </nav>

      {/* Mobile hamburger nav */}
      <div ref={containerRef} className="relative sm:hidden">
        <button
          type="button"
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
          onClick={() => setOpen((value) => !value)}
          className={cn(
            "inline-flex h-10 w-10 items-center justify-center rounded-md border",
            dark ? "border-white/15 text-slate-100 hover:bg-white/10" : "border-slate-300 text-slate-700 hover:bg-slate-50",
          )}
        >
          {open ? <X className="h-5 w-5" aria-hidden /> : <Menu className="h-5 w-5" aria-hidden />}
        </button>

        {open ? (
          <div
            className={cn(
              "absolute right-0 top-full z-50 mt-2 w-56 overflow-hidden rounded-lg border shadow-lg",
              dark ? "border-white/10 bg-slate-900" : "border-slate-200 bg-white",
            )}
          >
            <nav className="flex flex-col p-2">
              {links.map((link) => (
                <Link
                  key={`${link.href}-${link.label}`}
                  href={link.href}
                  onClick={() => setOpen(false)}
                  className={mobileLinkClass(dark, activeKey === link.key)}
                >
                  {link.label}
                </Link>
              ))}
              <div className={cn("my-2 border-t", dark ? "border-white/10" : "border-slate-200")} />
              <AuthControls loggedIn={loggedIn} dark={dark} mobile onNavigate={() => setOpen(false)} />
            </nav>
          </div>
        ) : null}
      </div>
    </>
  );
}

function AuthControls({
  loggedIn,
  dark,
  mobile = false,
  onNavigate,
}: {
  loggedIn: boolean;
  dark: boolean;
  mobile?: boolean;
  onNavigate?: () => void;
}) {
  if (loggedIn) {
    return (
      <form action={signOutUserAction} className={mobile ? "px-1" : undefined}>
        <button
          type="submit"
          className={mobile ? mobileLinkClass(dark, false) + " w-full text-left" : buttonClass(dark, false)}
        >
          Logout
        </button>
      </form>
    );
  }

  if (mobile) {
    return (
      <>
        <Link href="/admin/login" onClick={onNavigate} className={mobileLinkClass(dark, false)}>Login</Link>
        <Link href="/cleaner/login" onClick={onNavigate} className={mobileLinkClass(dark, false)}>Cleaner sign in</Link>
        <Link href="/book" onClick={onNavigate} className={mobileLinkClass(dark, false) + " mt-1 bg-emerald-700 text-white hover:bg-emerald-800"}>
          Book service
        </Link>
      </>
    );
  }

  return (
    <>
      <Link className={buttonClass(dark, false)} href="/admin/login">Login</Link>
      <Link className={buttonClass(dark, false)} href="/cleaner/login">Cleaner sign in</Link>
      <Link className={buttonClass(dark, true)} href="/book">Book service</Link>
    </>
  );
}

function navLinkClass(dark: boolean, active: boolean) {
  return cn(
    "rounded-md px-3 py-2 text-sm font-bold",
    active
      ? "bg-emerald-700 text-white"
      : dark ? "text-slate-200 hover:bg-white/10" : "text-slate-700 hover:bg-slate-100",
  );
}

function mobileLinkClass(dark: boolean, active: boolean) {
  return cn(
    "rounded-md px-3 py-2.5 text-sm font-bold",
    active
      ? "bg-emerald-700 text-white"
      : dark ? "text-slate-100 hover:bg-white/10" : "text-slate-700 hover:bg-slate-100",
  );
}

function buttonClass(dark: boolean, primary: boolean) {
  if (primary) {
    return "inline-flex min-h-9 items-center rounded-md bg-emerald-700 px-3 py-2 text-sm font-bold text-white hover:bg-emerald-800";
  }

  return cn(
    "inline-flex min-h-9 items-center rounded-md border px-3 py-2 text-sm font-bold",
    dark ? "border-white/15 text-slate-100 hover:bg-white/10" : "border-slate-300 text-slate-700 hover:bg-slate-50",
  );
}

"use client";

import { useMemo, useState } from "react";
import { cleanCleanerPhone } from "@/lib/auth/cleaner";

export function CleanerPhoneField({
  defaultValue = "",
  name = "phone",
  label = "Phone",
}: {
  defaultValue?: string;
  name?: string;
  label?: string;
}) {
  const [value, setValue] = useState(defaultValue);
  const email = useMemo(() => {
    const digits = cleanCleanerPhone(value);
    return digits ? `${digits}@shalean.co.za` : "Phone required before email can be generated";
  }, [value]);

  return (
    <div className="grid gap-2">
      <label>
        <span className="text-sm font-semibold text-slate-700">{label}</span>
        <input
          className="mt-2 min-h-11 w-full rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-emerald-700"
          name={name}
          onChange={(event) => setValue(event.target.value)}
          placeholder="0825915525"
          required
          value={value}
        />
      </label>
      <div className="rounded-md bg-emerald-50 p-3 text-sm text-emerald-900">
        Generated email preview: <span className="font-bold">{email}</span>
      </div>
    </div>
  );
}

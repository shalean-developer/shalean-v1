"use client";

import type React from "react";
import { useActionState } from "react";
import { Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { updatePricingAction, type PricingUpdateState } from "@/lib/admin/actions";
import type { loadAdminPricingData } from "@/lib/admin/data";
import { formatZar } from "@/lib/utils";

type PricingData = Awaited<ReturnType<typeof loadAdminPricingData>>;

const initialState: PricingUpdateState = {};

export function AdminPricingManager({ data }: { data: PricingData }) {
  const [state, formAction, pending] = useActionState(updatePricingAction, initialState);

  return (
    <div className="space-y-4">
      {state.message ? (
        <div className={`rounded-lg border p-3 text-sm font-semibold ${
          state.ok
            ? "border-emerald-200 bg-emerald-50 text-emerald-900"
            : "border-red-200 bg-red-50 text-red-800"
        }`}>
          {state.message}
        </div>
      ) : null}

      <PricingSection title="Service Prices">
        {data.services.map((service) => (
          <form key={service.id} action={formAction} className="rounded-lg border border-slate-200 bg-white p-4">
            <input type="hidden" name="table" value="services" />
            <input type="hidden" name="id" value={service.id} />
            <div className="grid gap-3 lg:grid-cols-[1.2fr_1.5fr_0.7fr_auto] lg:items-end">
              <TextField label="Service name" name="title" defaultValue={service.title ?? service.name ?? ""} />
              <TextField label="Description" name="description" defaultValue={service.description ?? ""} />
              <MoneyField label="Base price" name="basePrice" cents={service.base_price_cents} />
              <ActiveToggle defaultChecked={service.active} />
            </div>
            <FormFooter pending={pending} />
          </form>
        ))}
      </PricingSection>

      <PricingSection title="House Pricing Rules">
        <div className="grid gap-3 xl:grid-cols-2">
          {data.houseRules.map((rule) => (
            <form key={rule.id} action={formAction} className="rounded-lg border border-slate-200 bg-white p-4">
              <input type="hidden" name="table" value="pricing_rules" />
              <input type="hidden" name="id" value={rule.id} />
              <div className="grid gap-3 md:grid-cols-2">
                <TextField label="Rule name" name="name" defaultValue={rule.name} />
                <MoneyField label="Price" name="price" cents={rule.price_cents} />
                <TextField label="Description" name="description" defaultValue={rule.description ?? ""} />
                <NumberField label="Estimated minutes" name="estimatedMinutes" defaultValue={rule.estimated_minutes} />
                <ActiveToggle defaultChecked={rule.active} />
              </div>
              <FormFooter pending={pending} />
            </form>
          ))}
        </div>
      </PricingSection>

      <PricingSection title="Premium Add-ons">
        <div className="grid gap-3 xl:grid-cols-2">
          {data.addons.map((addon) => (
            <form key={addon.id} action={formAction} className="rounded-lg border border-slate-200 bg-white p-4">
              <input type="hidden" name="table" value="service_addons" />
              <input type="hidden" name="id" value={addon.id} />
              <div className="grid gap-3 md:grid-cols-2">
                <TextField label="Add-on name" name="label" defaultValue={addon.label} />
                <MoneyField label="Price" name="price" cents={addon.price_cents} />
                <TextField label="Description" name="description" defaultValue={addon.description ?? ""} />
                <NumberField label="Estimated minutes" name="durationMinutes" defaultValue={addon.duration_minutes} />
                <ActiveToggle defaultChecked={addon.active} />
              </div>
              <FormFooter pending={pending} />
            </form>
          ))}
        </div>
      </PricingSection>

      <PricingSection title="Cleaning Supplies / Equipment">
        <div className="grid gap-3 xl:grid-cols-2">
          {data.equipmentOptions.map((option) => (
            <form key={option.id} action={formAction} className="rounded-lg border border-slate-200 bg-white p-4">
              <input type="hidden" name="table" value="service_equipment_options" />
              <input type="hidden" name="id" value={option.id} />
              <div className="grid gap-3 md:grid-cols-2">
                <TextField label="Option name" name="label" defaultValue={option.label} />
                <MoneyField label="Price" name="price" cents={option.price_cents} />
                <TextField label="Description" name="description" defaultValue={option.description ?? ""} />
                <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
                  <span className="font-semibold text-slate-800">Current</span>
                  <span className="mt-1 block">{formatZar(option.price_cents)}</span>
                </div>
                <ActiveToggle defaultChecked={option.active} />
              </div>
              <FormFooter pending={pending} />
            </form>
          ))}
        </div>
      </PricingSection>

      <PricingSection title="Recurring / Prepaid Rules">
        <div className="grid gap-3 xl:grid-cols-2">
          {data.recurringRules.map((rule) => (
            <form key={rule.id} action={formAction} className="rounded-lg border border-slate-200 bg-white p-4">
              <input type="hidden" name="table" value="recurring_pricing_rules" />
              <input type="hidden" name="id" value={rule.id} />
              <div className="grid gap-3 md:grid-cols-2">
                <TextField label="Rule name" name="name" defaultValue={rule.name} />
                <NumberField label="Multiplier" name="multiplier" defaultValue={rule.multiplier} step="0.01" />
                <TextField label="Description" name="description" defaultValue={rule.description ?? ""} />
                <NumberField label="Prepaid visits" name="prepaidVisits" defaultValue={rule.prepaid_visits} />
                <ActiveToggle defaultChecked={rule.active} />
              </div>
              <FormFooter pending={pending} />
            </form>
          ))}
        </div>
      </PricingSection>

      <PricingSection title="Cleaner Workload Rules">
        {data.cleanerQuantityRules.map((rule) => (
          <form key={rule.id} action={formAction} className="rounded-lg border border-slate-200 bg-white p-4">
            <input type="hidden" name="table" value="cleaner_quantity_rules" />
            <input type="hidden" name="id" value={rule.id} />
            <div className="grid gap-3 md:grid-cols-3">
              <MoneyField label="Extra cleaner price" name="extraCleanerPrice" cents={rule.extra_cleaner_price_cents} />
              <NumberField label="Recommended minutes" name="recommendedMinutes" defaultValue={rule.recommended_workload_minutes_per_cleaner} />
              <ActiveToggle defaultChecked={rule.active} />
            </div>
            <FormFooter pending={pending} />
          </form>
        ))}
      </PricingSection>
    </div>
  );
}

function PricingSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-slate-200 bg-slate-50 p-4 shadow-sm">
      <h3 className="text-base font-black text-slate-950">{title}</h3>
      <div className="mt-3 space-y-3">{children}</div>
    </section>
  );
}

function TextField({ label, name, defaultValue }: { label: string; name: string; defaultValue: string }) {
  return (
    <label className="block">
      <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</span>
      <input
        className="mt-1 h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-950 outline-none focus:border-emerald-700"
        name={name}
        defaultValue={defaultValue}
      />
    </label>
  );
}

function MoneyField({ label, name, cents }: { label: string; name: string; cents: number }) {
  return (
    <label className="block">
      <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</span>
      <span className="mt-1 flex h-10 rounded-md border border-slate-300 bg-white focus-within:border-emerald-700">
        <span className="flex items-center border-r border-slate-200 px-3 text-sm font-bold text-slate-500">R</span>
        <input
          className="min-w-0 flex-1 rounded-r-md px-3 text-sm text-slate-950 outline-none"
          min="0"
          name={name}
          step="0.01"
          type="number"
          defaultValue={(cents / 100).toFixed(2)}
        />
      </span>
    </label>
  );
}

function NumberField({
  label,
  name,
  defaultValue,
  step = "1",
}: {
  label: string;
  name: string;
  defaultValue: number;
  step?: string;
}) {
  return (
    <label className="block">
      <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</span>
      <input
        className="mt-1 h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-950 outline-none focus:border-emerald-700"
        min="0"
        name={name}
        step={step}
        type="number"
        defaultValue={defaultValue}
      />
    </label>
  );
}

function ActiveToggle({ defaultChecked }: { defaultChecked: boolean }) {
  return (
    <label className="flex h-10 items-center gap-2 self-end rounded-md border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700">
      <input className="h-4 w-4 accent-emerald-700" name="active" type="checkbox" defaultChecked={defaultChecked} />
      Active
    </label>
  );
}

function FormFooter({ pending }: { pending: boolean }) {
  return (
    <div className="mt-3 flex items-center justify-end border-t border-slate-100 pt-3">
      <Button disabled={pending} type="submit" size="sm">
        <Save className="h-4 w-4" />
        {pending ? "Saving" : "Save"}
      </Button>
    </div>
  );
}

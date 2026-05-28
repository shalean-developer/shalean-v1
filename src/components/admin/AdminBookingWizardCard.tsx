"use client";

import type React from "react";
import { useMemo, useRef, useState } from "react";
import { Check, ChevronLeft, ChevronRight } from "lucide-react";
import type { AddonRow, CleanerRow, CustomerRow, EquipmentRow } from "@/lib/admin/data";
import { cn, formatZar } from "@/lib/utils";

const wizardSteps = [
  "Customer",
  "Schedule",
  "Property details",
  "Services & add-ons",
  "Assignment & summary",
] as const;

export function AdminBookingWizardCard({
  action,
  customers,
  cleaners,
  addons,
  equipmentOptions,
}: {
  action: (formData: FormData) => void | Promise<void>;
  customers: CustomerRow[];
  cleaners: CleanerRow[];
  addons: AddonRow[];
  equipmentOptions: EquipmentRow[];
}) {
  const [step, setStep] = useState(0);
  const [customerId, setCustomerId] = useState(customers[0]?.id ?? "");
  const [bookingDate, setBookingDate] = useState("");
  const [bookingTime, setBookingTime] = useState("08:00-12:00");
  const [frequency, setFrequency] = useState("once");
  const [address, setAddress] = useState("");
  const [suburb, setSuburb] = useState("");
  const [propertyType, setPropertyType] = useState("apartment");
  const [bedrooms, setBedrooms] = useState("2");
  const [bathrooms, setBathrooms] = useState("1");
  const [extraRooms, setExtraRooms] = useState("0");
  const [cleanerCount, setCleanerCount] = useState("1");
  const [selectedCleanerId, setSelectedCleanerId] = useState("");
  const [equipmentOptionKey, setEquipmentOptionKey] = useState(equipmentOptions[0]?.key ?? "");
  const [selectedAddons, setSelectedAddons] = useState<string[]>([]);
  const fieldsetsRef = useRef<Array<HTMLFieldSetElement | null>>([]);
  const totalSteps = wizardSteps.length;

  const selectedCustomer = useMemo(
    () => customers.find((customer) => customer.id === customerId),
    [customerId, customers],
  );
  const selectedCleaner = useMemo(
    () => cleaners.find((cleaner) => cleaner.id === selectedCleanerId),
    [cleaners, selectedCleanerId],
  );
  const selectedEquipment = useMemo(
    () => equipmentOptions.find((option) => option.key === equipmentOptionKey),
    [equipmentOptionKey, equipmentOptions],
  );
  const selectedAddonRows = useMemo(
    () => addons.filter((addon) => selectedAddons.includes(addon.key)),
    [addons, selectedAddons],
  );

  function nextStep() {
    const currentStep = fieldsetsRef.current[step];
    if (currentStep && !currentStep.checkValidity()) {
      currentStep.reportValidity();
      return;
    }
    setStep((current) => Math.min(totalSteps - 1, current + 1));
  }

  function previousStep() {
    setStep((current) => Math.max(0, current - 1));
  }

  function toggleAddon(addonKey: string, checked: boolean) {
    setSelectedAddons((current) => {
      if (checked) {
        return Array.from(new Set([...current, addonKey]));
      }
      return current.filter((key) => key !== addonKey);
    });
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 text-slate-900 sm:p-6">
      <div className="flex flex-wrap gap-2">
        {wizardSteps.map((label, index) => (
          <button
            key={label}
            className={cn(
              "inline-flex h-9 items-center gap-1 rounded-full border px-3 text-xs font-semibold transition",
              index === step
                ? "border-emerald-600 bg-emerald-50 text-emerald-800"
                : index < step
                  ? "border-slate-300 bg-slate-100 text-slate-700"
                  : "border-slate-200 bg-transparent text-slate-400",
            )}
            type="button"
            disabled={index > step}
            onClick={() => setStep(index)}
          >
            {index < step ? <Check className="h-3.5 w-3.5" /> : null}
            {label}
          </button>
        ))}
      </div>

      <form action={action} className="mt-5 space-y-5">
        <fieldset
          ref={(element) => {
            fieldsetsRef.current[0] = element;
          }}
          className={cn(step === 0 ? "space-y-4" : "hidden")}
        >
          <WizardGroup title="Step 1 · Customer" description="Select the customer profile for this booking.">
            <WizardSelect
              label="Customer"
              name="customerId"
              required
              value={customerId}
              onChange={setCustomerId}
              options={customers.map((customer) => ({ value: customer.id, label: `${customer.full_name} (${customer.email})` }))}
            />
          </WizardGroup>
        </fieldset>

        <fieldset
          ref={(element) => {
            fieldsetsRef.current[1] = element;
          }}
          className={cn(step === 1 ? "space-y-4" : "hidden")}
        >
          <WizardGroup title="Step 2 · Schedule" description="Set date, time window, and frequency.">
            <div className="grid gap-3 lg:grid-cols-3">
              <WizardInput label="Booking date" name="bookingDate" type="date" required value={bookingDate} onChange={setBookingDate} />
              <WizardSelect
                label="Time window"
                name="bookingTime"
                required
                value={bookingTime}
                onChange={setBookingTime}
                options={[
                  { value: "08:00-12:00", label: "08:00 - 12:00" },
                  { value: "12:00-16:00", label: "12:00 - 16:00" },
                  { value: "16:00-20:00", label: "16:00 - 20:00" },
                ]}
              />
              <WizardSelect
                label="Frequency"
                name="frequency"
                required
                value={frequency}
                onChange={setFrequency}
                options={[
                  { value: "once", label: "Once" },
                  { value: "weekly", label: "Weekly" },
                  { value: "fortnightly", label: "Fortnightly" },
                  { value: "monthly", label: "Monthly" },
                ]}
              />
            </div>
          </WizardGroup>
        </fieldset>

        <fieldset
          ref={(element) => {
            fieldsetsRef.current[2] = element;
          }}
          className={cn(step === 2 ? "space-y-4" : "hidden")}
        >
          <WizardGroup title="Step 3 · Property details" description="Capture address and property dimensions.">
            <div className="grid gap-3 lg:grid-cols-[2fr_1fr_1fr]">
              <WizardInput label="Address" name="address" required value={address} onChange={setAddress} />
              <WizardInput label="Suburb" name="suburb" required value={suburb} onChange={setSuburb} />
              <WizardSelect
                label="Property type"
                name="propertyType"
                required
                value={propertyType}
                onChange={setPropertyType}
                options={[
                  { value: "apartment", label: "Apartment" },
                  { value: "house", label: "House" },
                  { value: "office", label: "Office" },
                  { value: "airbnb", label: "Airbnb" },
                ]}
              />
            </div>
            <div className="grid gap-3 lg:grid-cols-4">
              <WizardInput label="Bedrooms" name="bedrooms" type="number" min={0} required value={bedrooms} onChange={setBedrooms} />
              <WizardInput label="Bathrooms" name="bathrooms" type="number" min={0} required value={bathrooms} onChange={setBathrooms} />
              <WizardInput label="Extra rooms" name="extraRooms" type="number" min={0} required value={extraRooms} onChange={setExtraRooms} />
              <WizardInput label="Cleaners" name="cleanerCount" type="number" min={1} max={4} required value={cleanerCount} onChange={setCleanerCount} />
            </div>
          </WizardGroup>
        </fieldset>

        <fieldset
          ref={(element) => {
            fieldsetsRef.current[3] = element;
          }}
          className={cn(step === 3 ? "space-y-4" : "hidden")}
        >
          <WizardGroup title="Step 4 · Services & add-ons" description="Select equipment package and optional add-ons.">
            <div className="grid gap-3 lg:grid-cols-2">
              <WizardSelect
                label="Equipment"
                name="equipmentOptionKey"
                required
                value={equipmentOptionKey}
                onChange={setEquipmentOptionKey}
                options={equipmentOptions.map((item) => ({ value: item.key, label: `${item.label} (${formatZar(item.price_cents)})` }))}
              />
            </div>
            {addons.length > 0 ? (
              <div className="grid gap-2 sm:grid-cols-2">
                {addons.map((addon) => {
                  const checked = selectedAddons.includes(addon.key);
                  return (
                    <label key={addon.key} className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700">
                      <input
                        name="addonKeys"
                        type="checkbox"
                        value={addon.key}
                        checked={checked}
                        onChange={(event) => toggleAddon(addon.key, event.target.checked)}
                      />
                      {addon.label} ({formatZar(addon.price_cents)})
                    </label>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-slate-600">No active add-ons configured for this service.</p>
            )}
          </WizardGroup>
        </fieldset>

        <fieldset
          ref={(element) => {
            fieldsetsRef.current[4] = element;
          }}
          className={cn(step === 4 ? "space-y-4" : "hidden")}
        >
          <WizardGroup title="Step 5 · Assignment & summary" description="Choose cleaner preference, review details, then submit.">
            <div className="grid gap-3 lg:grid-cols-2">
              <WizardSelect
                label="Preferred cleaner"
                name="selectedCleanerId"
                value={selectedCleanerId}
                onChange={setSelectedCleanerId}
                options={[
                  { value: "", label: "Auto-assign" },
                  ...cleaners.filter((cleaner) => cleaner.active).map((cleaner) => ({
                    value: cleaner.id,
                    label: cleaner.display_name ?? cleaner.full_name ?? cleaner.phone ?? cleaner.id,
                  })),
                ]}
              />
              <label>
                <span className="text-sm font-semibold text-slate-700">Access notes</span>
                <textarea
                  className="mt-2 min-h-24 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-emerald-500"
                  name="accessNotes"
                />
              </label>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Summary</p>
              <dl className="mt-3 grid gap-3 sm:grid-cols-2">
                <SummaryLine label="Customer" value={selectedCustomer ? `${selectedCustomer.full_name} (${selectedCustomer.email})` : "Not selected"} />
                <SummaryLine label="Schedule" value={bookingDate ? `${bookingDate} • ${bookingTime} • ${frequency}` : "Not selected"} />
                <SummaryLine label="Property" value={address && suburb ? `${address}, ${suburb} (${propertyType})` : "Not complete"} />
                <SummaryLine label="Rooms" value={`${bedrooms} bed / ${bathrooms} bath / ${extraRooms} extra`} />
                <SummaryLine label="Equipment" value={selectedEquipment ? `${selectedEquipment.label} (${formatZar(selectedEquipment.price_cents)})` : "Not selected"} />
                <SummaryLine
                  label="Add-ons"
                  value={selectedAddonRows.length > 0 ? selectedAddonRows.map((addon) => addon.label).join(", ") : "None"}
                />
                <SummaryLine label="Cleaner assignment" value={selectedCleaner ? selectedCleaner.display_name ?? selectedCleaner.full_name ?? "Preferred cleaner" : "Auto-assign"} />
                <SummaryLine label="Cleaner count" value={cleanerCount} />
              </dl>
            </div>
          </WizardGroup>
        </fieldset>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-4">
          <button
            className="inline-flex items-center gap-2 rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 disabled:opacity-40"
            type="button"
            onClick={previousStep}
            disabled={step === 0}
          >
            <ChevronLeft className="h-4 w-4" />
            Back
          </button>
          {step < totalSteps - 1 ? (
            <button
              className="inline-flex items-center gap-2 rounded-md bg-emerald-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-600"
              type="button"
              onClick={nextStep}
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </button>
          ) : (
            <button className="rounded-md bg-emerald-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-600" type="submit">
              Create admin booking
            </button>
          )}
        </div>
      </form>
    </div>
  );
}

function WizardGroup({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return (
    <div className="space-y-4 rounded-xl border border-slate-200 bg-slate-50 p-4 sm:p-5">
      <div>
        <h3 className="text-base font-bold text-slate-950">{title}</h3>
        <p className="mt-1 text-sm text-slate-600">{description}</p>
      </div>
      {children}
    </div>
  );
}

function WizardInput({
  label,
  value,
  onChange,
  ...props
}: Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange" | "value"> & {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label>
      <span className="text-sm font-semibold text-slate-700">{label}</span>
      <input
        className="mt-2 min-h-11 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none focus:border-emerald-500"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        {...props}
      />
    </label>
  );
}

function WizardSelect({
  label,
  options,
  value,
  onChange,
  ...props
}: Omit<React.SelectHTMLAttributes<HTMLSelectElement>, "onChange" | "value"> & {
  label: string;
  options: Array<{ value: string; label: string }>;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label>
      <span className="text-sm font-semibold text-slate-700">{label}</span>
      <select
        className="mt-2 min-h-11 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none focus:border-emerald-500"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        {...props}
      >
        {options.map((option) => (
          <option key={`${props.name}-${option.value}`} value={option.value}>{option.label}</option>
        ))}
      </select>
    </label>
  );
}

function SummaryLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2">
      <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">{label}</dt>
      <dd className="mt-1 text-sm text-slate-900">{value}</dd>
    </div>
  );
}

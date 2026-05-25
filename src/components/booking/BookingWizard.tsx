"use client";

import type React from "react";
import { useMemo, useState, useSyncExternalStore } from "react";
import { Check, ChevronLeft, ChevronRight, CreditCard, MapPin, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { capeTownSuburbs } from "@/lib/config/site";
import { bookingDraftSchema } from "@/lib/booking/schema";
import { calculateQuote, createEmptyBookingDraft } from "@/lib/booking/pricing";
import { serviceCatalog, getService } from "@/lib/booking/services";
import type { BookingDraft } from "@/lib/booking/types";
import { cn, formatZar } from "@/lib/utils";

const storageKey = "shalean.booking.v1";

const steps = [
  "Service",
  "Schedule",
  "Location",
  "Home",
  "Rooms",
  "Extras",
  "Assignment",
  "Review",
  "Checkout",
];

export function BookingWizard() {
  const [step, setStep] = useState(0);
  const draft = useSyncExternalStore(subscribeToDraft, getSavedDraftSnapshot, getServerDraftSnapshot);
  const [errors, setErrors] = useState<string[]>([]);
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const service = getService(draft.serviceSlug) ?? serviceCatalog[0];
  const quote = useMemo(() => calculateQuote(draft), [draft]);

  function update<T extends keyof BookingDraft>(key: T, value: BookingDraft[T]) {
    saveDraft({ ...draft, [key]: value });
  }

  function updateAddOn(key: keyof BookingDraft["addOns"], value: boolean) {
    saveDraft({
      ...draft,
      addOns: { ...draft.addOns, [key]: value },
    });
  }

  function nextStep() {
    const validationErrors = validateStep(step, draft);
    setErrors(validationErrors);
    if (validationErrors.length === 0) {
      setStep((current) => Math.min(steps.length - 1, current + 1));
    }
  }

  async function startCheckout() {
    const validationErrors = validateStep(steps.length - 1, draft);
    setErrors(validationErrors);

    if (validationErrors.length > 0) {
      setStep(7);
      return;
    }

    setIsCheckingOut(true);
    try {
      const response = await fetch("/api/paystack/initialize", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(draft),
      });
      const payload = (await response.json()) as {
        authorizationUrl?: string;
        error?: string;
      };

      if (!response.ok || !payload.authorizationUrl) {
        throw new Error(payload.error ?? "Unable to initialize Paystack checkout.");
      }

      window.location.assign(payload.authorizationUrl);
    } catch (error) {
      setErrors([error instanceof Error ? error.message : "Unable to initialize Paystack checkout."]);
    } finally {
      setIsCheckingOut(false);
    }
  }

  return (
    <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
      <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
        <div className="mb-6 flex flex-wrap gap-2">
          {steps.map((label, index) => (
            <button
              key={label}
              className={cn(
                "h-9 rounded-full border px-3 text-xs font-semibold transition",
                index === step
                  ? "border-emerald-700 bg-emerald-700 text-white"
                  : index < step
                    ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                    : "border-slate-200 bg-white text-slate-500",
              )}
              onClick={() => setStep(index)}
              type="button"
            >
              {index < step ? <Check className="mr-1 inline h-3.5 w-3.5" /> : null}
              {label}
            </button>
          ))}
        </div>

        {errors.length > 0 ? (
          <div className="mb-5 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
            {errors.join(" ")}
          </div>
        ) : null}

        <div className="min-h-[430px]">
          {renderStep(step, draft, update, updateAddOn, startCheckout, isCheckingOut)}
        </div>

        <div className="mt-6 flex items-center justify-between border-t border-slate-200 pt-5">
          <Button variant="outline" onClick={() => setStep((current) => Math.max(0, current - 1))} disabled={step === 0}>
            <ChevronLeft className="h-4 w-4" />
            Back
          </Button>
          <Button onClick={step === steps.length - 1 ? startCheckout : nextStep} disabled={isCheckingOut}>
            {step === steps.length - 1 ? (isCheckingOut ? "Opening Paystack" : "Confirm checkout") : "Continue"}
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <aside className="rounded-lg border border-slate-200 bg-slate-950 p-5 text-white shadow-sm lg:sticky lg:top-6 lg:self-start">
        <Badge className="border-teal-300 bg-teal-100 text-teal-900">Live estimate</Badge>
        <h2 className="mt-4 text-2xl font-bold">{formatZar(quote.totalCents)}</h2>
        <p className="mt-2 text-sm text-slate-300">{service.title} in {draft.suburb || "Cape Town"}</p>
        <dl className="mt-5 grid grid-cols-2 gap-3 text-sm">
          <div className="rounded-md bg-white/10 p-3">
            <dt className="text-slate-300">Cleaners</dt>
            <dd className="text-lg font-semibold">{quote.cleanerCount}</dd>
          </div>
          <div className="rounded-md bg-white/10 p-3">
            <dt className="text-slate-300">Hours</dt>
            <dd className="text-lg font-semibold">{quote.estimatedHours}</dd>
          </div>
        </dl>
        <div className="mt-5 space-y-2 text-sm">
          {quote.lineItems.map((item) => (
            <div key={item.label} className="flex justify-between gap-3 text-slate-200">
              <span className="capitalize">{item.label}</span>
              <span>{formatZar(item.amountCents)}</span>
            </div>
          ))}
          {quote.discountCents > 0 ? (
            <div className="flex justify-between text-teal-200">
              <span>Recurring discount</span>
              <span>-{formatZar(quote.discountCents)}</span>
            </div>
          ) : null}
        </div>
        <div className="mt-5 border-t border-white/15 pt-4 text-sm text-slate-300">
          Payout guard: {formatZar(quote.payout.perCleanerCents)} per cleaner. {quote.payout.rule}.
        </div>
      </aside>
    </section>
  );
}

let cachedRawDraft: string | null | undefined;
let cachedDraft = createEmptyBookingDraft();
const serverDraft = createEmptyBookingDraft();

function getServerDraftSnapshot() {
  return serverDraft;
}

function getSavedDraftSnapshot() {
  if (typeof window === "undefined") {
    return cachedDraft;
  }

  try {
    const saved = window.localStorage.getItem(storageKey);
    if (saved === cachedRawDraft) {
      return cachedDraft;
    }

    cachedRawDraft = saved;
    cachedDraft = saved ? mergeDraft(JSON.parse(saved) as Partial<BookingDraft>) : createEmptyBookingDraft();
    return cachedDraft;
  } catch {
    return cachedDraft;
  }
}

function subscribeToDraft(callback: () => void) {
  if (typeof window === "undefined") {
    return () => undefined;
  }

  window.addEventListener("storage", callback);
  window.addEventListener("shalean-booking-storage", callback);

  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener("shalean-booking-storage", callback);
  };
}

function saveDraft(nextDraft: BookingDraft) {
  if (typeof window === "undefined") {
    return;
  }

  const serialized = JSON.stringify(nextDraft);
  cachedRawDraft = serialized;
  cachedDraft = nextDraft;
  window.localStorage.setItem(storageKey, serialized);
  window.dispatchEvent(new Event("shalean-booking-storage"));
}

function mergeDraft(savedDraft: Partial<BookingDraft>) {
  const emptyDraft = createEmptyBookingDraft();

  return {
    ...emptyDraft,
    ...savedDraft,
    addOns: {
      ...emptyDraft.addOns,
      ...savedDraft.addOns,
    },
    customer: {
      ...emptyDraft.customer,
      ...savedDraft.customer,
    },
  };
}

function renderStep(
  step: number,
  draft: BookingDraft,
  update: <T extends keyof BookingDraft>(key: T, value: BookingDraft[T]) => void,
  updateAddOn: (key: keyof BookingDraft["addOns"], value: boolean) => void,
  onCheckout: () => void,
  isCheckingOut: boolean,
) {
  const service = getService(draft.serviceSlug) ?? serviceCatalog[0];

  switch (step) {
    case 0:
      return (
        <div>
          <StepTitle icon={<Sparkles />} title="Choose a service" text="Start with the clean type. Pricing and dispatch logic adapt from here." />
          <div className="grid gap-3 md:grid-cols-2">
            {serviceCatalog.map((item) => (
              <button
                key={item.slug}
                className={cn(
                  "rounded-lg border p-4 text-left transition hover:border-emerald-500",
                  draft.serviceSlug === item.slug ? "border-emerald-700 bg-emerald-50" : "border-slate-200 bg-white",
                )}
                onClick={() => update("serviceSlug", item.slug)}
                type="button"
              >
                <span className="text-base font-semibold text-slate-950">{item.title}</span>
                <span className="mt-2 block text-sm leading-6 text-slate-600">{item.summary}</span>
              </button>
            ))}
          </div>
        </div>
      );
    case 1:
      return (
        <FieldGrid title="Schedule">
          <Select label="Frequency" value={draft.frequency} onChange={(value) => update("frequency", value as BookingDraft["frequency"])}>
            <option value="once">Once-off</option>
            <option value="weekly">Weekly</option>
            <option value="fortnightly">Fortnightly</option>
            <option value="monthly">Monthly</option>
          </Select>
          <Input label="Preferred date" type="date" value={draft.date} onChange={(value) => update("date", value)} />
          <Select label="Arrival window" value={draft.timeWindow} onChange={(value) => update("timeWindow", value)}>
            <option value="08:00-12:00">08:00 - 12:00</option>
            <option value="12:00-16:00">12:00 - 16:00</option>
            <option value="16:00-19:00">16:00 - 19:00</option>
          </Select>
        </FieldGrid>
      );
    case 2:
      return (
        <FieldGrid title="Location">
          <Select label="Cape Town suburb" value={draft.suburb} onChange={(value) => update("suburb", value)}>
            {capeTownSuburbs.map((suburb) => (
              <option key={suburb} value={suburb}>{suburb}</option>
            ))}
          </Select>
          <Input label="Street address" value={draft.address} onChange={(value) => update("address", value)} placeholder="Start typing your address" />
          <div className="rounded-md border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-600 md:col-span-2">
            <MapPin className="mb-2 h-5 w-5 text-emerald-700" />
            Google Maps autocomplete can plug into this field with the persisted address model already in place.
          </div>
        </FieldGrid>
      );
    case 3:
      return (
        <FieldGrid title="House details">
          <Select label="Property type" value={draft.propertyType} onChange={(value) => update("propertyType", value as BookingDraft["propertyType"])}>
            <option value="apartment">Apartment</option>
            <option value="house">House</option>
            <option value="office">Office</option>
            <option value="airbnb">Airbnb</option>
          </Select>
          <Input label="Approximate size" type="number" value={String(draft.squareMeters)} onChange={(value) => update("squareMeters", Number(value))} suffix="m2" />
        </FieldGrid>
      );
    case 4:
      return (
        <FieldGrid title="Bedrooms and bathrooms">
          <Input label="Bedrooms" type="number" value={String(draft.bedrooms)} onChange={(value) => update("bedrooms", Number(value))} />
          <Input label="Bathrooms" type="number" value={String(draft.bathrooms)} onChange={(value) => update("bathrooms", Number(value))} />
          <Input label="Extra rooms" type="number" value={String(draft.extraRooms)} onChange={(value) => update("extraRooms", Number(value))} />
        </FieldGrid>
      );
    case 5:
      return (
        <div>
          <StepTitle title="Add-ons and equipment" text="Extras update the quote immediately and are stored with the booking draft." />
          <div className="grid gap-3 md:grid-cols-2">
            {Object.entries(draft.addOns).map(([key, enabled]) => (
              <label key={key} className="flex cursor-pointer items-center justify-between rounded-lg border border-slate-200 p-4 text-sm font-semibold capitalize text-slate-800">
                {key.replace(/([A-Z])/g, " $1").toLowerCase()}
                <input className="h-5 w-5 accent-emerald-700" type="checkbox" checked={enabled} onChange={(event) => updateAddOn(key as keyof BookingDraft["addOns"], event.target.checked)} />
              </label>
            ))}
          </div>
        </div>
      );
    case 6:
      return (
        <FieldGrid title={service.requiresTeam ? "Team dispatch" : "Cleaner selection"}>
          <Select label="Assignment mode" value={draft.assignmentMode} onChange={(value) => update("assignmentMode", value as BookingDraft["assignmentMode"])}>
            <option value="auto">Auto-assign best available</option>
            <option value="preferred_cleaner">Preferred cleaner</option>
            <option value="customer_team">Customer-selected team</option>
          </Select>
          <Input label={service.requiresTeam ? "Requested team size" : "Requested cleaners"} type="number" value={String(draft.requestedCleaners)} onChange={(value) => update("requestedCleaners", Number(value))} />
          <Input label="Preferred cleaner ID" value={draft.preferredCleanerId ?? ""} onChange={(value) => update("preferredCleanerId", value)} placeholder="Optional" />
        </FieldGrid>
      );
    case 7:
      return (
        <FieldGrid title="Review details">
          <Input label="Full name" value={draft.customer.name} onChange={(value) => update("customer", { ...draft.customer, name: value })} />
          <Input label="Email" type="email" value={draft.customer.email} onChange={(value) => update("customer", { ...draft.customer, email: value })} />
          <Input label="Phone" value={draft.customer.phone} onChange={(value) => update("customer", { ...draft.customer, phone: value })} />
          <label className="md:col-span-2">
            <span className="text-sm font-semibold text-slate-800">Access notes</span>
            <textarea className="mt-2 min-h-28 w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-emerald-700" value={draft.notes} onChange={(event) => update("notes", event.target.value)} />
          </label>
        </FieldGrid>
      );
    default:
      return (
        <div className="flex min-h-[360px] flex-col items-start justify-center">
          <StepTitle icon={<CreditCard />} title="Secure checkout" text="The booking is ready for Paystack initialization with a server-side secret key and idempotency-ready metadata." />
          <Button size="lg" onClick={onCheckout} disabled={isCheckingOut}>
            {isCheckingOut ? "Opening Paystack" : "Prepare Paystack payment"}
          </Button>
        </div>
      );
  }
}

function validateStep(step: number, draft: BookingDraft) {
  if (step < 7) {
    return [];
  }

  const result = bookingDraftSchema.safeParse(draft);
  if (result.success) {
    return [];
  }

  return result.error.issues.slice(0, 3).map((issue) => `${issue.path.join(".")}: ${issue.message}.`);
}

function StepTitle({ icon, title, text }: { icon?: React.ReactNode; title: string; text: string }) {
  return (
    <div className="mb-5">
      <div className="flex items-center gap-2 text-emerald-700">
        {icon ? <span className="[&_svg]:h-5 [&_svg]:w-5">{icon}</span> : null}
        <h2 className="text-2xl font-bold text-slate-950">{title}</h2>
      </div>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">{text}</p>
    </div>
  );
}

function FieldGrid({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <StepTitle title={title} text="Keep going. Your progress is saved automatically on this device." />
      <div className="grid gap-4 md:grid-cols-2">{children}</div>
    </div>
  );
}

function Input({
  label,
  value,
  onChange,
  suffix,
  ...props
}: Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange"> & {
  label: string;
  value: string;
  suffix?: string;
  onChange: (value: string) => void;
}) {
  return (
    <label>
      <span className="text-sm font-semibold text-slate-800">{label}</span>
      <div className="mt-2 flex rounded-md border border-slate-300 bg-white focus-within:border-emerald-700">
        <input className="min-h-11 w-full rounded-md px-3 text-sm outline-none" value={value} onChange={(event) => onChange(event.target.value)} {...props} />
        {suffix ? <span className="flex items-center px-3 text-sm text-slate-500">{suffix}</span> : null}
      </div>
    </label>
  );
}

function Select({
  label,
  value,
  onChange,
  children,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  children: React.ReactNode;
}) {
  return (
    <label>
      <span className="text-sm font-semibold text-slate-800">{label}</span>
      <select className="mt-2 min-h-11 w-full rounded-md border border-slate-300 bg-white px-3 text-sm outline-none focus:border-emerald-700" value={value} onChange={(event) => onChange(event.target.value)}>
        {children}
      </select>
    </label>
  );
}

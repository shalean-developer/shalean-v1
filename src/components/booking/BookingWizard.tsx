"use client";

import type React from "react";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import Image from "next/image";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  Minus,
  MapPin,
  PackageCheck,
  Plus,
  Sparkles,
  Star,
  UsersRound,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { capeTownSuburbs } from "@/lib/config/site";
import { bookingDraftSchema } from "@/lib/booking/schema";
import {
  calculateQuote,
  createEmptyBookingDraft,
  equipmentPackage,
  getSelectedAddOns,
  regularCleaningAddOns,
} from "@/lib/booking/pricing";
import { serviceCatalog, getService } from "@/lib/booking/services";
import { getAvailableCleaners, getCleanerById } from "@/lib/booking/cleaners";
import type { AssignmentMode, BookingDraft, BookingQuote, EquipmentMode } from "@/lib/booking/types";
import { formatRecurrenceSummary, WEEKDAYS } from "@/lib/regular-cleaning/recurrence";
import type { RegularCleaningCatalog, RegularCleaningQuoteResponse } from "@/lib/regular-cleaning/types";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { cn, formatZar } from "@/lib/utils";

const storageKey = "shalean.booking.v1";

const steps = [
  "Service",
  "Schedule",
  "Location",
  "House Details",
  "Cleaner Selection",
  "Review",
  "Checkout",
];

function isCustomerIdentityComplete(draft: BookingDraft) {
  return draft.customer.name.trim().length >= 2 &&
    draft.customer.email.includes("@") &&
    draft.customer.phone.trim().length >= 8;
}

export function BookingWizard() {
  const [step, setStep] = useState(0);
  const draft = useSyncExternalStore(subscribeToDraft, getSavedDraftSnapshot, getServerDraftSnapshot);
  const [errors, setErrors] = useState<string[]>([]);
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [regularCatalog, setRegularCatalog] = useState<RegularCleaningCatalog | null>(null);
  const [serverQuote, setServerQuote] = useState<RegularCleaningQuoteResponse | null>(null);
  const [isQuoteLoading, setIsQuoteLoading] = useState(false);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [isCustomerAuthenticated, setIsCustomerAuthenticated] = useState(false);
  const [isCustomerProfileReady, setIsCustomerProfileReady] = useState(false);
  const [isAuthChecking, setIsAuthChecking] = useState(true);
  const service = getService(draft.serviceSlug) ?? serviceCatalog[0];
  const clientQuote = useMemo(() => calculateQuote(draft), [draft]);
  const quote = useMemo(
    () => serverQuote ? toBookingQuote(serverQuote, draft, clientQuote) : clientQuote,
    [clientQuote, draft, serverQuote],
  );
  const stepValidationErrors = validateStep(step, draft);
  const quoteBlocked = draft.serviceSlug === "regular-cleaning" && (isQuoteLoading || Boolean(quoteError) || !serverQuote);
  const canContinue = stepValidationErrors.length === 0 && !isCheckingOut && (step < 3 || !quoteBlocked) && (step !== 6 || (isCustomerAuthenticated && isCustomerProfileReady));

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    let mounted = true;

    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (!mounted) return;
        const authenticated = Boolean(data.session?.user);
        setIsCustomerAuthenticated(authenticated);
        setIsCustomerProfileReady(authenticated && isCustomerIdentityComplete(cachedDraft));
      })
      .catch(() => {
        if (!mounted) return;
        setIsCustomerAuthenticated(false);
        setIsCustomerProfileReady(false);
      })
      .finally(() => {
        if (!mounted) return;
        setIsAuthChecking(false);
      });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      const authenticated = Boolean(session?.user);
      setIsCustomerAuthenticated(authenticated);
      setIsCustomerProfileReady(authenticated && isCustomerIdentityComplete(cachedDraft));
      setIsAuthChecking(false);
    });

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const params = new URLSearchParams(window.location.search);
    if (params.get("new") === "1") {
      resetDraft();
      window.history.replaceState(null, "", window.location.pathname);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadCatalog() {
      if (draft.serviceSlug !== "regular-cleaning") {
        setRegularCatalog(null);
        return;
      }

      const response = await fetch(`/api/regular-cleaning/catalog?suburb=${encodeURIComponent(draft.suburb)}`);
      if (!response.ok) {
        return;
      }

      const payload = (await response.json()) as { catalog: RegularCleaningCatalog };
      if (!cancelled) {
        setRegularCatalog(payload.catalog);
      }
    }

    loadCatalog();

    return () => {
      cancelled = true;
    };
  }, [draft.serviceSlug, draft.suburb]);

  useEffect(() => {
    const controller = new AbortController();
    const timeout = window.setTimeout(async () => {
      setIsQuoteLoading(true);
      setQuoteError(null);

      try {
        const response = await fetch("/api/bookings/quote", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(draft),
          signal: controller.signal,
        });
        const payload = await response.json() as RegularCleaningQuoteResponse & { error?: string };

        if (!response.ok || !payload.quote) {
          throw new Error(payload.error ?? "Unable to refresh quote.");
        }

        setServerQuote(payload);
      } catch (error) {
        if (!controller.signal.aborted) {
          setQuoteError(error instanceof Error ? error.message : "Unable to refresh quote.");
          setServerQuote(null);
        }
      } finally {
        if (!controller.signal.aborted) {
          setIsQuoteLoading(false);
        }
      }
    }, 250);

    return () => {
      controller.abort();
      window.clearTimeout(timeout);
    };
  }, [draft]);

  function update<T extends keyof BookingDraft>(key: T, value: BookingDraft[T]) {
    saveDraft({ ...draft, [key]: value });
  }

  function updateAddOn(key: keyof BookingDraft["addOns"], value: boolean) {
    saveDraft({
      ...draft,
      addOns: { ...draft.addOns, [key]: value },
    });
  }

  function updateEquipmentMode(mode: EquipmentMode) {
    saveDraft({
      ...draft,
      equipment: {
        ...draft.equipment,
        mode,
      },
    });
  }

  function updateRecurrenceWeekday(weekday: number, enabled: boolean) {
    const weekdays = enabled
      ? [...draft.recurrence.weekdays, weekday]
      : draft.recurrence.weekdays.filter((day) => day !== weekday);

    saveDraft({
      ...draft,
      recurrence: {
        ...draft.recurrence,
        weekdays: Array.from(new Set(weekdays)).sort((a, b) => a - b),
      },
    });
  }

  function updateCleanerCount(nextCount: number) {
    const requestedCleaners = Math.min(4, Math.max(1, nextCount));
    saveDraft({
      ...draft,
      requestedCleaners,
      assignmentMode: draft.preferredCleanerId ? "preferred_cleaner" : "auto",
    });
  }

  function toggleCleaner(cleanerId: string) {
    const selected = draft.preferredCleanerId === cleanerId;
    const selectedCleanerIds = selected ? [] : [cleanerId];

    saveDraft({
      ...draft,
      selectedCleanerIds,
      preferredCleanerId: selected ? undefined : cleanerId,
      assignmentMode: selectedCleanerIds.length > 0 ? "preferred_cleaner" : "auto",
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
      setStep(5);
      return;
    }

    if (quoteBlocked) {
      setErrors([quoteError ?? "Please wait for the latest quote before checkout."]);
      return;
    }

    if (!isCustomerAuthenticated || !isCustomerProfileReady) {
      setErrors(["Log in or sign up and complete your customer details before checkout. Your booking draft is still saved."]);
      setStep(6);
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
        code?: string;
        error?: string;
      };

      if (response.status === 409 && payload.code === "PREFERRED_CLEANER_UNAVAILABLE") {
        saveDraft({
          ...draft,
          preferredCleanerId: undefined,
          selectedCleanerIds: [],
          assignmentMode: "auto",
        });
        setStep(4);
        throw new Error(payload.error ?? "That preferred cleaner is no longer available. Please continue with auto-assignment.");
      }

      if (!response.ok || !payload.authorizationUrl) {
        throw new Error(payload.code === "CUSTOMER_AUTH_REQUIRED" ? "Log in or sign up before checkout." : payload.error ?? "Unable to initialize Paystack checkout.");
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
                  : "border-slate-200 bg-white text-slate-500 disabled:cursor-not-allowed disabled:opacity-45",
              )}
              onClick={() => setStep(index)}
              disabled={index > step && validateStepsBefore(index, draft).length > 0}
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
          {renderStep({
            step,
            draft,
            quote,
            regularCatalog,
            update,
            updateAddOn,
            updateEquipmentMode,
            updateRecurrenceWeekday,
            updateCleanerCount,
            toggleCleaner,
            onCheckout: startCheckout,
            isCheckingOut,
            isQuoteLoading,
            quoteError,
            quoteResponse: serverQuote,
            isCustomerAuthenticated,
            isCustomerProfileReady,
            isAuthChecking,
            onAuthChange: setIsCustomerAuthenticated,
            onProfileReadyChange: setIsCustomerProfileReady,
          })}
        </div>

        <div className="mt-6 flex items-center justify-between border-t border-slate-200 pt-5">
          <Button variant="outline" onClick={() => setStep((current) => Math.max(0, current - 1))} disabled={step === 0}>
            <ChevronLeft className="h-4 w-4" />
            Back
          </Button>
          <div className="flex items-center gap-3">
            <Button variant="outline" onClick={() => { resetDraft(); setStep(0); setErrors([]); }} type="button">
              Start new booking
            </Button>
            <Button onClick={step === steps.length - 1 ? startCheckout : nextStep} disabled={!canContinue}>
            {step === steps.length - 1 ? (isCheckingOut ? "Opening Paystack" : "Confirm checkout") : "Continue"}
            <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      <aside className="rounded-lg border border-slate-200 bg-slate-950 p-5 text-white shadow-sm lg:sticky lg:top-6 lg:self-start">
        <Badge className="border-teal-300 bg-teal-100 text-teal-900">{isQuoteLoading ? "Refreshing estimate" : "Live estimate"}</Badge>
        <h2 className="mt-4 text-2xl font-bold">{formatZar(quote.totalCents)}</h2>
        <p className="mt-2 text-sm text-slate-300">{service.title} in {draft.suburb || "Cape Town"}</p>
        {quoteError ? <p className="mt-3 rounded-md bg-red-500/15 p-2 text-xs text-red-100">{quoteError}</p> : null}
        {serverQuote?.isRecurring ? (
          <p className="mt-3 rounded-md bg-white/10 p-2 text-xs text-teal-100">
            {serverQuote.occurrences.length} prepaid visits. {formatRecurrenceSummary(draft.frequency, draft.recurrence.weekdays)}.
          </p>
        ) : null}
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
          Checkout uses the latest server quote. Cleaner earnings are calculated separately after payment.
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

function resetDraft() {
  if (typeof window === "undefined") {
    return;
  }

  const nextDraft = createEmptyBookingDraft();
  cachedRawDraft = null;
  cachedDraft = nextDraft;
  window.localStorage.removeItem(storageKey);
  window.dispatchEvent(new Event("shalean-booking-storage"));
}

function mergeDraft(savedDraft: Partial<BookingDraft>): BookingDraft {
  const emptyDraft = createEmptyBookingDraft();

  return {
    ...emptyDraft,
    ...savedDraft,
    checkoutId: isUuid(savedDraft.checkoutId) ? savedDraft.checkoutId : emptyDraft.checkoutId,
    squareMeters:
      typeof savedDraft.squareMeters === "number" && savedDraft.squareMeters >= 20
        ? savedDraft.squareMeters
        : emptyDraft.squareMeters,
    addOns: mergeAddOns(savedDraft.addOns),
    equipment: {
      ...emptyDraft.equipment,
      ...savedDraft.equipment,
    },
    recurrence: {
      ...emptyDraft.recurrence,
      ...savedDraft.recurrence,
      weekdays: savedDraft.recurrence?.weekdays ?? emptyDraft.recurrence.weekdays,
    },
    customer: {
      ...emptyDraft.customer,
      ...savedDraft.customer,
    },
    preferredCleanerId: savedDraft.preferredCleanerId,
    selectedCleanerIds: savedDraft.preferredCleanerId
      ? [savedDraft.preferredCleanerId]
      : savedDraft.selectedCleanerIds ?? [],
  };
}

function mergeAddOns(savedAddOns: Partial<BookingDraft["addOns"]> | undefined) {
  const emptyAddOns = createEmptyBookingDraft().addOns;
  const legacyAddOns = savedAddOns as (Partial<BookingDraft["addOns"]> & { windows?: boolean }) | undefined;

  return {
    ...emptyAddOns,
    ...savedAddOns,
    interiorWindows: savedAddOns?.interiorWindows ?? legacyAddOns?.windows ?? false,
  };
}

function renderStep({
  step,
  draft,
  quote,
  regularCatalog,
  update,
  updateAddOn,
  updateEquipmentMode,
  updateRecurrenceWeekday,
  updateCleanerCount,
  toggleCleaner,
  onCheckout,
  isCheckingOut,
  isQuoteLoading,
  quoteError,
  quoteResponse,
  isCustomerAuthenticated,
  isCustomerProfileReady,
  isAuthChecking,
  onAuthChange,
  onProfileReadyChange,
}: {
  step: number;
  draft: BookingDraft;
  quote: BookingQuote;
  regularCatalog: RegularCleaningCatalog | null;
  update: <T extends keyof BookingDraft>(key: T, value: BookingDraft[T]) => void;
  updateAddOn: (key: keyof BookingDraft["addOns"], value: boolean) => void;
  updateEquipmentMode: (mode: EquipmentMode) => void;
  updateRecurrenceWeekday: (weekday: number, enabled: boolean) => void;
  updateCleanerCount: (count: number) => void;
  toggleCleaner: (cleanerId: string) => void;
  onCheckout: () => void;
  isCheckingOut: boolean;
  isQuoteLoading: boolean;
  quoteError: string | null;
  quoteResponse: RegularCleaningQuoteResponse | null;
  isCustomerAuthenticated: boolean;
  isCustomerProfileReady: boolean;
  isAuthChecking: boolean;
  onAuthChange: (authenticated: boolean) => void;
  onProfileReadyChange: (ready: boolean) => void;
}) {
  const service = getService(draft.serviceSlug) ?? serviceCatalog[0];
  const premiumAddOns = regularCatalog?.addons.map((addOn) => ({
    key: addOn.key as keyof BookingDraft["addOns"],
    label: addOn.label,
    description: addOn.description ?? "",
    priceCents: addOn.price_cents,
    durationHours: addOn.duration_minutes / 60,
  })) ?? regularCleaningAddOns;
  const withEquipmentOption = regularCatalog?.equipmentOptions.find((option) => option.key === "with_equipment");
  const withoutEquipmentOption = regularCatalog?.equipmentOptions.find((option) => option.key === "without_equipment");

  switch (step) {
    case 0:
      {
        const regularService = regularCatalog?.service;
        const regularServiceCard = regularService
          ? {
              slug: "regular-cleaning",
              title: regularService.title ?? regularService.name ?? "Regular Cleaning",
              summary: regularService.description ?? "Recurring or once-off home cleaning with flexible cleaner selection.",
            }
          : {
              slug: "regular-cleaning",
              title: "Regular Cleaning",
              summary: "Loading Regular Cleaning from Supabase...",
            };

      return (
        <div>
          <StepTitle icon={<Sparkles />} title="Choose a service" text="Start with the clean type. Pricing and dispatch logic adapt from here." />
          <div className="grid gap-3 md:grid-cols-2">
            {[regularServiceCard].map((item) => (
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
      }
    case 1:
      return (
        <FieldGrid title="Schedule">
          <Select label="Frequency" value={draft.frequency} onChange={(value) => update("frequency", value as BookingDraft["frequency"])}>
            <option value="once">Once-off</option>
            <option value="weekly">Weekly</option>
            <option value="fortnightly">Fortnightly</option>
            <option value="monthly">Monthly</option>
          </Select>
          <Input label="Preferred date" type="date" min={todayInJohannesburg()} value={draft.date} onChange={(value) => update("date", value)} />
          <Select label="Arrival window" value={draft.timeWindow} onChange={(value) => update("timeWindow", value)}>
            <option value="08:00-12:00">08:00 - 12:00</option>
            <option value="12:00-16:00">12:00 - 16:00</option>
            <option value="16:00-19:00">16:00 - 19:00</option>
          </Select>
          {draft.frequency === "weekly" || draft.frequency === "fortnightly" ? (
            <WeekdaySelector
              selectedWeekdays={draft.recurrence.weekdays}
              onToggle={updateRecurrenceWeekday}
            />
          ) : null}
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
          <label className="md:col-span-2">
            <span className="text-sm font-semibold text-slate-800">Access notes</span>
            <textarea
              className="mt-2 min-h-24 w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-emerald-700"
              value={draft.notes}
              onChange={(event) => update("notes", event.target.value)}
              placeholder="Gate code, parking, pets, or anything the cleaner should know before arrival"
            />
          </label>
          <div className="rounded-md border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-600 md:col-span-2">
            <MapPin className="mb-2 h-5 w-5 text-emerald-700" />
            Google Maps autocomplete can plug into this field with the persisted address model already in place.
          </div>
        </FieldGrid>
      );
    case 3:
      return (
        <div>
          <StepTitle title="House details" text="Choose rooms, premium add-ons, and whether Shalean should bring professional equipment." />
          <div className="grid gap-4 sm:grid-cols-3">
            <Input label="Bedrooms" type="number" value={String(draft.bedrooms)} onChange={(value) => update("bedrooms", Number(value))} />
            <Input label="Bathrooms" type="number" value={String(draft.bathrooms)} onChange={(value) => update("bathrooms", Number(value))} />
            <Input label="Extra rooms" type="number" value={String(draft.extraRooms)} onChange={(value) => update("extraRooms", Number(value))} />
          </div>

          <div className="mt-7">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-bold text-slate-950">Premium add-ons</h3>
                <p className="mt-1 text-sm text-slate-600">Add detail work without slowing down checkout.</p>
              </div>
              <Badge>{formatZar(quote.addOnTotalCents)}</Badge>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              {premiumAddOns.map((addOn) => {
                const enabled = draft.addOns[addOn.key];

                return (
                  <button
                    key={addOn.key}
                    className={cn(
                      "rounded-lg border p-4 text-left transition hover:border-emerald-500",
                      enabled ? "border-emerald-700 bg-emerald-50" : "border-slate-200 bg-white",
                    )}
                    onClick={() => updateAddOn(addOn.key, !enabled)}
                    type="button"
                  >
                    <span className="flex items-start justify-between gap-3">
                      <span>
                        <span className="block text-sm font-bold text-slate-950">{addOn.label}</span>
                        <span className="mt-1 block text-xs leading-5 text-slate-600">{addOn.description}</span>
                      </span>
                      <span className="rounded-full bg-white px-2 py-1 text-xs font-bold text-emerald-800 shadow-sm">
                        {formatZar(addOn.priceCents)}
                      </span>
                    </span>
                    <span className="mt-3 block text-xs font-semibold text-slate-500">
                      Adds about {addOn.durationHours}h workload
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="mt-6 grid gap-3 md:grid-cols-2">
            <EquipmentCard
              active={draft.equipment.mode === "with_equipment"}
              mode="with_equipment"
              onSelect={updateEquipmentMode}
              title={withEquipmentOption?.label ?? "With Equipment"}
              price={formatZar(withEquipmentOption?.price_cents ?? equipmentPackage.priceCents)}
              text={withEquipmentOption?.description ?? "Shalean supplies vacuum cleaner, mop & bucket, chemicals, cloths, and professional tools."}
            />
            <EquipmentCard
              active={draft.equipment.mode === "without_equipment"}
              mode="without_equipment"
              onSelect={updateEquipmentMode}
              title={withoutEquipmentOption?.label ?? "Without Equipment"}
              price={formatZar(withoutEquipmentOption?.price_cents ?? 0)}
              text={withoutEquipmentOption?.description ?? "Use this if your home already has suitable cleaning equipment and products available."}
            />
          </div>
        </div>
      );
    case 4:
      return (
        <CleanerSelection
          draft={draft}
          quote={quote}
          catalog={regularCatalog}
          isRegularCleaning={service.category === "regular"}
          serviceRequiresTeam={service.requiresTeam}
          onCleanerCountChange={updateCleanerCount}
          onToggleCleaner={toggleCleaner}
          onAssignmentModeChange={(assignmentMode) => update("assignmentMode", assignmentMode)}
        />
      );
    case 5:
      return (
        <div>
          <StepTitle title="Review booking" text="Check the visit details, cleaner preference, extras, equipment, recurrence, and latest server quote before checkout." />
          <BookingSummary draft={draft} quote={quote} catalog={regularCatalog} quoteResponse={quoteResponse} />
        </div>
      );
    case 6:
    default:
      if (!isCustomerAuthenticated || !isCustomerProfileReady) {
        return (
          <div>
            <StepTitle icon={<CreditCard />} title="Sign in before checkout" text="Your booking draft is saved. Log in or create an account to continue to secure Paystack payment." />
            <CustomerAuthGate
              draft={draft}
              isChecking={isAuthChecking}
              isAuthenticated={isCustomerAuthenticated}
              onAuthChange={onAuthChange}
              onProfileReadyChange={onProfileReadyChange}
            />
          </div>
        );
      }

      return (
        <div className="flex min-h-[360px] flex-col items-start justify-center">
          <StepTitle icon={<CreditCard />} title="Secure checkout" text="The booking is ready for Paystack initialization with a server-side secret key and idempotency-ready metadata." />
          {quoteError ? <p className="mb-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">{quoteError}</p> : null}
          {quoteResponse?.isRecurring ? (
            <p className="mb-4 max-w-xl rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
              Checkout will charge {formatZar(quoteResponse.seriesTotalCents)} for {quoteResponse.occurrences.length} scheduled Regular Cleaning visits.
            </p>
          ) : null}
          <Button size="lg" onClick={onCheckout} disabled={isCheckingOut}>
            {isCheckingOut ? "Opening Paystack" : isQuoteLoading ? "Refreshing quote" : "Prepare Paystack payment"}
          </Button>
        </div>
      );
  }
}

function validateStep(step: number, draft: BookingDraft) {
  if (step === 1) {
    const errors = [];
    if (!draft.date) errors.push("Choose a preferred date.");
    if (draft.date && draft.date < todayInJohannesburg()) errors.push("Choose today or a future date.");
    if (!draft.timeWindow) errors.push("Choose an arrival window.");
    if ((draft.frequency === "weekly" || draft.frequency === "fortnightly") && draft.recurrence.weekdays.length === 0) {
      errors.push("Choose at least one recurring weekday.");
    }
    return errors;
  }

  if (step === 2) {
    const errors = [];
    if (draft.suburb.length < 2) errors.push("Choose a Cape Town suburb.");
    if (draft.address.trim().length < 5) errors.push("Enter a street address.");
    return errors;
  }

  if (step === 3) {
    const errors = [];
    if (!Number.isInteger(draft.bedrooms) || draft.bedrooms < 0) errors.push("Bedrooms must be zero or more.");
    if (!Number.isInteger(draft.bathrooms) || draft.bathrooms < 0) errors.push("Bathrooms must be zero or more.");
    if (!Number.isInteger(draft.extraRooms) || draft.extraRooms < 0) errors.push("Extra rooms must be zero or more.");
    return errors;
  }

  if (step === 4) {
    if (!Number.isInteger(draft.requestedCleaners) || draft.requestedCleaners < 1 || draft.requestedCleaners > 4) {
      return ["Choose between 1 and 4 cleaners."];
    }
    return [];
  }

  if (step === 5) {
    return [];
  }

  if (step < 5) {
    return [];
  }

  const result = bookingDraftSchema.safeParse(draft);
  if (result.success) {
    return [];
  }

  return result.error.issues.slice(0, 3).map((issue) => `${issue.path.join(".")}: ${issue.message}.`);
}

function validateStepsBefore(targetStep: number, draft: BookingDraft) {
  const errors: string[] = [];

  for (let index = 0; index < targetStep; index += 1) {
    errors.push(...validateStep(index, draft));
  }

  return errors;
}

function todayInJohannesburg() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Johannesburg",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function isUuid(value: unknown): value is string {
  return typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function CustomerAuthGate({
  draft,
  isChecking,
  isAuthenticated,
  onAuthChange,
  onProfileReadyChange,
}: {
  draft: BookingDraft;
  isChecking: boolean;
  isAuthenticated: boolean;
  onAuthChange: (authenticated: boolean) => void;
  onProfileReadyChange: (ready: boolean) => void;
}) {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState(draft.customer.email);
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState(draft.customer.name);
  const [phone, setPhone] = useState(draft.customer.phone);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const candidateDraft = { ...draft, customer: { name: fullName, email, phone } };
  const identityComplete = isCustomerIdentityComplete(candidateDraft);
  const profileMissing = isAuthenticated && !identityComplete;
  const canSubmitAuth = isAuthenticated
    ? identityComplete
    : mode === "login"
      ? email.includes("@") && password.length > 0
      : identityComplete && password.length >= 6;

  async function submitAuth(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setMessage(null);

    try {
      const supabase = createSupabaseBrowserClient();
      const result = isAuthenticated
        ? { error: null }
        : mode === "login"
          ? await supabase.auth.signInWithPassword({ email, password })
          : await supabase.auth.signUp({
              email,
              password,
              options: {
                data: {
                  full_name: fullName,
                  phone,
                },
              },
            });

      if (result.error) {
        throw result.error;
      }

      const profileResult = await fetch("/api/auth/customer-profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName,
          email,
          phone,
        }),
      });

      if (!profileResult.ok) {
        throw new Error("Signed in, but could not attach the customer profile.");
      }

      onAuthChange(true);
      onProfileReadyChange(true);
      saveDraft({
        ...draft,
        customer: {
          name: fullName,
          email,
          phone,
        },
      });
      setMessage("Account ready. Continue to Paystack checkout.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to authenticate customer.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_280px]">
      <form onSubmit={submitAuth} className="rounded-lg border border-slate-200 bg-white p-4">
        {!isAuthenticated ? (
          <div className="flex gap-2">
            <button
              className={mode === "login" ? "rounded-md bg-emerald-700 px-3 py-2 text-sm font-bold text-white" : "rounded-md border border-slate-300 px-3 py-2 text-sm font-bold text-slate-700"}
              onClick={() => setMode("login")}
              type="button"
            >
              Log in
            </button>
            <button
              className={mode === "signup" ? "rounded-md bg-emerald-700 px-3 py-2 text-sm font-bold text-white" : "rounded-md border border-slate-300 px-3 py-2 text-sm font-bold text-slate-700"}
              onClick={() => setMode("signup")}
              type="button"
            >
              Sign up
            </button>
          </div>
        ) : (
          <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm font-semibold text-emerald-900">
            You are signed in. Complete your customer details to continue.
          </div>
        )}

        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {mode === "signup" || profileMissing ? (
            <>
              <Input label="Full name" value={fullName} onChange={setFullName} />
              <Input label="Phone" value={phone} onChange={setPhone} />
            </>
          ) : null}
          <Input label="Email" type="email" value={email} onChange={setEmail} />
          {!isAuthenticated ? <Input label="Password" type="password" value={password} onChange={setPassword} /> : null}
        </div>

        {message ? (
          <div className="mt-4 rounded-md border border-slate-200 bg-slate-50 p-3 text-sm font-semibold text-slate-700">
            {message}
          </div>
        ) : null}

        <button
          className="mt-4 rounded-md bg-emerald-700 px-4 py-3 text-sm font-bold text-white disabled:opacity-60"
          disabled={isSubmitting || isChecking || !canSubmitAuth}
          type="submit"
        >
          {isSubmitting ? "Checking account" : isAuthenticated ? "Save details and continue" : mode === "login" ? "Log in and continue" : "Create account and continue"}
        </button>
      </form>

      <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-950">
        <h3 className="font-bold">Your draft is preserved</h3>
        <p className="mt-2 leading-6">
          After login or signup, the current booking summary, preferred cleaner, add-ons, equipment, and recurring schedule stay in place.
        </p>
      </div>
    </div>
  );
}

function toBookingQuote(
  response: RegularCleaningQuoteResponse,
  draft: BookingDraft,
  fallback: BookingQuote,
): BookingQuote {
  const lineItems: BookingQuote["lineItems"] = [
    { label: "Regular Cleaning", amountCents: response.quote.basePriceCents, category: "base" },
    ...response.quote.selectedAddons.map((addOn) => ({
      label: addOn.label,
      amountCents: addOn.priceCents,
      durationHours: addOn.durationMinutes / 60,
      category: "addon" as const,
    })),
  ];

  if (response.quote.extraRoomAllocationCents > 0) {
    lineItems.push({
      label: `${draft.extraRooms} extra room allocation`,
      amountCents: response.quote.extraRoomAllocationCents,
      category: "rooms",
    });
  }

  if (response.quote.equipmentTotalCents > 0) {
    lineItems.push({
      label: response.quote.equipmentOption.label,
      amountCents: response.quote.equipmentTotalCents,
      category: "equipment",
    });
  }

  if (response.quote.extraCleanersTotalCents > 0) {
    lineItems.push({
      label: `${response.quote.cleanerCount} cleaner team speed-up`,
      amountCents: response.quote.extraCleanersTotalCents,
      category: "cleaners",
    });
  }

  if (response.isRecurring) {
    lineItems.push({
      label: `${response.occurrences.length} prepaid visits`,
      amountCents: response.seriesTotalCents - response.quote.finalTotalCents,
      category: "base",
    });
  }

  return {
    ...fallback,
    serviceSlug: "regular-cleaning",
    totalCents: response.seriesTotalCents,
    subtotalCents: response.seriesTotalCents,
    discountCents: 0,
    cleanerCount: response.quote.cleanerCount,
    recommendedCleanerCount: response.quote.recommendedCleanerCount,
    estimatedHours: Number((response.quote.estimatedMinutes / 60).toFixed(1)),
    workloadHours: Number((response.quote.estimatedMinutes / 60).toFixed(1)),
    lineItems,
    addOnTotalCents: response.quote.addonsTotalCents,
    equipmentCents: response.quote.equipmentTotalCents,
    payout: {
      ...fallback.payout,
      cleanerTotalCents: fallback.payout.perCleanerCents * response.quote.cleanerCount,
    },
  };
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

function EquipmentCard({
  active,
  mode,
  onSelect,
  title,
  price,
  text,
}: {
  active: boolean;
  mode: EquipmentMode;
  onSelect: (mode: EquipmentMode) => void;
  title: string;
  price: string;
  text: string;
}) {
  return (
    <button
      className={cn(
        "rounded-lg border p-4 text-left transition hover:border-emerald-500",
        active ? "border-emerald-700 bg-emerald-50" : "border-slate-200 bg-white",
      )}
      onClick={() => onSelect(mode)}
      type="button"
    >
      <span className="flex items-center justify-between gap-3">
        <span className="flex items-center gap-2 text-sm font-bold text-slate-950">
          <PackageCheck className="h-4 w-4 text-emerald-700" />
          {title}
        </span>
        <span className="text-sm font-bold text-emerald-800">{price}</span>
      </span>
      <span className="mt-3 block text-xs leading-5 text-slate-600">{text}</span>
    </button>
  );
}

function CleanerSelection({
  draft,
  quote,
  catalog,
  isRegularCleaning,
  serviceRequiresTeam,
  onCleanerCountChange,
  onToggleCleaner,
  onAssignmentModeChange,
}: {
  draft: BookingDraft;
  quote: BookingQuote;
  catalog: RegularCleaningCatalog | null;
  isRegularCleaning: boolean;
  serviceRequiresTeam: boolean;
  onCleanerCountChange: (count: number) => void;
  onToggleCleaner: (cleanerId: string) => void;
  onAssignmentModeChange: (assignmentMode: AssignmentMode) => void;
}) {
  const cleaners = catalog?.cleaners.map((cleaner) => ({
    id: cleaner.id,
    name: cleaner.display_name ?? cleaner.full_name ?? "Shalean cleaner",
    photoUrl: cleaner.photo_url ?? "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=240&q=80",
    rating: cleaner.rating,
    reviews: 0,
    experience: `${cleaner.experience_years} years`,
    specialties: ["Regular Cleaning", cleaner.equipment_eligible ? "Equipment eligible" : "Customer equipment"],
    available: cleaner.available,
    equipmentEligible: cleaner.equipment_eligible,
  })) ?? getAvailableCleaners(draft.suburb);
  const selectedCleanerIds = draft.preferredCleanerId ? [draft.preferredCleanerId] : draft.selectedCleanerIds;
  const selectedCleaners = selectedCleanerIds
    .map((id) => cleaners.find((cleaner) => cleaner.id === id))
    .filter(Boolean);

  if (serviceRequiresTeam) {
    return (
      <FieldGrid title="Team dispatch">
        <Input label="Requested team size" type="number" value={String(draft.requestedCleaners)} onChange={(value) => onCleanerCountChange(Number(value))} />
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
          Team services use admin-managed team assignment with cleaner payout visibility after dispatch.
        </div>
      </FieldGrid>
    );
  }

  if (!isRegularCleaning) {
    return (
      <FieldGrid title="Cleaner selection">
        <Select label="Assignment mode" value={draft.assignmentMode} onChange={(value) => onAssignmentModeChange(value as AssignmentMode)}>
          <option value="auto">Auto-assign best available</option>
          <option value="preferred_cleaner">Preferred cleaner</option>
          <option value="customer_team">Customer-selected team</option>
        </Select>
        <Input label="Requested cleaners" type="number" value={String(draft.requestedCleaners)} onChange={(value) => onCleanerCountChange(Number(value))} />
        <div className="rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-600">
          Cleaner profiles are currently surfaced for Regular Cleaning. This booking can still use auto-assignment fallback.
        </div>
      </FieldGrid>
    );
  }

  return (
    <div>
      <StepTitle
        icon={<UsersRound />}
        title="Cleaner selection"
        text="Choose a preferred cleaner or let Shalean auto-assign the best available cleaner for your time and suburb."
      />

      <div className="grid gap-4 rounded-lg border border-slate-200 bg-slate-50 p-4 md:grid-cols-[1fr_auto] md:items-center">
        <div>
          <h3 className="text-base font-bold text-slate-950">Cleaner quantity</h3>
          <p className="mt-1 text-sm text-slate-600">
            We recommend {quote.recommendedCleanerCount} cleaner{quote.recommendedCleanerCount === 1 ? "" : "s"} for this workload.
            More cleaners can shorten the visit and improve coverage for heavy add-ons.
          </p>
        </div>
        <div className="flex h-12 items-center justify-between rounded-md border border-slate-300 bg-white">
          <button className="grid h-12 w-12 place-items-center text-slate-700 disabled:opacity-40" disabled={draft.requestedCleaners <= 1} onClick={() => onCleanerCountChange(draft.requestedCleaners - 1)} type="button">
            <Minus className="h-4 w-4" />
          </button>
          <span className="min-w-10 text-center text-lg font-bold text-slate-950">{draft.requestedCleaners}</span>
          <button className="grid h-12 w-12 place-items-center text-slate-700 disabled:opacity-40" disabled={draft.requestedCleaners >= 4} onClick={() => onCleanerCountChange(draft.requestedCleaners + 1)} type="button">
            <Plus className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-2">
        {cleaners.map((cleaner) => {
          const selected = selectedCleanerIds.includes(cleaner.id);
          const disabled = !cleaner.available;

          return (
            <button
              key={cleaner.id}
              className={cn(
                "rounded-lg border p-4 text-left transition",
                selected ? "border-emerald-700 bg-emerald-50" : "border-slate-200 bg-white",
                disabled ? "cursor-not-allowed opacity-60" : "hover:border-emerald-500",
              )}
              disabled={disabled}
              onClick={() => {
                if (disabled) return;
                onToggleCleaner(cleaner.id);
              }}
              type="button"
            >
              <span className="flex gap-3">
                <Image className="h-14 w-14 rounded-full object-cover" src={cleaner.photoUrl} alt={`${cleaner.name} cleaner profile`} width={56} height={56} />
                <span className="min-w-0 flex-1">
                  <span className="flex items-start justify-between gap-2">
                    <span className="font-bold text-slate-950">{cleaner.name}</span>
                    <span className="flex items-center gap-2">
                      {selected ? <span className="rounded-full bg-emerald-700 px-2 py-1 text-[11px] font-bold text-white">Selected</span> : null}
                      <span className="flex items-center gap-1 text-xs font-bold text-amber-700">
                        <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                        {cleaner.rating}
                      </span>
                    </span>
                  </span>
                  <span className="mt-1 block text-xs text-slate-600">{cleaner.experience} experience - {cleaner.reviews} reviews</span>
                  <span className="mt-2 flex flex-wrap gap-1">
                    {cleaner.specialties.slice(0, 3).map((specialty) => (
                      <span key={specialty} className="rounded-full bg-slate-100 px-2 py-1 text-[11px] font-semibold text-slate-600">
                        {specialty}
                      </span>
                    ))}
                  </span>
                </span>
              </span>
              <span className="mt-3 flex items-center justify-between text-xs font-semibold">
                <span className={cleaner.available ? "text-emerald-700" : "text-red-700"}>
                  {cleaner.available ? "Available" : "Unavailable for this suburb"}
                </span>
                <span className="text-slate-500">
                  {cleaner.equipmentEligible ? "Equipment eligible" : "Customer equipment only"}
                </span>
              </span>
            </button>
          );
        })}
      </div>

      {selectedCleaners.length === 0 ? (
        <div className="mt-4 rounded-lg border border-dashed border-slate-300 bg-white p-4 text-sm text-slate-600">
          No preferred cleaner selected. Shalean will auto-assign the best available cleaner for the booking.
        </div>
      ) : null}
    </div>
  );
}

function BookingSummary({
  draft,
  quote,
  catalog,
  quoteResponse,
}: {
  draft: BookingDraft;
  quote: BookingQuote;
  catalog: RegularCleaningCatalog | null;
  quoteResponse: RegularCleaningQuoteResponse | null;
}) {
  const selectedAddOns = catalog?.addons
    .filter((addOn) => Boolean(draft.addOns[addOn.key as keyof BookingDraft["addOns"]]))
    .map((addOn) => ({
      key: addOn.key,
      label: addOn.label,
      priceCents: addOn.price_cents,
    })) ?? getSelectedAddOns(draft);
  const selectedCleanerIds = draft.preferredCleanerId ? [draft.preferredCleanerId] : draft.selectedCleanerIds;
  const selectedCleaners = catalog
    ? selectedCleanerIds
        .map((id) => catalog.cleaners.find((cleaner) => cleaner.id === id))
        .filter((cleaner) => cleaner !== undefined)
        .map((cleaner) => ({
          id: cleaner.id,
          name: cleaner.display_name ?? cleaner.full_name ?? "Shalean cleaner",
          rating: cleaner.rating,
        }))
    : selectedCleanerIds
        .map(getCleanerById)
        .filter((cleaner) => cleaner !== undefined)
        .map((cleaner) => ({
          id: cleaner.id,
          name: cleaner.name,
          rating: cleaner.rating,
        }));
  const equipmentOption = catalog?.equipmentOptions.find((option) => option.key === draft.equipment.mode);

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <SummaryPanel title="Visit details">
        <SummaryLine label="Service" value="Regular Cleaning" />
        <SummaryLine label="Date" value={formatDate(draft.date)} />
        <SummaryLine label="Arrival" value={draft.timeWindow.replace("-", " - ")} />
        <SummaryLine label="Suburb" value={draft.suburb} />
        <SummaryLine label="Address" value={draft.address} />
        {draft.notes.trim() ? <SummaryLine label="Access notes" value={draft.notes.trim()} /> : null}
      </SummaryPanel>
      <SummaryPanel title="House details">
        <SummaryLine label="Bedrooms" value={String(draft.bedrooms)} />
        <SummaryLine label="Bathrooms" value={String(draft.bathrooms)} />
        <SummaryLine label="Extra rooms" value={String(draft.extraRooms)} />
        <SummaryLine label="Estimated hours" value={String(quote.estimatedHours)} />
        <SummaryLine label="Latest total" value={formatZar(quote.totalCents)} />
      </SummaryPanel>
      {quoteResponse?.isRecurring ? (
        <SummaryPanel title="Recurring plan">
          <SummaryLine label="Schedule" value={formatRecurrenceSummary(draft.frequency, draft.recurrence.weekdays)} />
          <SummaryLine label="Generated visits" value={String(quoteResponse.occurrences.length)} />
          <SummaryLine label="Series total" value={formatZar(quoteResponse.seriesTotalCents)} />
        </SummaryPanel>
      ) : null}
      <SummaryPanel title="Premium add-ons">
        {selectedAddOns.length > 0 ? selectedAddOns.map((addOn) => (
          <SummaryLine key={addOn.key} label={addOn.label} value={formatZar(addOn.priceCents)} />
        )) : <p className="text-sm text-slate-500">No add-ons selected.</p>}
      </SummaryPanel>
      <SummaryPanel title="Equipment">
        <SummaryLine
          label={equipmentOption?.label ?? (draft.equipment.mode === "with_equipment" ? "With Equipment" : "Without Equipment")}
          value={draft.equipment.mode === "with_equipment" ? formatZar(equipmentOption?.price_cents ?? quote.equipmentCents) : "R 0"}
        />
        {draft.equipment.mode === "with_equipment" ? (
          <p className="mt-2 text-xs leading-5 text-slate-500">{(equipmentOption?.included_items ?? equipmentPackage.items).join(", ")}</p>
        ) : null}
      </SummaryPanel>
      <SummaryPanel title="Cleaners">
        <SummaryLine label="Requested cleaners" value={String(quote.cleanerCount)} />
        {selectedCleaners.length > 0 ? selectedCleaners.map((cleaner) => (
          <SummaryLine key={cleaner.id} label={cleaner.name} value={`${cleaner.rating} rating`} />
        )) : <p className="mt-2 text-sm text-slate-500">Auto-assignment fallback enabled.</p>}
      </SummaryPanel>
    </div>
  );
}

function WeekdaySelector({
  selectedWeekdays,
  onToggle,
}: {
  selectedWeekdays: number[];
  onToggle: (weekday: number, enabled: boolean) => void;
}) {
  return (
    <div className="md:col-span-2">
      <span className="text-sm font-semibold text-slate-800">Recurring weekdays</span>
      <div className="mt-2 flex flex-wrap gap-2">
        {WEEKDAYS.map((day) => {
          const selected = selectedWeekdays.includes(day.value);

          return (
            <button
              key={day.value}
              className={cn(
                "h-10 rounded-full border px-3 text-sm font-semibold transition",
                selected ? "border-emerald-700 bg-emerald-700 text-white" : "border-slate-200 bg-white text-slate-600",
              )}
              onClick={() => onToggle(day.value, !selected)}
              type="button"
            >
              {day.shortLabel}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function SummaryPanel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <h3 className="text-sm font-bold text-slate-950">{title}</h3>
      <div className="mt-3 space-y-2">{children}</div>
    </div>
  );
}

function SummaryLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3 text-sm">
      <span className="text-slate-600">{label}</span>
      <span className="font-semibold text-slate-950">{value}</span>
    </div>
  );
}

function formatDate(date: string) {
  if (!date) {
    return "Not selected";
  }

  return new Intl.DateTimeFormat("en-ZA", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(`${date}T00:00:00`));
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

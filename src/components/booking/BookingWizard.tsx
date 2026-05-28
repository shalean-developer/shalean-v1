"use client";

import type React from "react";
import { useCallback, useEffect, useId, useMemo, useRef, useState, useSyncExternalStore } from "react";
import Image from "next/image";
import {
  Calendar,
  Check,
  ChevronDown,
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

    async function hydrateProfile(authenticated: boolean) {
      if (!authenticated) {
        if (mounted) setIsCustomerProfileReady(false);
        return;
      }

      let mergedDraft = cachedDraft;
      try {
        const response = await fetch("/api/auth/customer-profile");
        if (response.ok) {
          const payload = (await response.json()) as {
            profile?: { fullName?: string; email?: string; phone?: string };
          };
          const profile = payload.profile;
          if (profile) {
            mergedDraft = {
              ...cachedDraft,
              customer: {
                name: cachedDraft.customer.name || (profile.fullName ?? ""),
                email: cachedDraft.customer.email || (profile.email ?? ""),
                phone: cachedDraft.customer.phone || (profile.phone ?? ""),
              },
            };
            saveDraft(mergedDraft);
          }
        }
      } catch {
        mergedDraft = cachedDraft;
      }

      if (mounted) {
        setIsCustomerProfileReady(isCustomerIdentityComplete(mergedDraft));
      }
    }

    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (!mounted) return;
        const authenticated = Boolean(data.session?.user);
        setIsCustomerAuthenticated(authenticated);
        setIsCustomerProfileReady(authenticated && isCustomerIdentityComplete(cachedDraft));
        void hydrateProfile(authenticated);
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
      void hydrateProfile(authenticated);
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
            onEditStep: setStep,
            quoteError,
            quoteResponse: serverQuote,
            isCustomerAuthenticated,
            isCustomerProfileReady,
            isAuthChecking,
            onAuthChange: setIsCustomerAuthenticated,
            onProfileReadyChange: setIsCustomerProfileReady,
          })}
        </div>

        <div className="mt-6 flex flex-col gap-3 border-t border-slate-200 pt-5 sm:flex-row sm:items-center sm:justify-between">
          <Button
            variant="outline"
            className="w-full sm:w-auto"
            onClick={() => setStep((current) => Math.max(0, current - 1))}
            disabled={step === 0}
          >
            <ChevronLeft className="h-4 w-4" />
            Back
          </Button>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <Button
              variant="ghost"
              className="w-full sm:w-auto"
              onClick={() => { resetDraft(); setStep(0); setErrors([]); }}
              type="button"
            >
              Start new booking
            </Button>
            <Button
              className="w-full sm:w-auto"
              onClick={step === steps.length - 1 ? startCheckout : nextStep}
              disabled={!canContinue}
            >
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
        <p className="mt-5 text-xs font-semibold uppercase tracking-wide text-slate-400">Price breakdown</p>
        <div className="mt-2 space-y-2 text-sm">
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
        <div className="mt-5 border-t border-white/15 pt-4 text-xs leading-5 text-slate-400">
          Your final checkout uses the latest confirmed quote.
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
  const legacyAddOns = savedAddOns as
    | (Partial<BookingDraft["addOns"]> & { windows?: boolean; ironing?: boolean; laundry?: boolean })
    | undefined;

  return {
    insideCabinets: savedAddOns?.insideCabinets ?? emptyAddOns.insideCabinets,
    insideOven: savedAddOns?.insideOven ?? emptyAddOns.insideOven,
    insideFridge: savedAddOns?.insideFridge ?? emptyAddOns.insideFridge,
    interiorWalls: savedAddOns?.interiorWalls ?? emptyAddOns.interiorWalls,
    laundryIroning:
      savedAddOns?.laundryIroning ??
      legacyAddOns?.ironing ??
      legacyAddOns?.laundry ??
      emptyAddOns.laundryIroning,
    interiorWindows: savedAddOns?.interiorWindows ?? legacyAddOns?.windows ?? emptyAddOns.interiorWindows,
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
  onEditStep,
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
  onEditStep: (step: number) => void;
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
          <StepTitle icon={<Sparkles />} title="Choose a service" text="Choose the cleaning service you need. More services will be available soon." />
          <div className="grid gap-3 md:grid-cols-2">
            {[regularServiceCard].map((item) => {
              const selected = draft.serviceSlug === item.slug;

              return (
                <button
                  key={item.slug}
                  className={cn(
                    "group relative rounded-xl border p-5 text-left transition hover:border-emerald-500 hover:shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700",
                    selected ? "border-emerald-700 bg-emerald-50 ring-1 ring-emerald-700" : "border-slate-200 bg-white",
                  )}
                  onClick={() => update("serviceSlug", item.slug)}
                  aria-pressed={selected}
                  type="button"
                >
                  <span className="flex items-start justify-between gap-3">
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700">
                      <Sparkles className="h-5 w-5" />
                    </span>
                    {selected ? (
                      <span className="flex items-center gap-1 rounded-full bg-emerald-700 px-2.5 py-1 text-[11px] font-bold text-white">
                        <Check className="h-3.5 w-3.5" />
                        Selected
                      </span>
                    ) : (
                      <span className="rounded-full border border-slate-200 px-2.5 py-1 text-[11px] font-semibold text-slate-500">
                        Available
                      </span>
                    )}
                  </span>
                  <span className="mt-4 block text-base font-bold text-slate-950">{item.title}</span>
                  <span className="mt-1 block text-sm leading-6 text-slate-600">{item.summary}</span>
                </button>
              );
            })}
          </div>
        </div>
      );
      }
    case 1: {
      const isRecurring = draft.frequency === "weekly" || draft.frequency === "fortnightly";
      const arrivalWindowField = (
        <ScheduleListbox
          label="Arrival window"
          value={draft.timeWindow}
          onChange={(value) => update("timeWindow", value)}
          options={[
            { value: "08:00-12:00", label: "Morning (08:00 - 12:00)" },
            { value: "12:00-16:00", label: "Afternoon (12:00 - 16:00)" },
            { value: "16:00-19:00", label: "Evening (16:00 - 19:00)" },
          ]}
        />
      );
      return (
        <FieldGrid title="Schedule" subtitle="Choose when you would like your cleaner to arrive.">
          <ScheduleListbox
            label="Frequency"
            value={draft.frequency}
            onChange={(value) => update("frequency", value as BookingDraft["frequency"])}
            options={[
              { value: "once", label: "Once-off" },
              { value: "weekly", label: "Weekly" },
              { value: "fortnightly", label: "Fortnightly" },
              { value: "monthly", label: "Monthly" },
            ]}
          />
          <ScheduleDatePicker label="Preferred date" min={todayInJohannesburg()} value={draft.date} onChange={(value) => update("date", value)} helper="Pick today or any future date." />
          {isRecurring ? (
            <div className="flex flex-col gap-4 md:col-span-2 md:flex-row md:items-start">
              <WeekdaySelector
                className="md:flex-1"
                selectedWeekdays={draft.recurrence.weekdays}
                onToggle={updateRecurrenceWeekday}
              />
              <div className="md:w-72 md:shrink-0">{arrivalWindowField}</div>
            </div>
          ) : (
            arrivalWindowField
          )}
        </FieldGrid>
      );
    }
    case 2:
      return (
        <FieldGrid title="Location" subtitle="Tell us where your cleaner should go." icon={<MapPin />}>
          <ScheduleListbox
            label="Cape Town suburb"
            value={draft.suburb}
            onChange={(value) => update("suburb", value)}
            options={capeTownSuburbs.map((suburb) => ({ value: suburb, label: suburb }))}
          />
          <ScheduleInput
            label="Street address"
            value={draft.address}
            onChange={(value) => update("address", value)}
            placeholder="123 Main Road, Apartment 4B"
            helper="Start typing your address and select it from the list."
          />
          <ScheduleTextarea
            label="Access notes"
            optional
            value={draft.notes}
            onChange={(value) => update("notes", value)}
            placeholder="Gate code, parking, pets, or anything the cleaner should know."
          />
        </FieldGrid>
      );
    case 3:
      return (
        <div>
          <StepTitle title="House details" text="Tell us about your home and choose any extras you would like." />
          <div className="grid gap-4 sm:grid-cols-3">
            <ScheduleInput label="Bedrooms" type="number" min={0} inputMode="numeric" value={String(draft.bedrooms)} onChange={(value) => update("bedrooms", Number(value))} />
            <ScheduleInput label="Bathrooms" type="number" min={0} inputMode="numeric" value={String(draft.bathrooms)} onChange={(value) => update("bathrooms", Number(value))} />
            <ScheduleInput label="Extra rooms" type="number" min={0} inputMode="numeric" value={String(draft.extraRooms)} onChange={(value) => update("extraRooms", Number(value))} />
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
                      "rounded-[14px] border p-4 text-left transition hover:border-emerald-500",
                      enabled ? "border-emerald-700 bg-emerald-50" : "border-[#d6e0ea] bg-white",
                    )}
                    onClick={() => updateAddOn(addOn.key, !enabled)}
                    type="button"
                    role="switch"
                    aria-checked={enabled}
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
                    <span className="mt-3 flex items-center gap-2">
                      <Toggle on={enabled} />
                      <span className={cn("text-xs font-semibold", enabled ? "text-emerald-800" : "text-slate-500")}>
                        {enabled ? "Added" : "Add"}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="mt-7">
            <h3 className="text-base font-bold text-slate-950">Cleaning supplies</h3>
            <p className="mt-1 text-sm text-slate-600">Choose whether Shalean brings supplies or you provide your own.</p>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <EquipmentCard
                active={draft.equipment.mode === "with_equipment"}
                mode="with_equipment"
                onSelect={updateEquipmentMode}
                title="Shalean brings supplies"
                price={formatZar(withEquipmentOption?.price_cents ?? equipmentPackage.priceCents)}
                text={withEquipmentOption?.description ?? "Shalean supplies vacuum cleaner, mop & bucket, chemicals, cloths, and professional tools."}
              />
              <EquipmentCard
                active={draft.equipment.mode === "without_equipment"}
                mode="without_equipment"
                onSelect={updateEquipmentMode}
                title="I have my own supplies"
                price={formatZar(withoutEquipmentOption?.price_cents ?? 0)}
                text={withoutEquipmentOption?.description ?? "Use this if your home already has suitable cleaning equipment and products available."}
              />
            </div>
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
          <StepTitle title="Review booking" text="Check everything looks right before you continue to checkout." />
          <BookingSummary draft={draft} quote={quote} catalog={regularCatalog} quoteResponse={quoteResponse} onEditStep={onEditStep} />
        </div>
      );
    case 6:
    default:
      return (
        <CheckoutStep
          draft={draft}
          isChecking={isAuthChecking}
          isAuthenticated={isCustomerAuthenticated}
          isProfileReady={isCustomerProfileReady}
          quoteError={quoteError}
          quoteResponse={quoteResponse}
          onAuthChange={onAuthChange}
          onProfileReadyChange={onProfileReadyChange}
        />
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

function CheckoutStep({
  draft,
  isChecking,
  isAuthenticated,
  isProfileReady,
  quoteError,
  quoteResponse,
  onAuthChange,
  onProfileReadyChange,
}: {
  draft: BookingDraft;
  isChecking: boolean;
  isAuthenticated: boolean;
  isProfileReady: boolean;
  quoteError: string | null;
  quoteResponse: RegularCleaningQuoteResponse | null;
  onAuthChange: (authenticated: boolean) => void;
  onProfileReadyChange: (ready: boolean) => void;
}) {
  if (isChecking) {
    return (
      <div>
        <StepTitle icon={<CreditCard />} title="Complete your details" text="Loading your account details…" />
        <div className="rounded-lg border border-slate-200 bg-white p-6 text-sm text-slate-500">Checking your account…</div>
      </div>
    );
  }

  if (isAuthenticated) {
    return (
      <div>
        <StepTitle icon={<CreditCard />} title="Complete your details" text="You’re signed in. Please confirm your details before payment." />
        <ConfirmDetails
          draft={draft}
          isProfileReady={isProfileReady}
          quoteError={quoteError}
          quoteResponse={quoteResponse}
          onProfileReadyChange={onProfileReadyChange}
        />
      </div>
    );
  }

  return (
    <div>
      <StepTitle icon={<CreditCard />} title="Sign in or create an account" text="Sign in or create an account to continue. Your booking details are saved." />
      <SignInOrSignUp
        draft={draft}
        onAuthChange={onAuthChange}
        onProfileReadyChange={onProfileReadyChange}
      />
    </div>
  );
}

function ConfirmDetails({
  draft,
  isProfileReady,
  quoteError,
  quoteResponse,
  onProfileReadyChange,
}: {
  draft: BookingDraft;
  isProfileReady: boolean;
  quoteError: string | null;
  quoteResponse: RegularCleaningQuoteResponse | null;
  onProfileReadyChange: (ready: boolean) => void;
}) {
  const [isEditing, setIsEditing] = useState(!isProfileReady);
  const [fullName, setFullName] = useState(draft.customer.name);
  const [email, setEmail] = useState(draft.customer.email);
  const [phone, setPhone] = useState(draft.customer.phone);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const candidate = { ...draft, customer: { name: fullName, email, phone } };
  const identityComplete = isCustomerIdentityComplete(candidate);

  async function saveDetails(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setMessage(null);

    try {
      const profileResult = await fetch("/api/auth/customer-profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fullName, email, phone }),
      });

      if (!profileResult.ok) {
        throw new Error("Could not save your details. Please check them and try again.");
      }

      saveDraft({ ...draft, customer: { name: fullName, email, phone } });
      onProfileReadyChange(true);
      setIsEditing(false);
      setMessage("Details saved. You can now confirm checkout.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not save your details.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_280px]">
      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm font-semibold text-emerald-900">
          You’re signed in. Please confirm your details before payment.
        </div>

        {quoteError ? (
          <p className="mt-3 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">{quoteError}</p>
        ) : null}

        {quoteResponse?.isRecurring ? (
          <p className="mt-3 rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
            Checkout will cover {formatZar(quoteResponse.seriesTotalCents)} for {quoteResponse.occurrences.length} scheduled visits.
          </p>
        ) : null}

        {isEditing ? (
          <form onSubmit={saveDetails} className="mt-4">
            <div className="grid gap-3 md:grid-cols-2">
              <Input label="Full name" value={fullName} onChange={setFullName} />
              <Input label="Phone number" value={phone} onChange={setPhone} placeholder="e.g. 082 123 4567" />
              <div className="md:col-span-2">
                <Input label="Email" type="email" value={email} onChange={setEmail} />
              </div>
            </div>
            {message ? (
              <div className="mt-4 rounded-md border border-slate-200 bg-slate-50 p-3 text-sm font-semibold text-slate-700">{message}</div>
            ) : null}
            <div className="mt-4 flex flex-wrap gap-2">
              <Button type="submit" disabled={isSubmitting || !identityComplete}>
                {isSubmitting ? "Saving…" : "Save details"}
              </Button>
              {isProfileReady ? (
                <Button variant="outline" type="button" onClick={() => { setIsEditing(false); setMessage(null); }}>
                  Cancel
                </Button>
              ) : null}
            </div>
          </form>
        ) : (
          <div className="mt-4">
            <dl className="divide-y divide-slate-100">
              <DetailRow label="Full name" value={draft.customer.name || "—"} />
              <DetailRow label="Email" value={draft.customer.email || "—"} />
              <DetailRow label="Phone number" value={draft.customer.phone || "—"} />
            </dl>
            {message ? (
              <div className="mt-4 rounded-md border border-slate-200 bg-slate-50 p-3 text-sm font-semibold text-slate-700">{message}</div>
            ) : null}
            <button
              className="mt-4 text-sm font-semibold text-emerald-700 hover:text-emerald-800 hover:underline"
              onClick={() => setIsEditing(true)}
              type="button"
            >
              Edit details
            </button>
          </div>
        )}
      </div>

      <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-950">
        <h3 className="font-bold">Your booking is saved</h3>
        <p className="mt-2 leading-6">
          Your service, schedule, location, add-ons, cleaning supplies, cleaner preference, and latest quote all stay in place through to payment.
        </p>
      </div>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 py-2.5">
      <dt className="text-sm text-slate-600">{label}</dt>
      <dd className="text-sm font-semibold text-slate-950">{value}</dd>
    </div>
  );
}

function SignInOrSignUp({
  draft,
  onAuthChange,
  onProfileReadyChange,
}: {
  draft: BookingDraft;
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
  const canSubmit = mode === "login"
    ? email.includes("@") && password.length > 0
    : identityComplete && password.length >= 6;

  async function submitAuth(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setMessage(null);

    try {
      const supabase = createSupabaseBrowserClient();
      const result = mode === "login"
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
        body: JSON.stringify({ fullName, email, phone }),
      });

      if (!profileResult.ok) {
        throw new Error("Signed in, but could not save your customer profile.");
      }

      onAuthChange(true);
      onProfileReadyChange(true);
      saveDraft({
        ...draft,
        customer: { name: fullName, email, phone },
      });
      setMessage("You’re all set. Confirm your details to continue.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to sign you in. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_280px]">
      <form onSubmit={submitAuth} className="rounded-lg border border-slate-200 bg-white p-4">
        <div className="grid gap-3 md:grid-cols-2">
          {mode === "signup" ? (
            <>
              <Input label="Full name" value={fullName} onChange={setFullName} />
              <Input label="Phone number" value={phone} onChange={setPhone} placeholder="e.g. 082 123 4567" />
            </>
          ) : null}
          <div className={mode === "signup" ? "md:col-span-2" : ""}>
            <Input label="Email" type="email" value={email} onChange={setEmail} />
          </div>
          <div className={mode === "signup" ? "md:col-span-2" : ""}>
            <Input label="Password" type="password" value={password} onChange={setPassword} helper={mode === "signup" ? "Use at least 6 characters." : undefined} />
          </div>
        </div>

        {message ? (
          <div className="mt-4 rounded-md border border-slate-200 bg-slate-50 p-3 text-sm font-semibold text-slate-700">
            {message}
          </div>
        ) : null}

        <Button className="mt-4 w-full sm:w-auto" disabled={isSubmitting || !canSubmit} type="submit">
          {isSubmitting
            ? "Please wait…"
            : mode === "login"
              ? "Sign in and continue"
              : "Create account and continue"}
        </Button>

        <p className="mt-4 text-sm text-slate-600">
          {mode === "login" ? (
            <>
              Don’t have an account?{" "}
              <button className="font-semibold text-emerald-700 hover:underline" onClick={() => { setMode("signup"); setMessage(null); }} type="button">
                Create one
              </button>
            </>
          ) : (
            <>
              Already have an account?{" "}
              <button className="font-semibold text-emerald-700 hover:underline" onClick={() => { setMode("login"); setMessage(null); }} type="button">
                Sign in
              </button>
            </>
          )}
        </p>
      </form>

      <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-950">
        <h3 className="font-bold">Your booking is saved</h3>
        <p className="mt-2 leading-6">
          After you sign in or create an account, your service, schedule, location, add-ons, cleaning supplies, cleaner preference, and latest quote stay in place.
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

function Toggle({ on }: { on: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors",
        on ? "bg-emerald-700" : "bg-slate-300",
      )}
    >
      <span
        className={cn(
          "inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform",
          on ? "translate-x-[18px]" : "translate-x-0.5",
        )}
      />
    </span>
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
  const availableCleaners = cleaners.filter((cleaner) => cleaner.available);
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
        text="Choose a preferred cleaner, or we’ll assign the best available cleaner."
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

      {availableCleaners.length === 0 ? (
        <div className="mt-5 rounded-lg border border-dashed border-slate-300 bg-white p-4 text-sm text-slate-600">
          No cleaners are currently available for this suburb. Shalean will auto-assign the best available cleaner for the booking.
        </div>
      ) : (
      <div className="mt-5 grid gap-3 md:grid-cols-2">
        {availableCleaners.map((cleaner) => {
          const selected = selectedCleanerIds.includes(cleaner.id);

          return (
            <button
              key={cleaner.id}
              className={cn(
                "rounded-lg border p-4 text-left transition hover:border-emerald-500",
                selected ? "border-emerald-700 bg-emerald-50" : "border-slate-200 bg-white",
              )}
              onClick={() => onToggleCleaner(cleaner.id)}
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
                  <span className="mt-1 block text-xs text-slate-600">{cleaner.experience} experience · {cleaner.reviews > 0 ? `${cleaner.reviews} reviews` : "New cleaner"}</span>
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
                <span className="text-emerald-700">Available</span>
                <span className="text-slate-500">
                  {cleaner.equipmentEligible ? "Equipment eligible" : "Customer equipment only"}
                </span>
              </span>
            </button>
          );
        })}
      </div>
      )}

      {availableCleaners.length > 0 && selectedCleaners.length === 0 ? (
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
  onEditStep,
}: {
  draft: BookingDraft;
  quote: BookingQuote;
  catalog: RegularCleaningCatalog | null;
  quoteResponse: RegularCleaningQuoteResponse | null;
  onEditStep: (step: number) => void;
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

  const suppliesLabel = draft.equipment.mode === "with_equipment" ? "Shalean brings supplies" : "I have my own supplies";

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <SummaryPanel title="Visit details" onEdit={() => onEditStep(1)} editLabel="Edit schedule">
        <SummaryLine label="Service" value="Regular Cleaning" />
        <SummaryLine label="Date" value={formatDate(draft.date)} />
        <SummaryLine label="Arrival window" value={draft.timeWindow.replace("-", " – ")} />
        {draft.frequency !== "once" ? (
          <SummaryLine label="Frequency" value={draft.frequency.charAt(0).toUpperCase() + draft.frequency.slice(1)} />
        ) : (
          <SummaryLine label="Frequency" value="Once-off" />
        )}
      </SummaryPanel>
      <SummaryPanel title="Location" onEdit={() => onEditStep(2)} editLabel="Edit location">
        <SummaryLine label="Suburb" value={draft.suburb} />
        <SummaryLine label="Address" value={draft.address} />
        {draft.notes.trim() ? <SummaryLine label="Access notes" value={draft.notes.trim()} /> : <p className="text-sm text-slate-500">No access notes added.</p>}
      </SummaryPanel>
      <SummaryPanel title="House details" onEdit={() => onEditStep(3)} editLabel="Edit house details">
        <SummaryLine label="Bedrooms" value={String(draft.bedrooms)} />
        <SummaryLine label="Bathrooms" value={String(draft.bathrooms)} />
        <SummaryLine label="Extra rooms" value={String(draft.extraRooms)} />
        <SummaryLine label="Estimated hours" value={String(quote.estimatedHours)} />
      </SummaryPanel>
      {quoteResponse?.isRecurring ? (
        <SummaryPanel title="Recurring plan" onEdit={() => onEditStep(1)} editLabel="Edit schedule">
          <SummaryLine label="Schedule" value={formatRecurrenceSummary(draft.frequency, draft.recurrence.weekdays)} />
          <SummaryLine label="Scheduled visits" value={String(quoteResponse.occurrences.length)} />
          <SummaryLine label="Series total" value={formatZar(quoteResponse.seriesTotalCents)} />
        </SummaryPanel>
      ) : null}
      <SummaryPanel title="Premium add-ons" onEdit={() => onEditStep(3)} editLabel="Edit house details">
        {selectedAddOns.length > 0 ? selectedAddOns.map((addOn) => (
          <SummaryLine key={addOn.key} label={addOn.label} value={formatZar(addOn.priceCents)} />
        )) : <p className="text-sm text-slate-500">No add-ons selected.</p>}
      </SummaryPanel>
      <SummaryPanel title="Cleaning supplies" onEdit={() => onEditStep(3)} editLabel="Edit house details">
        <SummaryLine
          label={suppliesLabel}
          value={draft.equipment.mode === "with_equipment" ? formatZar(equipmentOption?.price_cents ?? quote.equipmentCents) : "R 0"}
        />
        {draft.equipment.mode === "with_equipment" ? (
          <p className="mt-2 text-xs leading-5 text-slate-500">{(equipmentOption?.included_items ?? equipmentPackage.items).join(", ")}</p>
        ) : null}
      </SummaryPanel>
      <SummaryPanel title="Cleaner preference" onEdit={() => onEditStep(4)} editLabel="Edit cleaner">
        <SummaryLine label="Cleaners" value={String(quote.cleanerCount)} />
        {selectedCleaners.length > 0 ? selectedCleaners.map((cleaner) => (
          <SummaryLine key={cleaner.id} label={cleaner.name} value={`${cleaner.rating} rating`} />
        )) : <p className="mt-2 text-sm text-slate-500">No preferred cleaner selected. Shalean will auto-assign the best available cleaner.</p>}
      </SummaryPanel>
      <SummaryPanel title="Price summary" className="lg:col-span-3">
        <div className="space-y-2">
          {quote.lineItems.map((item) => (
            <div key={item.label} className="flex justify-between gap-3 text-sm">
              <span className="capitalize text-slate-600">{item.label}</span>
              <span className="font-semibold text-slate-950">{formatZar(item.amountCents)}</span>
            </div>
          ))}
          {quote.discountCents > 0 ? (
            <div className="flex justify-between gap-3 text-sm text-emerald-700">
              <span>Recurring discount</span>
              <span>-{formatZar(quote.discountCents)}</span>
            </div>
          ) : null}
        </div>
        <div className="mt-3 flex items-center justify-between border-t border-slate-200 pt-3">
          <span className="text-sm font-semibold text-slate-600">Total</span>
          <span className="text-lg font-black text-slate-950">{formatZar(quote.totalCents)}</span>
        </div>
      </SummaryPanel>
    </div>
  );
}

function WeekdaySelector({
  selectedWeekdays,
  onToggle,
  className,
}: {
  selectedWeekdays: number[];
  onToggle: (weekday: number, enabled: boolean) => void;
  className?: string;
}) {
  return (
    <div className={cn("md:col-span-2", className)}>
      <span className="text-sm font-semibold text-slate-800">Recurring weekdays</span>
      <div className="mt-2 grid grid-cols-7 gap-2">
        {WEEKDAYS.map((day) => {
          const selected = selectedWeekdays.includes(day.value);

          return (
            <button
              key={day.value}
              className={cn(
                "flex h-12 items-center justify-center rounded-full border px-1 text-sm font-semibold transition",
                selected
                  ? "border-emerald-700 bg-emerald-700 text-white"
                  : "border-slate-200 bg-white text-slate-600 hover:border-slate-300",
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

function SummaryPanel({
  title,
  children,
  onEdit,
  editLabel,
  className,
}: {
  title: string;
  children: React.ReactNode;
  onEdit?: () => void;
  editLabel?: string;
  className?: string;
}) {
  return (
    <div className={cn("rounded-lg border border-slate-200 bg-white p-4", className)}>
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-bold text-slate-950">{title}</h3>
        {onEdit ? (
          <button
            className="text-xs font-semibold text-emerald-700 hover:text-emerald-800 hover:underline"
            onClick={onEdit}
            type="button"
          >
            {editLabel ?? "Edit"}
          </button>
        ) : null}
      </div>
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

function FieldGrid({
  title,
  subtitle,
  icon,
  children,
}: {
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div>
      <StepTitle icon={icon} title={title} text={subtitle ?? "Your progress is saved automatically on this device."} />
      <div className="grid gap-4 md:grid-cols-2">{children}</div>
    </div>
  );
}

function Input({
  label,
  value,
  onChange,
  suffix,
  helper,
  ...props
}: Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange"> & {
  label: string;
  value: string;
  suffix?: string;
  helper?: string;
  onChange: (value: string) => void;
}) {
  return (
    <label>
      <span className="text-sm font-semibold text-slate-800">{label}</span>
      <div className="mt-2 flex rounded-md border border-slate-300 bg-white focus-within:border-emerald-700">
        <input className="min-h-11 w-full rounded-md px-3 text-sm outline-none" value={value} onChange={(event) => onChange(event.target.value)} {...props} />
        {suffix ? <span className="flex items-center px-3 text-sm text-slate-500">{suffix}</span> : null}
      </div>
      {helper ? <span className="mt-1.5 block text-xs leading-5 text-slate-500">{helper}</span> : null}
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

function ScheduleInput({
  label,
  value,
  onChange,
  helper,
  error,
  placeholder,
  type = "text",
  min,
  inputMode,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  helper?: string;
  error?: string;
  placeholder?: string;
  type?: string;
  min?: number;
  inputMode?: React.InputHTMLAttributes<HTMLInputElement>["inputMode"];
}) {
  const baseId = useId();
  const messageId = `${baseId}-message`;

  return (
    <div>
      <span className="text-sm font-semibold text-slate-800">{label}</span>
      <div className="mt-2">
        <input
          type={type}
          value={value}
          min={min}
          inputMode={inputMode}
          placeholder={placeholder}
          aria-describedby={error || helper ? messageId : undefined}
          onChange={(event) => onChange(event.target.value)}
          className={cn(scheduleFieldBaseClasses, "px-4", scheduleBorderClasses(error))}
        />
      </div>
      <FieldMessage id={messageId} helper={helper} error={error} />
    </div>
  );
}

function ScheduleTextarea({
  label,
  value,
  onChange,
  helper,
  error,
  placeholder,
  optional,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  helper?: string;
  error?: string;
  placeholder?: string;
  optional?: boolean;
}) {
  const baseId = useId();
  const messageId = `${baseId}-message`;

  return (
    <div className="md:col-span-2">
      <span className="text-sm font-semibold text-slate-800">
        {label}
        {optional ? <span className="font-normal text-slate-400"> (optional)</span> : null}
      </span>
      <div className="mt-2">
        <textarea
          value={value}
          placeholder={placeholder}
          aria-describedby={error || helper ? messageId : undefined}
          onChange={(event) => onChange(event.target.value)}
          className={cn(
            "min-h-28 w-full rounded-[14px] border bg-white px-4 py-3 text-base text-[#0f1e35] outline-none transition-colors hover:border-[#b6c5d4] focus:border-emerald-700 focus:ring-2 focus:ring-emerald-600/25",
            scheduleBorderClasses(error),
          )}
        />
      </div>
      <FieldMessage id={messageId} helper={helper} error={error} />
    </div>
  );
}

const scheduleFieldBaseClasses =
  "h-14 w-full rounded-[14px] border bg-white text-base text-[#0f1e35] outline-none transition-colors hover:border-[#b6c5d4] focus:border-emerald-700 focus:ring-2 focus:ring-emerald-600/25 disabled:cursor-not-allowed disabled:border-[#d6e0ea] disabled:bg-slate-100 disabled:text-slate-400 disabled:hover:border-[#d6e0ea]";

function scheduleBorderClasses(error?: string) {
  return error
    ? "border-red-500 focus:border-red-500 focus:ring-red-500/25"
    : "border-[#d6e0ea]";
}

function FieldMessage({ id, helper, error }: { id: string; helper?: string; error?: string }) {
  if (error) {
    return (
      <span id={id} className="mt-1.5 block text-xs font-medium leading-5 text-red-600">
        {error}
      </span>
    );
  }
  if (helper) {
    return (
      <span id={id} className="mt-1.5 block text-xs leading-5 text-slate-500">
        {helper}
      </span>
    );
  }
  return null;
}

function useDismiss(open: boolean, close: () => void, ref: React.RefObject<HTMLDivElement | null>) {
  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: MouseEvent | TouchEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        close();
      }
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("touchstart", onPointerDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("touchstart", onPointerDown);
    };
  }, [open, close, ref]);
}

type SelectOption = { value: string; label: string };

function ScheduleListbox({
  label,
  value,
  options,
  onChange,
  helper,
  error,
  disabled,
}: {
  label: string;
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
  helper?: string;
  error?: string;
  disabled?: boolean;
}) {
  const baseId = useId();
  const labelId = `${baseId}-label`;
  const buttonId = `${baseId}-button`;
  const listId = `${baseId}-list`;
  const messageId = `${baseId}-message`;
  const containerRef = useRef<HTMLDivElement | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const listRef = useRef<HTMLUListElement | null>(null);
  const [open, setOpen] = useState(false);
  const selectedIndex = Math.max(0, options.findIndex((option) => option.value === value));
  const [activeIndex, setActiveIndex] = useState(selectedIndex);

  const closeAndFocus = useCallback(() => {
    setOpen(false);
    buttonRef.current?.focus();
  }, []);

  useDismiss(open, () => setOpen(false), containerRef);

  useEffect(() => {
    if (open) {
      listRef.current?.focus();
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    listRef.current
      ?.querySelector<HTMLElement>(`[data-index="${activeIndex}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [open, activeIndex]);

  function openList() {
    if (disabled) return;
    setActiveIndex(selectedIndex);
    setOpen(true);
  }

  function handleButtonKeyDown(event: React.KeyboardEvent) {
    if (disabled) return;
    if (!open && ["ArrowDown", "ArrowUp", "Enter", " "].includes(event.key)) {
      event.preventDefault();
      openList();
    }
  }

  function handleListKeyDown(event: React.KeyboardEvent) {
    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        setActiveIndex((index) => Math.min(options.length - 1, index + 1));
        break;
      case "ArrowUp":
        event.preventDefault();
        setActiveIndex((index) => Math.max(0, index - 1));
        break;
      case "Home":
        event.preventDefault();
        setActiveIndex(0);
        break;
      case "End":
        event.preventDefault();
        setActiveIndex(options.length - 1);
        break;
      case "Enter":
      case " ":
        event.preventDefault();
        onChange(options[activeIndex].value);
        closeAndFocus();
        break;
      case "Escape":
        event.preventDefault();
        closeAndFocus();
        break;
      case "Tab":
        setOpen(false);
        break;
    }
  }

  const selectedOption = options.find((option) => option.value === value);

  return (
    <div>
      <span id={labelId} className="text-sm font-semibold text-slate-800">
        {label}
      </span>
      <div ref={containerRef} className="relative mt-2">
        <button
          type="button"
          id={buttonId}
          ref={buttonRef}
          disabled={disabled}
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-labelledby={`${labelId} ${buttonId}`}
          aria-describedby={error || helper ? messageId : undefined}
          onClick={() => (open ? setOpen(false) : openList())}
          onKeyDown={handleButtonKeyDown}
          className={cn(
            scheduleFieldBaseClasses,
            "flex items-center justify-between px-4 text-left",
            scheduleBorderClasses(error),
            open && !error && "border-emerald-700 ring-2 ring-emerald-600/25",
          )}
        >
          <span className="truncate">{selectedOption?.label ?? "Select"}</span>
          <ChevronDown
            aria-hidden
            className={cn("ml-2 size-5 shrink-0 text-slate-500 transition-transform", open && "rotate-180")}
          />
        </button>
        {open ? (
          <ul
            ref={listRef}
            id={listId}
            role="listbox"
            tabIndex={-1}
            aria-labelledby={labelId}
            aria-activedescendant={`${listId}-opt-${activeIndex}`}
            onKeyDown={handleListKeyDown}
            className="absolute z-50 mt-2 max-h-64 w-full overflow-auto rounded-[14px] border border-[#d6e0ea] bg-white p-1.5 shadow-lg shadow-slate-900/10 outline-none"
          >
            {options.map((option, index) => {
              const isSelected = option.value === value;
              const isActive = index === activeIndex;
              return (
                <li
                  key={option.value}
                  id={`${listId}-opt-${index}`}
                  data-index={index}
                  role="option"
                  aria-selected={isSelected}
                  onMouseEnter={() => setActiveIndex(index)}
                  onClick={() => {
                    onChange(option.value);
                    closeAndFocus();
                  }}
                  className={cn(
                    "flex cursor-pointer items-center justify-between rounded-[10px] px-3 py-2.5 text-base text-[#0f1e35]",
                    isActive && "bg-emerald-50 text-emerald-900",
                  )}
                >
                  <span className="truncate">{option.label}</span>
                  {isSelected ? <Check aria-hidden className="ml-2 size-4 shrink-0 text-emerald-700" /> : null}
                </li>
              );
            })}
          </ul>
        ) : null}
      </div>
      <FieldMessage id={messageId} helper={helper} error={error} />
    </div>
  );
}

const CALENDAR_WEEKDAYS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];
const CALENDAR_MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

function pad2(value: number) {
  return String(value).padStart(2, "0");
}

function toIsoDate(year: number, monthIndex: number, day: number) {
  return `${year}-${pad2(monthIndex + 1)}-${pad2(day)}`;
}

function parseIsoDate(value: string): { year: number; monthIndex: number; day: number } | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  return { year: Number(match[1]), monthIndex: Number(match[2]) - 1, day: Number(match[3]) };
}

function shiftIsoDate(iso: string, deltaDays: number) {
  const parsed = parseIsoDate(iso);
  if (!parsed) return iso;
  const date = new Date(parsed.year, parsed.monthIndex, parsed.day + deltaDays);
  return toIsoDate(date.getFullYear(), date.getMonth(), date.getDate());
}

function shiftIsoMonth(iso: string, deltaMonths: number) {
  const parsed = parseIsoDate(iso);
  if (!parsed) return iso;
  const firstOfTarget = new Date(parsed.year, parsed.monthIndex + deltaMonths, 1);
  const targetYear = firstOfTarget.getFullYear();
  const targetMonth = firstOfTarget.getMonth();
  const lastDay = new Date(targetYear, targetMonth + 1, 0).getDate();
  return toIsoDate(targetYear, targetMonth, Math.min(parsed.day, lastDay));
}

function ScheduleDatePicker({
  label,
  value,
  onChange,
  min,
  helper,
  error,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  min?: string;
  helper?: string;
  error?: string;
  disabled?: boolean;
}) {
  const baseId = useId();
  const labelId = `${baseId}-label`;
  const buttonId = `${baseId}-button`;
  const dialogId = `${baseId}-dialog`;
  const messageId = `${baseId}-message`;
  const containerRef = useRef<HTMLDivElement | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const gridRef = useRef<HTMLDivElement | null>(null);
  const [open, setOpen] = useState(false);

  const today = todayInJohannesburg();
  const lowerBound = min && min > "" ? min : undefined;
  const clamp = useCallback(
    (iso: string) => (lowerBound && iso < lowerBound ? lowerBound : iso),
    [lowerBound],
  );
  const initialFocus = clamp(value || today);
  const [focusedIso, setFocusedIso] = useState(initialFocus);

  const closeAndFocus = useCallback(() => {
    setOpen(false);
    buttonRef.current?.focus();
  }, []);

  useDismiss(open, () => setOpen(false), containerRef);

  function openCalendar() {
    if (disabled) return;
    setFocusedIso(clamp(value || today));
    setOpen(true);
  }

  useEffect(() => {
    if (!open) return;
    gridRef.current
      ?.querySelector<HTMLElement>(`[data-date="${focusedIso}"]`)
      ?.focus();
  }, [open, focusedIso]);

  const view = parseIsoDate(focusedIso) ?? parseIsoDate(today)!;
  const firstWeekdayMondayBased = (new Date(view.year, view.monthIndex, 1).getDay() + 6) % 7;
  const daysInMonth = new Date(view.year, view.monthIndex + 1, 0).getDate();
  const cells: (number | null)[] = [
    ...Array.from({ length: firstWeekdayMondayBased }, () => null),
    ...Array.from({ length: daysInMonth }, (_, index) => index + 1),
  ];

  function moveFocus(nextIso: string) {
    setFocusedIso(clamp(nextIso));
  }

  function handleGridKeyDown(event: React.KeyboardEvent) {
    switch (event.key) {
      case "ArrowLeft":
        event.preventDefault();
        moveFocus(shiftIsoDate(focusedIso, -1));
        break;
      case "ArrowRight":
        event.preventDefault();
        moveFocus(shiftIsoDate(focusedIso, 1));
        break;
      case "ArrowUp":
        event.preventDefault();
        moveFocus(shiftIsoDate(focusedIso, -7));
        break;
      case "ArrowDown":
        event.preventDefault();
        moveFocus(shiftIsoDate(focusedIso, 7));
        break;
      case "PageUp":
        event.preventDefault();
        moveFocus(shiftIsoMonth(focusedIso, -1));
        break;
      case "PageDown":
        event.preventDefault();
        moveFocus(shiftIsoMonth(focusedIso, 1));
        break;
      case "Enter":
      case " ":
        event.preventDefault();
        if (!lowerBound || focusedIso >= lowerBound) {
          onChange(focusedIso);
          closeAndFocus();
        }
        break;
      case "Escape":
        event.preventDefault();
        closeAndFocus();
        break;
    }
  }

  const canGoPrev = !lowerBound || toIsoDate(view.year, view.monthIndex, 1) > lowerBound;

  return (
    <div>
      <span id={labelId} className="text-sm font-semibold text-slate-800">
        {label}
      </span>
      <div ref={containerRef} className="relative mt-2">
        <button
          type="button"
          id={buttonId}
          ref={buttonRef}
          disabled={disabled}
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-labelledby={`${labelId} ${buttonId}`}
          aria-describedby={error || helper ? messageId : undefined}
          onClick={() => (open ? setOpen(false) : openCalendar())}
          className={cn(
            scheduleFieldBaseClasses,
            "flex items-center justify-between px-4 text-left",
            scheduleBorderClasses(error),
            open && !error && "border-emerald-700 ring-2 ring-emerald-600/25",
          )}
        >
          <span className={cn("truncate", !value && "text-slate-400")}>
            {value ? formatDate(value) : "Select a date"}
          </span>
          <Calendar aria-hidden className="ml-2 size-5 shrink-0 text-slate-500" />
        </button>
        {open ? (
          <div
            id={dialogId}
            role="dialog"
            aria-modal="false"
            aria-labelledby={labelId}
            className="absolute z-50 mt-2 w-72 rounded-[14px] border border-[#d6e0ea] bg-white p-3 shadow-lg shadow-slate-900/10"
          >
            <div className="mb-2 flex items-center justify-between">
              <button
                type="button"
                disabled={!canGoPrev}
                aria-label="Previous month"
                onClick={() => moveFocus(shiftIsoMonth(focusedIso, -1))}
                className="flex size-9 items-center justify-center rounded-[10px] text-slate-600 transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent"
              >
                <ChevronLeft aria-hidden className="size-5" />
              </button>
              <span aria-live="polite" className="text-sm font-semibold text-[#0f1e35]">
                {CALENDAR_MONTHS[view.monthIndex]} {view.year}
              </span>
              <button
                type="button"
                aria-label="Next month"
                onClick={() => moveFocus(shiftIsoMonth(focusedIso, 1))}
                className="flex size-9 items-center justify-center rounded-[10px] text-slate-600 transition-colors hover:bg-slate-100"
              >
                <ChevronRight aria-hidden className="size-5" />
              </button>
            </div>
            <div className="grid grid-cols-7 gap-0.5 text-center text-xs font-semibold text-slate-400">
              {CALENDAR_WEEKDAYS.map((weekday) => (
                <span key={weekday} className="flex h-8 items-center justify-center">
                  {weekday}
                </span>
              ))}
            </div>
            <div
              ref={gridRef}
              role="grid"
              onKeyDown={handleGridKeyDown}
              className="grid grid-cols-7 gap-0.5"
            >
              {cells.map((day, index) => {
                if (day === null) {
                  return <span key={`empty-${index}`} aria-hidden className="h-9" />;
                }
                const iso = toIsoDate(view.year, view.monthIndex, day);
                const isSelected = iso === value;
                const isToday = iso === today;
                const isDisabled = Boolean(lowerBound && iso < lowerBound);
                const isFocusTarget = iso === focusedIso;
                return (
                  <button
                    key={iso}
                    type="button"
                    role="gridcell"
                    data-date={iso}
                    disabled={isDisabled}
                    tabIndex={isFocusTarget ? 0 : -1}
                    aria-selected={isSelected}
                    aria-current={isToday ? "date" : undefined}
                    onClick={() => {
                      onChange(iso);
                      closeAndFocus();
                    }}
                    className={cn(
                      "flex h-9 items-center justify-center rounded-[10px] text-sm outline-none transition-colors focus:ring-2 focus:ring-emerald-600/40",
                      isSelected
                        ? "bg-emerald-700 font-semibold text-white"
                        : "text-[#0f1e35] hover:bg-emerald-50",
                      !isSelected && isToday && "font-semibold text-emerald-700",
                      isDisabled && "cursor-not-allowed text-slate-300 hover:bg-transparent",
                    )}
                  >
                    {day}
                  </button>
                );
              })}
            </div>
          </div>
        ) : null}
      </div>
      <FieldMessage id={messageId} helper={helper} error={error} />
    </div>
  );
}

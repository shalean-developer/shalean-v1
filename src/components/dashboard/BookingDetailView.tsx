import type React from "react";
import Link from "next/link";
import {
  Bath,
  BedDouble,
  CalendarDays,
  CheckCircle2,
  Circle,
  Clock,
  CreditCard,
  Hash,
  Home,
  LifeBuoy,
  MapPin,
  MessageCircle,
  Package,
  Phone,
  Plus,
  Receipt,
  RefreshCw,
  Sparkles,
  Star,
  UserRound,
  Users,
  Wrench,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { ClearBookingDraft } from "@/components/booking/ClearBookingDraft";
import { BookingActions } from "@/components/dashboard/BookingActions";
import type { DashboardBooking } from "@/lib/dashboard/data";
import { buildWhatsappLink, supportContact } from "@/lib/config/site";
import { formatZar, slugToTitle } from "@/lib/utils";

const ASSIGNED_STATUSES = ["assigned", "in_progress", "completed"];

type BookingDetailViewProps = {
  booking: DashboardBooking;
  reconciliationMessage?: string | null;
};

export function BookingDetailView({ booking, reconciliationMessage }: BookingDetailViewProps) {
  const isRecurring = Boolean(booking.recurringSeries);
  const paymentPaid = booking.payment_status === "paid";
  const isCompleted = booking.booking_status === "completed";
  const isCancelled = booking.booking_status === "cancelled";
  const canManage = paymentPaid && !isCompleted && !isCancelled;

  const cleaner = resolveCleanerContact(booking);
  const bookingRef = booking.payment?.provider_reference ?? booking.payment?.provider_ref ?? booking.id.slice(0, 8);
  const trackingSteps = buildTrackingSteps(booking);

  const rescheduleHref = buildWhatsappLink(
    supportContact.whatsappHref,
    `Hi Shalean, I would like to reschedule my ${slugToTitle(booking.service_slug)} booking (Ref: ${bookingRef}).`,
  );
  const cancelHref = buildWhatsappLink(
    supportContact.whatsappHref,
    `Hi Shalean, I would like to cancel my ${slugToTitle(booking.service_slug)} booking (Ref: ${bookingRef}).`,
  );
  const reviewHref = buildWhatsappLink(
    supportContact.whatsappHref,
    `Hi Shalean, I would like to leave a review for my completed ${slugToTitle(booking.service_slug)} booking (Ref: ${bookingRef}).`,
  );

  return (
    <div className="space-y-5">
      <ClearBookingDraft enabled={paymentPaid} />

      {reconciliationMessage ? (
        <Card className="border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-900">
          {reconciliationMessage}
        </Card>
      ) : null}

      {/* Top: booking summary hero */}
      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 bg-gradient-to-br from-emerald-50 to-white p-5 sm:p-6">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <Badge className={paymentPaid ? undefined : "border-amber-200 bg-amber-50 text-amber-800"}>
                  {paymentPaid ? "Paid" : slugToTitle(booking.payment_status)}
                </Badge>
                <Badge className="border-slate-200 bg-slate-50 text-slate-700">{slugToTitle(booking.booking_status)}</Badge>
                {isRecurring ? (
                  <Badge className="border-emerald-200 bg-emerald-700 text-white">
                    {slugToTitle(booking.recurringSeries!.frequency)} plan
                  </Badge>
                ) : (
                  <span className="inline-flex items-center rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-500">
                    One-time booking
                  </span>
                )}
              </div>
              <h2 className="mt-4 text-2xl font-black leading-tight text-slate-950 sm:text-3xl">
                {slugToTitle(booking.service_slug)} in {booking.suburb}
              </h2>
              <div className="mt-3 flex flex-col gap-1.5 text-sm text-slate-600">
                <span className="inline-flex items-center gap-2">
                  <CalendarDays className="h-4 w-4 text-emerald-700" aria-hidden />
                  {formatDate(booking.booking_date)}
                  <span className="text-slate-300">•</span>
                  <Clock className="h-4 w-4 text-emerald-700" aria-hidden />
                  {formatTimeWindow(booking.booking_time)}
                </span>
                <span className="inline-flex items-start gap-2">
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700" aria-hidden />
                  <span>{booking.address}</span>
                </span>
                <span className="inline-flex items-center gap-2">
                  <UserRound className="h-4 w-4 text-emerald-700" aria-hidden />
                  {formatCleanerSummary(booking)}
                </span>
              </div>
            </div>
            <div className="flex flex-wrap gap-3">
              <SecondaryLink href="/bookings">All bookings</SecondaryLink>
              <PrimaryLink href="/book?new=1">Start new booking</PrimaryLink>
            </div>
          </div>
        </div>

        <div className="grid gap-3 p-5 sm:grid-cols-3 sm:p-6">
          <Stat label="Per visit" value={formatZar(getPerVisitAmount(booking))} icon={<Receipt className="h-4 w-4" aria-hidden />} />
          <Stat
            label={isRecurring ? "Series total" : "Total"}
            value={formatZar(getPaymentAmount(booking))}
            icon={<CreditCard className="h-4 w-4" aria-hidden />}
          />
          <Stat
            label="Next step"
            value={getNextStep(booking.payment_status, booking.booking_status)}
            icon={<Sparkles className="h-4 w-4" aria-hidden />}
            highlight
          />
        </div>
      </section>

      {/* Middle: visit details (left) + tracking & cleaner contact (right) */}
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-5">
          <Card className="p-5 sm:p-6">
            <SectionHeading icon={<Home className="h-5 w-5" aria-hidden />} title="Visit preparation" />
            <div className="mt-5 grid gap-x-6 gap-y-4 sm:grid-cols-2">
              <DetailRow icon={<Sparkles className="h-4 w-4" aria-hidden />} label="Service" value={slugToTitle(booking.service_slug)} />
              <DetailRow icon={<MapPin className="h-4 w-4" aria-hidden />} label="Suburb" value={booking.suburb} />
              <DetailRow icon={<Home className="h-4 w-4" aria-hidden />} label="Address" value={booking.address} wide />
              <DetailRow icon={<Clock className="h-4 w-4" aria-hidden />} label="Arrival window" value={formatTimeWindow(booking.booking_time)} />
              <DetailRow icon={<Users className="h-4 w-4" aria-hidden />} label="Cleaners requested" value={`${booking.cleaner_count} cleaner${booking.cleaner_count === 1 ? "" : "s"}`} />
              <DetailRow icon={<BedDouble className="h-4 w-4" aria-hidden />} label="Bedrooms" value={String(booking.bedrooms)} />
              <DetailRow icon={<Bath className="h-4 w-4" aria-hidden />} label="Bathrooms" value={String(booking.bathrooms)} />
              <DetailRow icon={<Plus className="h-4 w-4" aria-hidden />} label="Extra rooms" value={String(booking.extra_rooms)} />
              <DetailRow icon={<Package className="h-4 w-4" aria-hidden />} label="Cleaning equipment" value={booking.equipment?.label ?? slugToTitle(booking.equipment_option)} />
              <DetailRow icon={<Sparkles className="h-4 w-4" aria-hidden />} label="Add-ons" value={formatAddons(booking.addons)} wide />
              {booking.access_notes ? (
                <DetailRow icon={<Wrench className="h-4 w-4" aria-hidden />} label="Access notes" value={booking.access_notes} wide />
              ) : null}
            </div>
          </Card>

          {isRecurring ? (
            <Card className="p-5 sm:p-6">
              <SectionHeading icon={<RefreshCw className="h-5 w-5" aria-hidden />} title="Recurring plan" />
              <div className="mt-5 grid gap-x-6 gap-y-4 sm:grid-cols-2">
                <DetailRow label="Frequency" value={slugToTitle(booking.recurringSeries!.frequency)} />
                <DetailRow label="Generated visits" value={String(booking.recurringSeries!.occurrence_count)} />
                <DetailRow label="This visit" value={`${booking.occurrence_index ?? 1} of ${booking.occurrence_count ?? booking.recurringSeries!.occurrence_count}`} />
                <DetailRow label="Per-visit amount" value={formatZar(getPerVisitAmount(booking))} />
                <DetailRow label="Series amount" value={formatZar(getPaymentAmount(booking))} wide />
              </div>
            </Card>
          ) : null}
        </div>

        <div className="space-y-5">
          <Card className="p-5 sm:p-6">
            <SectionHeading icon={<CheckCircle2 className="h-5 w-5" aria-hidden />} title="Booking tracking" />
            <ol className="mt-5 space-y-1">
              {trackingSteps.map((step, index) => {
                const isLast = index === trackingSteps.length - 1;
                return (
                  <li key={step.label} className="flex gap-3">
                    <div className="flex flex-col items-center">
                      {step.active ? (
                        <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-700" aria-hidden />
                      ) : (
                        <Circle className="h-5 w-5 shrink-0 text-slate-300" aria-hidden />
                      )}
                      {!isLast ? (
                        <span className={step.active ? "my-1 w-0.5 flex-1 bg-emerald-200" : "my-1 w-0.5 flex-1 bg-slate-200"} />
                      ) : null}
                    </div>
                    <div className={isLast ? "pb-0" : "pb-4"}>
                      <p className={step.active ? "text-sm font-semibold text-slate-950" : "text-sm font-medium text-slate-500"}>
                        {step.label}
                      </p>
                      {step.timestamp ? (
                        <p className="mt-0.5 text-xs text-slate-500">{step.timestamp}</p>
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ol>
            <div className="mt-3 rounded-md bg-emerald-50 p-3 text-sm text-emerald-900">
              <span className="font-semibold">Current step:</span> {getNextStep(booking.payment_status, booking.booking_status)}
            </div>
          </Card>

          {cleaner ? (
            <Card className="p-5 sm:p-6">
              <SectionHeading icon={<UserRound className="h-5 w-5" aria-hidden />} title="Your cleaner" />
              <div className="mt-5 flex items-center gap-4">
                <span className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 text-emerald-700">
                  <UserRound className="h-6 w-6" aria-hidden />
                </span>
                <div className="min-w-0">
                  <p className="truncate text-base font-bold text-slate-950">{cleaner.name}</p>
                  {cleaner.rating ? (
                    <p className="mt-0.5 inline-flex items-center gap-1 text-sm text-slate-600">
                      <Star className="h-4 w-4 fill-amber-400 text-amber-400" aria-hidden />
                      {cleaner.rating.toFixed(1)} rating
                    </p>
                  ) : null}
                </div>
              </div>
              {cleaner.phone ? (
                <div className="mt-4 grid gap-2 sm:grid-cols-2">
                  <a
                    className="inline-flex items-center justify-center gap-2 rounded-md bg-emerald-700 px-3 py-2.5 text-sm font-bold text-white hover:bg-emerald-800"
                    href={buildWhatsappLink(`https://wa.me/${cleaner.whatsapp}`, `Hi ${cleaner.name}, regarding my Shalean booking (Ref: ${bookingRef}).`)}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <MessageCircle className="h-4 w-4" aria-hidden />
                    Message
                  </a>
                  <a
                    className="inline-flex items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50"
                    href={`tel:${cleaner.phone}`}
                  >
                    <Phone className="h-4 w-4" aria-hidden />
                    Call
                  </a>
                </div>
              ) : (
                <p className="mt-4 text-sm text-slate-600">
                  Contact details will appear once your cleaner is confirmed.
                </p>
              )}
            </Card>
          ) : null}
        </div>
      </div>

      {/* Bottom: payment record + booking actions/support */}
      <div className="grid gap-5 lg:grid-cols-2">
        <Card className="p-5 sm:p-6">
          <SectionHeading icon={<CreditCard className="h-5 w-5" aria-hidden />} title="Payment record" />
          <div className="mt-5 grid gap-x-6 gap-y-4 sm:grid-cols-2">
            <DetailRow icon={<CreditCard className="h-4 w-4" aria-hidden />} label="Provider" value={booking.payment?.provider ?? "Paystack"} />
            <DetailRow
              icon={<CheckCircle2 className="h-4 w-4" aria-hidden />}
              label="Payment status"
              value={slugToTitle(booking.payment?.status ?? booking.payment_status)}
            />
            <DetailRow
              icon={<Hash className="h-4 w-4" aria-hidden />}
              label="Reference"
              value={booking.payment?.provider_reference ?? booking.payment?.provider_ref ?? "Not initialized"}
              wide
            />
            <DetailRow
              icon={<Receipt className="h-4 w-4" aria-hidden />}
              label={isRecurring ? "Amount charged" : "Amount"}
              value={formatZar(getPaymentAmount(booking))}
              wide
            />
          </div>
        </Card>

        <div className="space-y-5">
          <Card className="p-5 sm:p-6">
            <SectionHeading icon={<Sparkles className="h-5 w-5" aria-hidden />} title="Booking actions" />
            <BookingActions
              canManage={canManage}
              isCompleted={isCompleted}
              paymentPaid={paymentPaid}
              rescheduleHref={rescheduleHref}
              cancelHref={cancelHref}
              reviewHref={reviewHref}
            />
          </Card>

          <Card className="bg-gradient-to-br from-emerald-50 to-white p-5 sm:p-6">
            <SectionHeading icon={<LifeBuoy className="h-5 w-5" aria-hidden />} title="Need help?" />
            <p className="mt-3 text-sm text-slate-600">
              Our Cape Town team is ready to help with this booking.
            </p>
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              <a
                className="inline-flex items-center justify-center gap-2 rounded-md bg-emerald-700 px-3 py-2.5 text-sm font-bold text-white hover:bg-emerald-800"
                href={buildWhatsappLink(supportContact.whatsappHref, `Hi Shalean, I need help with my booking (Ref: ${bookingRef}).`)}
                target="_blank"
                rel="noreferrer"
              >
                <MessageCircle className="h-4 w-4" aria-hidden />
                WhatsApp {supportContact.whatsappNumber}
              </a>
              <a
                className="inline-flex items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50"
                href={supportContact.callHref}
              >
                <Phone className="h-4 w-4" aria-hidden />
                Call {supportContact.callNumber}
              </a>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

type CleanerContact = {
  name: string;
  rating: number | null;
  phone: string | null;
  whatsapp: string | null;
};

function resolveCleanerContact(booking: DashboardBooking): CleanerContact | null {
  const cleaner = booking.selectedCleaner;
  if (!cleaner || !ASSIGNED_STATUSES.includes(booking.booking_status)) {
    return null;
  }

  const name = cleaner.display_name ?? cleaner.full_name ?? "Your cleaner";
  const phone = cleaner.phone?.trim() || null;

  return {
    name,
    rating: cleaner.rating > 0 ? cleaner.rating : null,
    phone,
    whatsapp: phone ? toWhatsappNumber(phone) : null,
  };
}

function toWhatsappNumber(phone: string) {
  const digits = phone.replace(/[^\d]/g, "");
  if (digits.startsWith("0")) {
    return `27${digits.slice(1)}`;
  }
  return digits;
}

function SectionHeading({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-emerald-700">{icon}</span>
      <h2 className="text-lg font-bold text-slate-950">{title}</h2>
    </div>
  );
}

function DetailRow({
  icon,
  label,
  value,
  wide = false,
}: {
  icon?: React.ReactNode;
  label: string;
  value: string;
  wide?: boolean;
}) {
  return (
    <div className={wide ? "sm:col-span-2" : undefined}>
      <dt className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
        {icon ? <span className="text-slate-400">{icon}</span> : null}
        {label}
      </dt>
      <dd className="mt-1 font-semibold text-slate-950">{value}</dd>
    </div>
  );
}

function Stat({
  label,
  value,
  icon,
  highlight = false,
}: {
  label: string;
  value: string;
  icon?: React.ReactNode;
  highlight?: boolean;
}) {
  return (
    <div className={highlight ? "rounded-lg border border-emerald-200 bg-emerald-50 p-4" : "rounded-lg border border-slate-200 bg-slate-50 p-4"}>
      <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
        {icon ? <span className={highlight ? "text-emerald-700" : "text-slate-400"}>{icon}</span> : null}
        {label}
      </p>
      <p className={highlight ? "mt-2 text-lg font-black text-emerald-900" : "mt-2 text-lg font-black text-slate-950"}>{value}</p>
    </div>
  );
}

function PrimaryLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link className="inline-flex items-center rounded-md bg-emerald-700 px-4 py-2.5 text-sm font-bold text-white hover:bg-emerald-800" href={href}>
      {children}
    </Link>
  );
}

function SecondaryLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link className="inline-flex items-center rounded-md border border-slate-300 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50" href={href}>
      {children}
    </Link>
  );
}

function formatAddons(addons: Array<{ label: string }>) {
  return addons.length > 0 ? addons.map((addon) => addon.label).join(", ") : "No add-ons selected";
}

function formatCleanerSummary(booking: DashboardBooking) {
  if (!booking.selectedCleaner) {
    return "Auto-assignment enabled";
  }

  const cleanerName = booking.selectedCleaner.display_name ?? booking.selectedCleaner.full_name ?? "Preferred cleaner";
  return ASSIGNED_STATUSES.includes(booking.booking_status)
    ? `${cleanerName} assigned`
    : `${cleanerName} selected`;
}

function formatDate(date: string) {
  return new Intl.DateTimeFormat("en-ZA", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(`${date}T00:00:00`));
}

function formatTimeWindow(timeWindow: string) {
  return timeWindow.replace("-", " - ");
}

function formatTimestamp(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return new Intl.DateTimeFormat("en-ZA", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function getPerVisitAmount(booking: DashboardBooking) {
  return booking.per_occurrence_total_cents ?? booking.final_total_cents;
}

function getPaymentAmount(booking: DashboardBooking) {
  return booking.payment?.amount_cents ?? booking.series_total_cents ?? booking.final_total_cents;
}

function getNextStep(paymentStatus: string, bookingStatus: string) {
  if (paymentStatus !== "paid") return "Awaiting payment";
  if (bookingStatus === "confirmed") return "Cleaner assignment";
  if (bookingStatus === "assigned") return "Cleaner assigned";
  if (bookingStatus === "in_progress") return "Cleaning in progress";
  if (bookingStatus === "completed") return "Completed";
  if (bookingStatus === "cancelled") return "Cancelled";
  return slugToTitle(bookingStatus);
}

function buildTrackingSteps(booking: DashboardBooking) {
  const { payment_status: paymentStatus, booking_status: bookingStatus } = booking;
  const request = booking.cleanerRequest;

  return [
    {
      label: paymentStatus === "paid" ? "Paid" : "Payment pending",
      active: paymentStatus === "paid",
      timestamp: paymentStatus === "paid" ? formatTimestamp(booking.payment?.created_at) : null,
    },
    {
      label: "Booking confirmed",
      active: ["confirmed", "assigned", "in_progress", "completed"].includes(bookingStatus),
      timestamp: ["confirmed", "assigned", "in_progress", "completed"].includes(bookingStatus)
        ? formatTimestamp(booking.created_at)
        : null,
    },
    {
      label: "Cleaner assignment",
      active: ASSIGNED_STATUSES.includes(bookingStatus),
      timestamp: ASSIGNED_STATUSES.includes(bookingStatus) ? formatTimestamp(request?.accepted_at) : null,
    },
    {
      label: "In progress",
      active: ["in_progress", "completed"].includes(bookingStatus),
      timestamp: ["in_progress", "completed"].includes(bookingStatus) ? formatTimestamp(request?.started_at) : null,
    },
    {
      label: "Completed",
      active: bookingStatus === "completed",
      timestamp: bookingStatus === "completed" ? formatTimestamp(request?.completed_at) : null,
    },
  ];
}

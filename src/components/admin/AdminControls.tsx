import type React from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { CleanerPhoneField } from "@/components/admin/CleanerPhoneField";
import { AdminBookingWizardCard } from "@/components/admin/AdminBookingWizardCard";
import {
  createAdminBookingAction,
  createCleanerAction,
  createCustomerAction,
  resetCleanerPasswordAction,
  resetCustomerPasswordAction,
  updateCleanerAction,
  updateCustomerAction,
} from "@/lib/admin/actions";
import type { AddonRow, AdminPayment, CleanerRow, CustomerRow, EquipmentRow } from "@/lib/admin/data";
import { cleanerEmailFromPhone, normalizeAdminCleanerPhone } from "@/lib/admin/utils";
import { bookingTransitions } from "@/lib/booking/lifecycle";
import { formatZar, slugToTitle } from "@/lib/utils";

export function CreateCleanerCard() {
  return (
    <Card className="border-slate-200 bg-white p-5 text-slate-950">
      <h2 className="text-xl font-bold">Create cleaner</h2>
      <form action={createCleanerAction} className="mt-4 grid gap-3">
        <AdminInput label="Full name" name="fullName" required />
        <AdminInput label="Display name" name="displayName" required />
        <CleanerPhoneField label="Phone number" />
        <AdminInput label="Temporary password" name="password" type="password" minLength={6} required />
        <AdminInput label="Service areas" name="suburbs" placeholder="Sea Point, Claremont" required />
        <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
          <input name="equipmentEligible" type="checkbox" defaultChecked />
          Equipment eligible
        </label>
        <SubmitButton>Create cleaner</SubmitButton>
      </form>
    </Card>
  );
}

export function CleanerManagement({ cleaners }: { cleaners: CleanerRow[] }) {
  return (
    <Card className="border-slate-200 bg-white p-5 text-slate-950">
      <h2 className="text-xl font-bold">Cleaner accounts</h2>
      <div className="mt-4 grid gap-3">
        {cleaners.map((cleaner) => {
          const phone = normalizeAdminCleanerPhone(cleaner.phone ?? "");
          const hasPhone = Boolean(phone);
          const cleanerEmail = hasPhone ? safeCleanerEmail(phone) : "Phone required before email can be generated";

          return (
            <div key={cleaner.id} className="rounded-md bg-slate-50 p-3 text-sm">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="font-bold text-slate-950">{cleaner.display_name ?? cleaner.full_name ?? "Unnamed cleaner"}</p>
                  <p className="mt-1 text-slate-600">Phone: {phone || "Missing phone"}</p>
                  <p className="mt-1 break-all text-slate-600">Email: {cleanerEmail}</p>
                  {!hasPhone ? <p className="mt-2 font-semibold text-red-700">Phone is required before this cleaner can be saved or assigned credentials.</p> : null}
                </div>
                <Badge className={cleaner.active ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-slate-200 bg-white text-slate-600"}>
                  {cleaner.active ? "Active" : "Inactive"}
                </Badge>
              </div>

              <div className="mt-3 grid gap-2">
                <details className="rounded-md border border-slate-200 bg-white p-3">
                  <summary className="cursor-pointer font-bold text-slate-950">Edit cleaner</summary>
                  <form action={updateCleanerAction} className="mt-3 grid gap-3">
                    <input type="hidden" name="cleanerId" value={cleaner.id} />
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      <AdminInput label="Full name" name="fullName" defaultValue={cleaner.full_name ?? ""} required />
                      <AdminInput label="Display name" name="displayName" defaultValue={cleaner.display_name ?? ""} required />
                      <div className="sm:col-span-2 lg:col-span-1">
                        <CleanerPhoneField defaultValue={phone} />
                      </div>
                    </div>
                    <AdminInput
                      label="Service areas"
                      name="suburbs"
                      defaultValue={cleaner.suburbs.join(", ")}
                      placeholder="Sea Point, Claremont"
                    />
                    <div className="grid gap-3 sm:grid-cols-3">
                      <AdminSelect label="Active" name="active" defaultValue={cleaner.active ? "true" : "false"} options={booleanOptions} />
                      <AdminSelect label="Available" name="available" defaultValue={cleaner.available ? "true" : "false"} options={booleanOptions} />
                      <AdminSelect label="Equipment" name="equipmentEligible" defaultValue={cleaner.equipment_eligible ? "true" : "false"} options={booleanOptions} />
                    </div>
                    <SubmitButton>Save cleaner</SubmitButton>
                  </form>
                </details>

                <details className="rounded-md border border-slate-200 bg-white p-3">
                  <summary className="cursor-pointer font-bold text-slate-950">
                    {cleaner.password_set_at ? "Reset password" : "Set password"}
                  </summary>
                  <form action={resetCleanerPasswordAction} className="mt-3 grid max-w-md gap-3">
                    <input type="hidden" name="cleanerId" value={cleaner.id} />
                    <AdminInput label="New password" name="password" type="password" minLength={6} required />
                    <SubmitButton>{cleaner.password_set_at ? "Reset password" : "Set password"}</SubmitButton>
                  </form>
                </details>
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

export function CustomerFormCard() {
  return (
    <Card className="border-slate-200 bg-white p-5 text-slate-950">
      <h2 className="text-xl font-bold">Create customer</h2>
      <form action={createCustomerAction} className="mt-4 grid gap-3">
        <AdminInput label="Full name" name="fullName" required />
        <AdminInput label="Email" name="email" type="email" required />
        <AdminInput label="Phone" name="phone" required />
        <SubmitButton>Create customer only</SubmitButton>
        <details className="rounded-md border border-slate-200 bg-slate-50 p-3">
          <summary className="cursor-pointer font-bold text-slate-950">Create customer with temporary password</summary>
          <div className="mt-3 grid gap-3">
            <AdminInput label="Temporary password" name="password" type="password" minLength={6} />
            <SubmitButton>Create with temporary password</SubmitButton>
          </div>
        </details>
      </form>
    </Card>
  );
}

export function CustomerManagement({ customers }: { customers: CustomerRow[] }) {
  return (
    <Card className="border-slate-200 bg-white p-5 text-slate-950">
      <h2 className="text-xl font-bold">Customer profiles</h2>
      <div className="mt-4 grid gap-3">
        {customers.map((customer) => (
          <div key={customer.id} className="rounded-md bg-slate-50 p-3 text-sm">
            <div>
              <p className="font-bold text-slate-950">{customer.full_name}</p>
              <p className="mt-1 break-all text-slate-600">{customer.email}</p>
              <p className="mt-1 text-slate-600">{customer.phone}</p>
            </div>
            <div className="mt-3 grid gap-2 md:grid-cols-2">
              <details className="rounded-md border border-slate-200 bg-white p-3">
                <summary className="cursor-pointer font-bold text-slate-950">Edit customer</summary>
                <form action={updateCustomerAction} className="mt-3 grid gap-3">
                  <input type="hidden" name="customerId" value={customer.id} />
                  <input type="hidden" name="authUserId" value={customer.auth_user_id ?? ""} />
                  <div className="grid gap-3 md:grid-cols-3">
                    <AdminInput label="Full name" name="fullName" defaultValue={customer.full_name} required />
                    <AdminInput label="Email" name="email" type="email" defaultValue={customer.email} required />
                    <AdminInput label="Phone" name="phone" defaultValue={customer.phone} required />
                  </div>
                  <SubmitButton>Save customer</SubmitButton>
                </form>
              </details>

              <details className="rounded-md border border-slate-200 bg-white p-3">
                <summary className="cursor-pointer font-bold text-slate-950">Set/reset password</summary>
                <form action={resetCustomerPasswordAction} className="mt-3 grid gap-3">
                  <input type="hidden" name="customerId" value={customer.id} />
                  <AdminInput label="New password" name="password" type="password" minLength={6} required />
                  <SubmitButton>Set/reset password</SubmitButton>
                </form>
              </details>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

export function AdminBookingCard({
  customers,
  cleaners,
  addons,
  equipmentOptions,
  hasActivePricingRules,
}: {
  customers: CustomerRow[];
  cleaners: CleanerRow[];
  addons: AddonRow[];
  equipmentOptions: EquipmentRow[];
  hasActivePricingRules: boolean;
}) {
  return (
    <AdminBookingWizardCard
      action={createAdminBookingAction}
      customers={customers}
      cleaners={cleaners}
      addons={addons}
      equipmentOptions={equipmentOptions}
      hasActivePricingRules={hasActivePricingRules}
    />
  );
}

export function PaymentSection({
  payments,
  payoutReadyCents,
  activeFilter,
}: {
  payments: AdminPayment[];
  payoutReadyCents: number;
  activeFilter: string;
}) {
  const filters = [
    ["all", "All"],
    ["paid", "Paid"],
    ["pending", "Pending"],
    ["refunded", "Refunded"],
  ];

  return (
    <Card className="border-slate-200 bg-white p-5 text-slate-950">
      <div className="grid gap-4 lg:grid-cols-[240px_1fr]">
        <div className="rounded-md bg-slate-50 p-4">
          <p className="text-xs font-semibold uppercase text-slate-500">Payout ready</p>
          <p className="mt-2 text-3xl font-black">{formatZar(payoutReadyCents)}</p>
          <p className="mt-2 text-sm text-slate-600">Calculated from paid bookings and accepted cleaner earnings.</p>
        </div>
        <div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h3 className="text-xl font-bold">Payment records</h3>
            <div className="flex gap-2 overflow-x-auto">
              {filters.map(([value, label]) => (
                <Link
                  key={value}
                  className={`shrink-0 rounded-md px-3 py-2 text-sm font-bold ${activeFilter === value ? "bg-emerald-700 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"}`}
                  href={value === "all" ? "/admin/payments" : `/admin/payments?status=${value}`}
                >
                  {label}
                </Link>
              ))}
            </div>
          </div>
          <div className="mt-4 grid gap-3">
            {payments.length > 0 ? payments.map((payment) => (
              <div key={payment.id} className="grid gap-2 rounded-md bg-slate-50 p-3 text-sm sm:grid-cols-[1fr_auto_auto] sm:items-center">
                <div>
                  <p className="font-semibold text-slate-950">{payment.customer?.full_name ?? "Customer unavailable"}</p>
                  <p className="mt-1 text-slate-600">{payment.booking ? `${payment.booking.suburb}, ${payment.booking.booking_date}` : "Booking unavailable"}</p>
                  <p className="mt-1 break-all text-slate-600">{payment.provider_reference ?? payment.provider_ref ?? payment.checkout_session_id ?? payment.id}</p>
                </div>
                <Badge className="justify-self-start border-slate-200 bg-white text-slate-700">{slugToTitle(payment.status)}</Badge>
                <p className="font-bold">{formatZar(payment.amount_cents)}</p>
              </div>
            )) : <p className="text-sm text-slate-600">No payments match this filter.</p>}
          </div>
        </div>
      </div>
    </Card>
  );
}

export function SettingsSection({
  adminName,
  adminEmail,
  role,
}: {
  adminName: string;
  adminEmail: string | null | undefined;
  role: string;
}) {
  const warnings = [
    role !== "admin" ? "Logged-in user does not have the admin role." : null,
    !process.env.SUPABASE_SERVICE_ROLE_KEY ? "SUPABASE_SERVICE_ROLE_KEY is not configured for server-side admin operations." : null,
  ].filter((warning): warning is string => Boolean(warning));

  return (
    <div className="grid gap-4 xl:grid-cols-[360px_1fr]">
      <Card className="border-slate-200 bg-white p-5 text-slate-950">
        <h3 className="text-xl font-bold">Access policy</h3>
        <div className="mt-4 grid gap-3 text-sm">
          <SettingRow label="Current admin" value={`${adminName}${adminEmail ? ` (${adminEmail})` : ""}`} />
          <SettingRow label="Admin role source" value="Supabase profiles.role, checked on the server" />
          <SettingRow label="Cleaner email rule" value="cleaned phone number at shalean.co.za" />
          <SettingRow label="Route protection" value="/admin and every /admin/* page require admin role" />
        </div>
        <div className="mt-4 rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
          Security-critical values are read-only in this dashboard.
        </div>
        {warnings.length > 0 ? (
          <div className="mt-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-800">
            {warnings.map((warning) => <p key={warning}>{warning}</p>)}
          </div>
        ) : (
          <div className="mt-4 rounded-md border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
            No security warnings detected for the current admin session.
          </div>
        )}
      </Card>
      <Card className="border-slate-200 bg-white p-5 text-slate-950">
        <h3 className="text-xl font-bold">Lifecycle engine</h3>
        <div className="mt-4 grid gap-3 text-sm md:grid-cols-2">
          {Object.entries(bookingTransitions).map(([from, to]) => (
            <div key={from} className="rounded-md bg-slate-50 p-3">
              <span className="font-semibold">{from}</span>
              <span className="text-slate-500">{" -> "}{to.length ? to.join(", ") : "terminal"}</span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

function SettingRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-slate-50 p-3">
      <p className="text-xs font-semibold uppercase text-slate-500">{label}</p>
      <p className="mt-1 font-bold text-slate-950">{value}</p>
    </div>
  );
}

function AdminInput({ label, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return (
    <label>
      <span className="text-sm font-semibold text-slate-700">{label}</span>
      <input className="mt-2 min-h-11 w-full rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-emerald-700" {...props} />
    </label>
  );
}

function AdminSelect({
  label,
  options,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement> & {
  label: string;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <label>
      <span className="text-sm font-semibold text-slate-700">{label}</span>
      <select className="mt-2 min-h-11 w-full rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-emerald-700" {...props}>
        {options.map((option) => (
          <option key={`${props.name}-${option.value}`} value={option.value}>{option.label}</option>
        ))}
      </select>
    </label>
  );
}

function SubmitButton({ children }: { children: React.ReactNode }) {
  return (
    <button className="rounded-md bg-emerald-700 px-4 py-3 text-sm font-bold text-white hover:bg-emerald-800" type="submit">
      {children}
    </button>
  );
}

const booleanOptions = [
  { value: "true", label: "Yes" },
  { value: "false", label: "No" },
];

function safeCleanerEmail(phone: string) {
  try {
    return cleanerEmailFromPhone(phone);
  } catch {
    return "Valid phone required before email can be generated";
  }
}

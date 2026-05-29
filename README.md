# Shalean Cleaning Services V1

Scalable Next.js 16 foundation for Shalean's cleaning marketplace in Cape Town.

## Stack

- Next.js 16 App Router, React, TypeScript, TailwindCSS
- shadcn-style local UI primitives
- Supabase schema and RLS migration
- Paystack transaction and webhook primitives
- Zoho Books accounting sync (customer + invoice on paid bookings)
- SEO routes for services and Cape Town suburbs

## Implemented Foundation

- Customer booking wizard with seven stages, saved progress, dynamic pricing, recurring options, add-ons, and cleaner/team estimation.
- Regular Cleaning premium upgrade with dedicated add-ons, separate cleaning equipment selection, cleaner profile selection, and multi-cleaner pricing.
- Shared pricing engine with payout guards that prevent invalid/R0 earnings.
- Canonical booking lifecycle transition map.
- Customer, cleaner, and admin dashboard surfaces.
- Programmatic service and location pages, sitemap, robots, and LocalBusiness schema.
- Supabase marketplace schema for customers, cleaners, teams, bookings, assignments, payments, payouts, audit trails, and notifications.
- Paystack webhook verification and quote API route.

## Local Development

```bash
npm install
npm run dev
```

Copy `.env.example` to `.env.local` and fill Supabase, Paystack, and Google Maps keys before connecting live services.

### Zoho Books accounting sync

When a booking is confirmed as paid (via the Paystack callback or webhook), the
customer and a matching invoice are synced to Zoho Books server-side. The returned
identifiers and sync status are stored on the booking (`zoho_contact_id`,
`zoho_invoice_id`, `zoho_sync_status`, `zoho_sync_error`) and surfaced in the admin
bookings grid with a "Retry Zoho Sync" action.

Configure these server-only variables (never exposed to the browser):

- `ZOHO_CLIENT_ID`
- `ZOHO_CLIENT_SECRET`
- `ZOHO_REFRESH_TOKEN`
- `ZOHO_ORGANIZATION_ID`
- `ZOHO_DC` (data center: `com`, `eu`, `in`, `com.au`, `jp`, `ca`, `sa`; defaults to `com`)

If any required Zoho variable is missing, sync is safely skipped — booking and
payment flows are never affected.

## Verification

```bash
npm run lint
npm run build
```

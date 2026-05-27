<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Cursor Cloud specific instructions

### Project overview

Single Next.js 16 App Router application — a cleaning services marketplace for Cape Town (Supabase backend, Paystack payments). See `README.md` for the full stack description.

### Running the app

- **Dev server:** `npm run dev` (starts on port 3000 via Turbopack)
- **Lint:** `npm run lint`
- **Tests:** `npm run test` (Vitest, 22 tests across 8 files)
- **Build:** `npm run build`

### Environment variables

A `.env.local` file is required. The app needs at minimum:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` (or `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`)
- `SUPABASE_SERVICE_ROLE_KEY`
- `PAYSTACK_SECRET_KEY`
- `NEXT_PUBLIC_SITE_URL` (optional, defaults to `https://shalean.co.za`)

Placeholder values are sufficient for the dev server to start and serve UI pages. Pages that invoke Supabase client (dashboards, auth routes) will throw at runtime without a real Supabase instance.

### Gotchas

- The Supabase client libraries throw immediately if env vars are missing/empty — set placeholders even when not testing DB flows.
- Service pages use `generateStaticParams`; valid slugs are in `src/lib/booking/services.ts`.
- The booking wizard is entirely client-side state (no DB required) — ideal for quick UI validation.
- ESLint uses flat config (`eslint.config.mjs`) with `eslint-config-next` core-web-vitals + TypeScript presets.

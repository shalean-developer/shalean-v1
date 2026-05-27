# Regular Cleaning V1 Audit Remediation Plan

## Summary

This plan fixes the Regular Cleaning audit blockers in production-risk order. Scope stays limited to the implemented Regular Cleaning V1 flow: Service, Schedule, Location, House Details, Cleaner Selection, Review, and Checkout / Payment.

## Priority Fixes

1. **Block unauthenticated booking creation**
   - Disable the public `/api/bookings/regular-cleaning` write path.
   - Keep booking creation behind authenticated Paystack checkout only.

2. **Make checkout idempotent**
   - Add a persistent `checkoutId` to booking drafts.
   - Store checkout/session identifiers on bookings, recurring series, and payments.
   - Reuse an existing pending checkout for the same customer and draft instead of creating duplicate booking rows.
   - Prevent paid checkout sessions from being reused.

3. **Harden validation**
   - Reject past booking dates server-side and client-side.
   - Align cleaner count limits to the Regular Cleaning rule of 1-4 cleaners.
   - Keep quote, review, and checkout using the same server validation rules.

4. **Restrict public catalog data**
   - Return only safe public cleaner fields from `/api/regular-cleaning/catalog`.
   - Stop exposing full cleaner rows to the browser.

5. **Harden Paystack webhook verification**
   - Make signature comparison safe for malformed signatures.
   - Add tests for missing, short, invalid, and valid signatures.

6. **Add cleaner login protection**
   - Add login attempt tracking for cleaner phone + PIN auth.
   - Lock a phone number temporarily after repeated failures.
   - Keep error messages neutral.

7. **Tighten Supabase security**
   - Add or repair RLS policies for V1 customer-owned data.
   - Avoid public select on recurring series without a matching safe policy.
   - Keep service-role usage server-only.

8. **Improve wizard UX and reliability**
   - Lock future step navigation until prior steps are valid.
   - Add clear recurring total labels.
   - Add better corrupted draft recovery.

## Regression Tests

- Public Regular Cleaning booking route returns a non-mutating response.
- Checkout initialization reuses an existing pending checkout session.
- Past dates are rejected by quote and checkout validation.
- Cleaner count above 4 is rejected.
- Public catalog response does not include cleaner private fields.
- Paystack signature verifier returns false for malformed signatures.
- Cleaner PIN login locks after repeated failed attempts.
- Existing pricing, recurrence, earnings, offers, and reconciliation tests continue to pass.

## Verification

- `npm run lint`
- `npm run test`
- `npm run build`
- Safe API checks:
  - `GET /api/regular-cleaning/catalog?suburb=Claremont`
  - `POST /api/bookings/quote`
  - `POST /api/bookings/regular-cleaning` must not create a booking


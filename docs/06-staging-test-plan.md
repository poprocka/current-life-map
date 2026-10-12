# Staging test plan

Run on a **staging** deployment with its own Supabase project, Calendly test event type (or a $1 variant), Stripe **test mode**, and a Resend test domain. Do not enable booking in production (`NEXT_PUBLIC_BOOKING_ENABLED`) until every row passes.

Automated equivalents run on every `npm test` (embedded Postgres, fake email, signed fake webhooks): `tests/e2e/acceptance.test.ts`, `tests/db/rls.test.ts`, `tests/auth.test.ts`.

| # | Scenario (addendum §9) | Steps on staging | Pass when |
|---|---|---|---|
| 1 | Anonymous completion | Complete the self-interview in a private window | `/admin` shows a new row: Anonymous, no email, 10/10, report ready |
| 2 | Download PDF | Click **Download PDF** | PDF content matches the results page; the footer fingerprint equals the one in Client's Map (tab B) |
| 3 | Email PDF | Request the PDF to a real inbox, then to an address that bounces (e.g. `bounced@resend.dev`) | First: PDF attached, CMS shows sent → delivered. Second: bounced. Marketing shows "no". Kill the Resend key temporarily: UI says nothing was sent, CMS shows failed |
| 4 | Booking linkage | From results, **Book a Deep Dive**, pay with Stripe test card `4242…` | Within seconds the row shows confirmed + paid; tab E shows name, email, intake answer, time + timezone, meeting link; tab D has a new script version that quotes the intake answer |
| 5a | Reschedule | Reschedule from the Calendly confirmation email | Old booking "rescheduled", new one "confirmed", still paid, same client, no new row |
| 5b | Cancel + refund | Cancel; refund in Stripe | Booking cancelled, flagged "check refund", then "refunded" after the Stripe webhook |
| 5c | Duplicate webhook | Calendly → webhook → resend an event (or replay via `curl`) | Nothing duplicated (Activity tab shows one processed event) |
| 6 | Unmatched | Book directly from the Calendly link without going through the results page | Appears under **Needs reconciliation**; linking it by assessment ID moves it into that workspace |
| 7 | Access control | (a) open `/admin` signed out; (b) sign in without MFA; (c) sign in as a non-coach user; (d) call `/api/admin/export` with a coach (non-admin) account; (e) query any table with the anon key via the Supabase REST URL | (a)(b) redirected; (c) "No access"; (d) 403; (e) empty results |
| 8 | Reproducibility | Note a fingerprint, deploy a scoring change to staging | The stored snapshot and its PDF are unchanged |
| 9 | Love N/A | Answer N/A on both Love items | Tab A shows "N/A · excluded"; Coach Report coverage lists both; Love coverage shows 2 N/A |
| 10 | Export + delete | Export JSON; delete with "DELETE" | Export has answers, results, bookings, notes; after delete the row is gone and the audit log shows `assessment.delete` |
| 11 | Webhook security | Send a Calendly payload with a wrong signature, and one with a timestamp > 3 min old | 401, nothing stored |
| 12 | Retry | Temporarily break `DATABASE_URL` for the webhook route only (or pause the DB), book, restore | Calendly retries or the 15-minute cron processes the stored event; booking appears once |
| 13 | Bundle | `npm run build && npm run check:bundle` | "Client bundle clean." |
| 14 | Mobile | Results page + PDF download on iOS Safari and Android Chrome | Download works; booking opens in a new tab |

Record each run (date, tester, pass/fail, notes) before switching production on.

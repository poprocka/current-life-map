# Environment setup — CMS, PDF email and Deep Dive booking

Everything below is configured by environment variables in Vercel (Project → Settings → Environment Variables). Set them separately for **Preview/Staging** and **Production**, with separate Supabase projects, Calendly webhooks and Stripe modes. `.env.example` lists every variable.

Without a variable, the matching feature stays off and says so honestly (for example "Email delivery isn't connected yet, so nothing was sent").

## 1. Supabase (database + coach sign-in)

1. Create a Supabase project (EU or US region, whichever your privacy notice names).
2. SQL editor → run `supabase/migrations/0001_initial.sql` (or `supabase db push`).
3. Authentication → Providers → Email: enable; **disable "Allow new users to sign up"** (coaches are invited, never self-registered).
4. Authentication → Multi-Factor → enable **TOTP**.
5. Authentication → Users → **Invite** Jana's email. After she sets a password, copy her user id and run:
   ```sql
   insert into coach_users (user_id, display_name, role) values ('<her-user-id>', 'Jana', 'admin');
   ```
   `admin` can export and delete; `coach` (for any future assistant) can read and write coach material only.
6. Project Settings → Database → Connection pooling → copy the **Transaction** URI into `DATABASE_URL` (server only).
7. Project Settings → API → copy the URL and **anon** key into `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY`. Do **not** put the service-role key anywhere in this app; it isn't used.
8. Database → Backups: confirm daily backups (encrypted at rest by Supabase) and decide the point-in-time-recovery window.
9. Optional (recommended): Database → Extensions → `pg_cron`, then schedule `select prune_booking_payloads();` daily. The Vercel cron below also calls it.

**Signing in:** `https://<your-domain>/admin` → email + password (or "email me a sign-in link") → first time: scan the QR code with an authenticator app → 6-digit code. Every later sign-in asks for the code.

## 2. Encryption and secrets

```bash
openssl rand -base64 32   # FIELD_ENCRYPTION_KEY  (free-text answers, coach notes)
openssl rand -base64 32   # BOOKING_TOKEN_SECRET  (signed one-time booking links)
openssl rand -base64 32   # CRON_SECRET
```
Store a copy of `FIELD_ENCRYPTION_KEY` in a password manager. If it is lost, encrypted notes and reflections cannot be recovered. Rotating it needs a re-encryption job (not yet built).

## 3. Resend (PDF email)

1. Add and verify your sending domain (SPF + DKIM records at your DNS host).
2. Create an API key with "Sending access" → `RESEND_API_KEY`. Set `EMAIL_FROM`, e.g. `The Current Life Map <map@yourdomain.com>`.
3. Webhooks → add `https://<your-domain>/api/webhooks/resend` with events `email.delivered`, `email.bounced`, `email.complained`, `email.failed` → copy the signing secret into `RESEND_WEBHOOK_SECRET`.

The PDF goes out as an attachment generated from the frozen snapshot. No public file URL exists. "Sent" in the CMS means Resend accepted the message. "Delivered" or "bounced" comes only from the verified webhook.

## 4. Calendly + Stripe (Deep Dive booking and payment)

Needs a paid Calendly plan that includes **webhooks and Stripe payments** (confirm on Calendly's pricing page; plans change), and a Stripe account.

1. Calendly → Integrations → **Stripe** → connect.
2. Create event type **"Life Map Deep Dive"**: 60 minutes, video location (Zoom/Meet), **Collect payments → Stripe, $125**, your cancellation and rescheduling policy in the description. Optional booking question: "What would you most like to understand from your Map?" Answers appear in the workspace and in the personalised script.
3. Copy the event's booking page URL → `CALENDLY_SCHEDULING_URL`.
4. Create a **personal access token** (Integrations → API & Webhooks), then create the webhook subscription. Choose a long random signing key and keep it:
   ```bash
   curl -X POST https://api.calendly.com/webhook_subscriptions \
     -H "Authorization: Bearer <PERSONAL_ACCESS_TOKEN>" -H "Content-Type: application/json" \
     -d '{"url":"https://<your-domain>/api/webhooks/calendly","events":["invitee.created","invitee.canceled"],
          "organization":"<your organization URI>","scope":"organization","signing_key":"<random signing key>"}'
   ```
   Put the same signing key in `CALENDLY_WEBHOOK_SIGNING_KEY`. (Get your organization URI from `GET https://api.calendly.com/users/me`.)
5. Stripe → Developers → Webhooks → add `https://<your-domain>/api/webhooks/stripe` with `charge.refunded`, `charge.failed`, `payment_intent.payment_failed`, `charge.dispute.created` → signing secret into `STRIPE_WEBHOOK_SECRET`.
6. After the staging tests pass (see `06-staging-test-plan.md`), set `NEXT_PUBLIC_BOOKING_ENABLED=1` and redeploy.

**How linkage works.** When someone clicks "Book a Deep Dive", the server creates a signed, expiring, one-time token tied to their assessment, stores only its hash, and opens the Calendly page with that token in `utm_content`. No answers, report content or assessment id ever go to Calendly. The verified `invitee.created` webhook returns the token, and the server links the booking. Anything that can't be matched safely goes to **Needs reconciliation** on the admin home page.

## 5. Vercel

1. Import the repository, framework "Next.js", Node 20+.
2. Add the variables above (Production and Preview separately).
3. `vercel.json` registers a cron for `/api/cron/retry` every 15 minutes. Vercel sends `Authorization: Bearer $CRON_SECRET` automatically when `CRON_SECRET` is set.
4. Add your domain; HTTPS is automatic.

## 6. After deploying

```bash
npm run build && npm run check:bundle   # no server secret names in browser bundles
npm test                                # schema, RLS, §9 acceptance, auth, engine
```

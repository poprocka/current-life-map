# Privacy & security checklist

Status key: **Built** = implemented and covered by tests · **Configure** = a setting you choose at deploy time · **Open** = needs a decision or review before launch.

## Access control
| | Item | Status |
|---|---|---|
| ☐ | Coach access requires a verified Supabase user + TOTP MFA (aal2) + a `coach_users` row, checked server-side on every page and route | Built (`src/server/auth.ts`, `tests/auth.test.ts`) |
| ☐ | Database RLS on every table; coach policies require `aal2`; no `anon` policies; `force row level security` | Built (`tests/db/rls.test.ts`) |
| ☐ | Admin reads run *as the coach* (RLS applies even if app code had a bug) | Built (`asCoach`) |
| ☐ | Export and delete restricted to the `admin` role | Built (route + `is_admin_mfa()`) |
| ☐ | Same-origin check on every admin mutation (CSRF) | Built |
| ☐ | Public sign-ups disabled in Supabase | Configure |
| ☐ | Future multi-coach: ownership/assignment per assessment | Open (schema ready to extend; single-coach today) |

## Data minimisation
| | Item | Status |
|---|---|---|
| ☐ | Assessments are anonymous; a client record exists only from details the person typed (PDF email or booking) | Built (§9 test 1) |
| ☐ | Contacts never merged by email; differing emails both shown | Built (§9 test 6b) |
| ☐ | No IP address, user-agent or device id stored | Built (none collected) |
| ☐ | Respondent access token stored only as a SHA-256 hash; sent in request bodies, never in URLs | Built |
| ☐ | Booking URL carries only an opaque signed token, no assessment id, answers or report content | Built (§9 test 4) |
| ☐ | No analytics or tracking scripts | Built (none installed) — keep it that way, or exclude all answer/results pages |
| ☐ | Free-text answers and coach notes encrypted at rest (AES-256-GCM, app-layer) | Built (§9 test 7) |
| ☐ | Audit log stores ids and states only, never answers, free text or notes | Built (test) |
| ☐ | Server logs: routes never log request bodies | Built — don't add body logging when debugging |

## Delivery & integrations
| | Item | Status |
|---|---|---|
| ☐ | PDF email sent only on request; "sent" only after provider acceptance; failures recorded | Built (§9 test 3) |
| ☐ | Email-delivery consent separate from marketing consent; marketing stays false | Built |
| ☐ | PDF delivered as attachment; no public or guessable file URLs | Built |
| ☐ | Webhook signatures verified (Calendly, Stripe, Resend) with timestamp tolerance; idempotent by event id | Built (§9 tests 4–5) |
| ☐ | Booking "confirmed" only from the verified provider event; "paid" only from the provider's payment confirmation; refunds/failures from Stripe | Built |
| ☐ | Unmatched/anomalous events quarantined for manual review | Built (§9 test 6) |
| ☐ | Raw webhook payloads pruned after 90 days | Built (`prune_booking_payloads`, cron) — confirm the period |

## Retention, export, deletion
| | Item | Status |
|---|---|---|
| ☐ | Per-assessment export (JSON) and hard deletion with cascade; orphaned contacts removed; deletion audited | Built (§9 test 10) |
| ☐ | Retention schedule: how long anonymous incomplete assessments, completed assessments, coach notes and booking records are kept | **Open — decide and publish in the notice** |
| ☐ | Automated deletion of abandoned in-progress assessments | Open (needs the period above) |
| ☐ | Backups: retention window, and how deletions propagate to backups | Configure + document |
| ☐ | Accounting/tax records for payments live in Stripe; decide what must survive a deletion request | Open (legal) |

## Legal review before launch
| | Item | Status |
|---|---|---|
| ☐ | Privacy & Data Use Notice names the data controller, contact, vendors (Supabase, Vercel, Resend, Calendly, Stripe), regions, transfers, retention and user rights | **Open (flag F9)** — current notice is a draft (`PRIVACY_NOTICE_VERSION = draft-2026-10-12`) |
| ☐ | Data processing agreements signed with each vendor | Open |
| ☐ | Lawful basis per purpose for each jurisdiction served (e.g. GDPR/UK GDPR, US state laws) | Open |
| ☐ | Bump `PRIVACY_NOTICE_VERSION` whenever the notice changes, so consents record which version was shown | Process |

Nothing in this repository is a legal review or a claim of compliance.

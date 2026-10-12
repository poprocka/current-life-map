#!/bin/sh
# Fails if any server secret name or server-only module leaks into the browser bundles. Run after `next build`.
set -e
LEAK=0
for k in DATABASE_URL SERVICE_ROLE BOOKING_TOKEN_SECRET FIELD_ENCRYPTION_KEY CALENDLY_WEBHOOK_SIGNING_KEY STRIPE_WEBHOOK_SECRET RESEND_API_KEY RESEND_WEBHOOK_SECRET CRON_SECRET createCipheriv coach_reports session_notes; do
  if grep -rq "$k" .next/static; then echo "LEAK: $k found in .next/static"; LEAK=1; fi
done
[ $LEAK -eq 0 ] && echo "Client bundle clean."
exit $LEAK

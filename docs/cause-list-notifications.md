# Cause List Notifications

This feature sends lawyers a push notification at night with tomorrow's hearing list.
All reminder scheduling runs in Pakistan time (`Asia/Karachi`).

## What is included

- Profile settings fields in `profiles`:
  - `expo_push_token`
  - `timezone` (fixed to `Asia/Karachi`)
  - `cause_list_reminder_enabled` (legacy, no longer used by sender logic)
  - `cause_list_reminder_hour` (legacy, no longer used by sender logic)
- Notification log table: `notification_log`
- Edge Function: `send-cause-list-reminders`
- App-side push token registration and reminder info UI in Profile tab

## Deploy checklist

1. Run Supabase migration `010_add_cause_list_notifications.sql`.
2. Deploy Edge Function:
   - `supabase functions deploy send-cause-list-reminders`
3. Set Edge Function secret:
   - `CAUSE_LIST_CRON_SECRET` (optional but recommended)
   - Note: `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are provided automatically by Supabase runtime.
4. Create a scheduler (Supabase Cron or external cron) that invokes the function every hour.
   - Include header: `x-cron-secret: <CAUSE_LIST_CRON_SECRET>`

## Example scheduler request

Use an HTTP scheduler that calls:

`https://<PROJECT-REF>.functions.supabase.co/send-cause-list-reminders`

Method: `POST`

Headers:

- `Authorization: Bearer <SUPABASE_ANON_KEY or service key>`
- `x-cron-secret: <CAUSE_LIST_CRON_SECRET>`
- `Content-Type: application/json`

Body:

`{}`

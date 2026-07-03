# Cause List Notifications

This feature sends lawyers a push notification at night with tomorrow's hearing list.
All reminder scheduling runs in Pakistan time (`Asia/Karachi`).
Notification payload includes deep link data (`legaldiary://calendar?date=YYYY-MM-DD`) and opens the Calendar tab for that date.
The send window is `8:00 PM` to `10:59 PM` Karachi time to avoid misses if the 8 PM run is delayed.

## What is included

- Profile settings fields in `profiles`:
  - `expo_push_token`
  - `timezone` (fixed to `Asia/Karachi`)
  - `cause_list_reminder_enabled` (legacy, no longer used by sender logic)
  - `cause_list_reminder_hour` (legacy, no longer used by sender logic)
- Notification log table: `notification_log`
- Edge Function: `send-cause-list-reminders`
- App-side push token registration and reminder info UI in Profile tab

## Android FCM setup (required for push on Android)

If you see "Default FirebaseApp is not initialized", you need to add Firebase/FCM credentials:

1. **Create a Firebase project** at [Firebase Console](https://console.firebase.google.com/).
2. **Add an Android app** with package name `com.umairbutt.legaldiary` (from app.json).
3. **Download `google-services.json`** from Firebase → Project settings → Your apps → Download.
4. **Place the file** at the project root: `./google-services.json`.
5. **Rebuild the APK**: `yarn build:android`.

For EAS to *send* push notifications, also upload a Google Service Account Key:
- Run `eas credentials` → Android → production → Google Service Account.
- Follow [Expo FCM guide](https://docs.expo.dev/push-notifications/fcm-credentials/).

## iOS APNs setup (required for push on iPhone)

1. **Create an APNs key** at [Apple Developer → Keys](https://developer.apple.com/account/resources/authkeys/list).
   - Enable **Apple Push Notifications service (APNs)**.
   - Download the `.p8` file (only available once).
2. Note your **Key ID** and **Team ID** (Apple Developer → Membership).
3. **Upload to EAS**:
   ```bash
   eas credentials --platform ios
   ```
   Select **production** → **Push Notifications** → upload the `.p8` key.
4. **Rebuild the iOS app** after adding APNs:
   ```bash
   npm run build:ios:appstore
   ```

Full App Store checklist: **[APP_STORE_SETUP.md](APP_STORE_SETUP.md)**.

## Deploy checklist

1. Run Supabase migration `010_add_cause_list_notifications.sql`.
2. Deploy Edge Function:
   - `supabase functions deploy send-cause-list-reminders`
3. Set Edge Function secret:
   - `CAUSE_LIST_CRON_SECRET` (optional but recommended)
   - `CAUSE_LIST_FORCE_SECRET` (required to allow manual force sends)
   - Note: `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are provided automatically by Supabase runtime.
4. Create a scheduler (Supabase Cron or external cron) that invokes the function every hour.
   - Include header: `x-cron-secret: <CAUSE_LIST_CRON_SECRET>`
   - Keep it hourly so a delayed 8 PM run can still send during the 8 PM-10:59 PM window.

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

## Troubleshooting: No notification received

### 1. Check push token in database
```sql
select id, email, expo_push_token, timezone
from public.profiles
order by updated_at desc
limit 5;
```
If `expo_push_token` is `null`, the app never saved a token. Fix: open app, allow notifications, go to Profile, tap **Register for reminders**.

### 2. Check cases for target date
```sql
select id, case_title, next_hearing_date, user_id
from public.cases
where next_hearing_date::text like '2026-03-08%'
order by updated_at desc;
```
Confirm cases exist and `next_hearing_date` is stored as `YYYY-MM-DD`.

### 3. Check notification log
```sql
select user_id, notification_type, target_date, status, error_message, sent_at
from public.notification_log
order by id desc
limit 20;
```
- No rows → function likely didn't run or didn't match any user.
- `status = 'sent'` → Expo accepted the push; check device notification settings.
- `status = 'failed'` → check `error_message`. Common Expo errors:
  - **DeviceNotRegistered** – token is stale (app reinstalled, different build). Fix: clear `expo_push_token` in DB, open app, go to Profile to re-register.
  - **InvalidCredentials** – FCM/APNs config mismatch; ensure the APK/IPA is an EAS build from the same project.
  - **HTTP 263** – transient network/proxy error. The function now retries once. If it persists, test the token at [Expo Push Tool](https://expo.dev/notifications) to verify it works.

### 4. Check cron HTTP response
```sql
select id, status_code, content, created
from net._http_response
order by id desc
limit 5;
```
- `status_code = 401` → cron auth problem (wrong anon key or x-cron-secret).
- `content` JSON shows `matchedWindow`, `sent`, `skippedNoCases`, etc.

### 5. Manual test (force send now)
Notifications are sent by the **Edge Function**, not by SQL. To trigger a test notification:

1. Call the Edge Function with `{"force": true}` in the request body **and** include `x-force-secret`:
   ```bash
   curl -X POST "https://<PROJECT-REF>.functions.supabase.co/send-cause-list-reminders" \
     -H "Authorization: Bearer <SUPABASE_ANON_KEY>" \
     -H "x-force-secret: <CAUSE_LIST_FORCE_SECRET>" \
     -H "Content-Type: application/json" \
     -d '{"force": true}'
   ```
   Or use Supabase Dashboard → Edge Functions → send-cause-list-reminders → Invoke, with body `{"force": true}`.

2. The response includes `lastExpoError` when a push fails, so you can see Expo's error without querying the DB.

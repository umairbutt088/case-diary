# App Store (iOS) setup — Case Diary for Lawyers

This guide covers publishing the iOS app to the **Apple App Store**. Android uses Google Play (see [SUPABASE_SETUP.md](SUPABASE_SETUP.md) for env vars shared by both platforms).

## What is already configured in the repo

| Item | Location |
|------|----------|
| Bundle ID | `com.umairbutt.legaldiary` in `app.json` |
| Marketing version | `expo.version` (e.g. `1.0.2`) |
| iOS build number | `expo.ios.buildNumber` (increment every upload) |
| Export compliance | `usesNonExemptEncryption: false` |
| Camera / photo permissions | `infoPlist` usage strings |
| Privacy policy URL | `extra.privacyPolicyUrl` |
| Terms URL | `extra.termsUrl` |
| Support URL | `extra.supportUrl` |
| EAS production profile | `eas.json` → `production` (store distribution) |
| Build script | `npm run build:ios:appstore` |
| Submit script | `npm run submit:ios` |

## Prerequisites (you must do these manually)

1. **Apple Developer Program** — [developer.apple.com/programs](https://developer.apple.com/programs/) ($99/year).
2. **App Store Connect app** — create an app with bundle ID `com.umairbutt.legaldiary`.
3. **Production env on EAS** — `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY` (same as Android).
4. **Supabase redirect URLs** — include `legaldiary://reset-password` (see [SUPABASE_SETUP.md](SUPABASE_SETUP.md)).

---

## Step 1 — Create the app in App Store Connect

1. Open [App Store Connect](https://appstoreconnect.apple.com).
2. **My Apps** → **+** → **New App**.
3. Platform: **iOS**.
4. Name: **Case Diary for Lawyers** (or the name you want on the store).
5. Primary language: **English (U.S.)**.
6. Bundle ID: **com.umairbutt.legaldiary** (register it in [Certificates, Identifiers & Profiles](https://developer.apple.com/account/resources/identifiers/list) first if it does not exist).
7. SKU: e.g. `legal-diary-ios`.

### Store listing (required before review)

| Field | Suggested value |
|-------|-----------------|
| **Privacy Policy URL** | `https://umairbutt088.github.io/case-diary/privacy.html` |
| **Support URL** | `https://umairbutt088.github.io/case-diary/` |
| **Category** | Productivity or Business |
| **Screenshots** | iPhone 6.7" and 6.5" (required); iPad if supporting tablets |
| **Description** | See release notes below |
| **Keywords** | lawyer, case diary, legal, court, hearings, Pakistan |
| **Age rating** | Complete the questionnaire in App Store Connect |
| **App Privacy** | Declare email, user content (cases), identifiers — match [privacy.html](privacy.html) |

---

## Step 2 — Bump version before each upload

In `app.json`:

```json
"version": "1.0.2",
"ios": {
  "buildNumber": "1"
}
```

- **`version`** — user-facing (e.g. `1.0.2`, `1.0.3`).
- **`buildNumber`** — must **increase** on every App Store upload (`1` → `2` → `3`…), even if `version` stays the same.

---

## Step 3 — Build for the App Store (EAS)

```bash
npm run build:ios:appstore
```

Or:

```bash
eas build --profile production --platform ios
```

On first run, EAS will ask to create:

- **Distribution certificate**
- **Provisioning profile**

Choose **Let EAS handle credentials** (recommended).

For **TestFlight internal testing** before public release:

```bash
npm run build:ios:internal
```

---

## Step 4 — Push notifications (APNs) for iPhone

Cause-list reminders need Apple Push Notification service (APNs) in production.

1. [Apple Developer](https://developer.apple.com/account/resources/authkeys/list) → **Keys** → **+** → enable **Apple Push Notifications service (APNs)** → download `.p8` key (once only).
2. Note **Key ID** and your **Team ID** (Membership details).
3. Upload to EAS:

   ```bash
   eas credentials --platform ios
   ```

   Select **production** → **Push Notifications** → upload the `.p8` key.

4. Rebuild iOS after adding APNs:

   ```bash
   npm run build:ios:appstore
   ```

See also [cause-list-notifications.md](cause-list-notifications.md).

---

## Step 5 — Submit to App Store Connect

### Option A — EAS Submit (recommended)

```bash
npm run submit:ios
```

EAS will prompt for:

- Apple ID
- App-specific password (create at [appleid.apple.com](https://appleid.apple.com))
- App Store Connect app (select your app)

### Option B — Manual upload

1. Download the `.ipa` from the EAS build page.
2. Use **Transporter** app (Mac) to upload to App Store Connect.

---

## Step 6 — TestFlight → Production

1. In App Store Connect, open **TestFlight** — build appears after processing (~15–30 min).
2. Add **internal testers** and install on a real iPhone.
3. Test: login, add case, push reminders, password reset deep link.
4. **App Store** tab → **+ Version** → select the build → add **What’s New** → **Submit for Review**.

---

## Step 7 — After approval

Add the live App Store URL to `app.json`:

```json
"iosAppStoreUrl": "https://apps.apple.com/app/idXXXXXXXXX"
```

Rebuild is **not** required for this URL in the share screen if you only change `extra` — but a new build is needed for the URL to ship in the binary. Alternatively hotfix in next release.

The **Share app** screen will then include both Play Store and App Store links.

---

## Suggested “What’s New” (1.0.2)

```
• Case fee tracking and payment history
• Case fees overview for all matters
• Dispose finished cases
• Team access with subordinate permissions
• Share app via link or QR code
• UI improvements and bug fixes
```

---

## Troubleshooting

| Issue | Fix |
|-------|-----|
| Build fails — no credentials | Run `eas credentials --platform ios` and let EAS create them |
| Push not received on iPhone | Upload APNs key to EAS; rebuild; test on physical device (not simulator) |
| Password reset link does not open app | Add `legaldiary://reset-password` in Supabase redirect URLs |
| “Missing compliance” in App Store Connect | `usesNonExemptEncryption: false` is set — answer export questions accordingly |
| Upload rejected — build number | Increase `ios.buildNumber` in `app.json` and rebuild |

---

## Quick command reference

```bash
# Production App Store build
npm run build:ios:appstore

# Internal TestFlight-style build
npm run build:ios:internal

# Submit latest iOS build
npm run submit:ios

# Manage signing & push credentials
eas credentials --platform ios
```

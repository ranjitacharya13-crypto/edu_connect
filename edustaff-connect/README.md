# React + Vite

## SMS and communication history

Contacts now support server-side SMS requests, native `tel:` dialing, and persistent communication history. SMS is intentionally disabled until an authorized provider is configured and the contact has an explicit `smsConsent.status` of `granted` (the API does not infer consent from a phone number).

For Twilio, set these server-only variables in `.env`:

```text
SMS_PROVIDER=twilio
TWILIO_ACCOUNT_SID=your-account-sid
TWILIO_AUTH_TOKEN=your-auth-token
SMS_SENDER_ID=your-approved-sender
PUBLIC_WEBHOOK_URL=https://your-domain.example/api/communications/webhook/twilio
```

Configure the Twilio message-status callback to the public webhook URL. Twilio registration, sender approval, destination-country support, and any India-specific template/DLT requirements must be completed in the provider account. Never put these values in `VITE_*` variables or the browser bundle. Delivery is only shown after a verified callback; provider acceptance is not delivery proof.

Relevant endpoints: `POST /api/communications/sms`, `POST /api/communications/call`, `PATCH /api/communications/call/:id`, `GET /api/communications/contact/:contactId`, and the authenticated-provider webhook at `POST /api/communications/webhook/twilio`.

This template provides a minimal setup to get React working in Vite with HMR and some Oxlint rules.

## Android app and website download

The Android launcher opens the existing React application in Capacitor, keeping its interface and workflows consistent with the website. The separate native Java screens remain in the project but are not the launcher. The app ID remains `com.educonnect.edustaff`.

Android builds bundle the React app with `VITE_API_BASE_URL` from the build environment or `.env.android`. The URL must be a reachable public HTTPS API URL ending in `/api`. Do not commit `.env.android` or place database/provider credentials in a `VITE_*` setting.

The standalone React Native Android app lives in `mobile/`, reuses the same API and account permissions, and is the APK distributed by the website download panel. It is built separately from the Capacitor project. Build and publish it from the repository root with:

```powershell
$env:JAVA_HOME = 'C:\Path\to\Android\Studio\jbr'
$env:ANDROID_HOME = 'C:\Path\to\Android\Sdk'
$env:EXPO_PUBLIC_API_BASE_URL = 'https://<your-real-public-api-host>/api'
$env:EDUCONNECT_BUILD_TEMP_DIR = 'E:\'
npm.cmd run mobile:android:build
npm.cmd run mobile:android:publish
npm.cmd run build
```

The mobile build uses Expo prebuild and Gradle `assembleDebug`; it does not require release-signing credentials. The build helper bundles the React Native JavaScript into the APK and checks that the bundle contains the configured API URL before copying the artifact back. On Windows, `EDUCONNECT_BUILD_TEMP_DIR` can point to a short path on a drive with enough free space for the staged native build. Replace the API URL with the school's permanent HTTPS API endpoint before publishing a production download. A temporary ngrok endpoint is only suitable for a short-lived test APK. The mobile app uses the same package ID, `com.educonnect.edustaff`; installing the separately debug-signed APK over the previous debug APK may require uninstalling the old build first.

### Run the self-hosted Windows stack

The existing backend is a REST API on port `5000`; the Vite website is on `5173`, and MongoDB listens only on `127.0.0.1:27017`. The checked-in `.env` selects the local `edustaff-connect` database and retains any previously configured remote-provider values without using them. The MongoDB Windows service uses its existing data directory; do not delete or reinitialize that directory.

1. Open **PowerShell as Administrator** and start the existing MongoDB service:

   ```powershell
   Start-Service MongoDB
   Get-Service MongoDB
   Test-NetConnection 127.0.0.1 -Port 27017
   ```

2. In a regular PowerShell window, start the existing backend and website:

   ```powershell
   Set-Location 'C:\Users\DESKTOP\Downloads\edu_connect-main(app standard version)\edu_connect-main\edustaff-connect'
   npm.cmd run dev
   ```

   In another window, verify the API and its MongoDB connection:

   ```powershell
   Invoke-RestMethod 'http://127.0.0.1:5000/api/health'
   ```

   Open the website at `http://localhost:5173`.

3. In a separate PowerShell window, start the HTTPS tunnel to the API:

   ```powershell
   ngrok http 5000
   ```

   In the build window, read the current HTTPS URL from ngrok's local inspector and verify the backend before building:

   ```powershell
   $tunnel = Invoke-RestMethod 'http://127.0.0.1:4040/api/tunnels'
   $publicUrl = ($tunnel.tunnels | Where-Object { $_.public_url -like 'https://*' } | Select-Object -First 1 -ExpandProperty public_url)
   if (-not $publicUrl) { throw 'No active HTTPS ngrok tunnel was found.' }
   $env:EXPO_PUBLIC_API_BASE_URL = "$publicUrl/api"
   Invoke-RestMethod "$($env:EXPO_PUBLIC_API_BASE_URL)/health"
   ```

4. Build the standalone React Native APK from the repository root. The script refuses to build unless the tunneled health endpoint reports MongoDB connected:

   ```powershell
   $env:JAVA_HOME = 'C:\Program Files\Android\Android Studio\jbr'
   $env:ANDROID_HOME = 'C:\Users\DESKTOP\AppData\Local\Android\Sdk'
   $env:EDUCONNECT_BUILD_TEMP_DIR = 'E:\'
   npm.cmd run mobile:android:build
   ```

   Verify the APK package and signature before publishing it:

   ```powershell
   $apk = '.\mobile\android\app\build\outputs\apk\debug\app-debug.apk'
   & "$env:ANDROID_HOME\build-tools\36.0.0\aapt.exe" dump badging $apk | Select-String 'package:|launchable-activity:'
   & "$env:ANDROID_HOME\build-tools\36.0.0\apksigner.bat" verify --verbose $apk
   ```

   Only after those checks pass, update the existing website download asset and build the website:

   ```powershell
   npm.cmd run mobile:android:publish
   npm.cmd run build
   ```

Stop the website/backend and ngrok with `Ctrl+C` in their respective terminals. Stop MongoDB from an elevated PowerShell window with `Stop-Service MongoDB`; this stops the service but does not remove its data. A later ngrok URL is not interchangeable with the one embedded in an already-built APK: repeat the endpoint checks and APK build before publishing that APK.

This checkout currently implements the REST API and does not contain a Socket.IO/signaling service or routes for timetable, syllabus, and recorded/live sessions. The startup commands above do not claim those services are running. The mobile app and current website can use only features implemented in this repository.

```powershell
Set-Location 'C:\path\to\edu_connect-main\edustaff-connect'
$env:VITE_API_BASE_URL = 'https://<your-real-public-api-host>/api'
npm.cmd run android:build
npm.cmd run android:publish-debug
npm.cmd run build
```

Run these commands from the directory containing `package.json` (`edustaff-connect`), not the downloaded archive's parent directory. Replace the API URL with the school's actual reachable HTTPS API URL; the example is not a real endpoint. If Android SDK setup is needed, configure it before building:

```powershell
$env:JAVA_HOME = 'C:\Path\to\Android\Studio\jbr'
$env:ANDROID_HOME = 'C:\Path\to\Android\Sdk'
```

`android:publish-debug` copies the verified debug APK to `public/downloads/educonnect.apk` and writes a small availability manifest beside it. The APK is intentionally ignored by Git; upload that generated file and manifest with the static frontend deployment. The login panel's Download Android App action links to `/downloads/educonnect.apk` and is shown when its availability manifest is present. The Vite server sends the APK with an Android package content type and attachment filename.

For Android builds, set `VITE_API_BASE_URL` to the verified public HTTPS API origin plus `/api` before building (for example, `https://api.example.com/api`). `npm run android:sync` uses Vite's `android` mode and stops if this value is missing, not HTTPS, or does not end in `/api`; this prevents shipping an app that sends API requests to its own WebView instead of the server. Supply the value through the build environment or `.env.android` (never commit credentials there). Leave it blank for the browser build, which uses the Vite `/api` proxy. Do not use an expired or temporary tunnel as a production endpoint.

## Database control center

Administrators can open Settings → Database management after signing in with an administrator account. The page reads provider status from protected backend endpoints and supports checking or switching between Local MongoDB and MongoDB Atlas. The backend tests the target with a ping and only persists the provider/database selection after the new connection is verified.

Configuration is server-only. Use the following variables in `.env`:

```text
DB_MODE=local|atlas
MONGODB_DB_NAME=edustaff-connect
MONGODB_LOCAL_URI=mongodb://127.0.0.1:27017/edustaff-connect
MONGODB_ATLAS_URI=mongodb+srv://<username>:<password>@<cluster>.mongodb.net/edustaff-connect
```

`MONGODB_ATLAS_URI` takes precedence over the legacy `MONGODB_URI`. If `DB_MODE` is omitted, an explicitly configured local URI is selected only when no Atlas URI is configured; otherwise Atlas is selected. The database name is applied explicitly by Mongoose and the URI path is replaced with that validated name. An explicit `MONGODB_DB_NAME` that conflicts with the URI path is rejected at startup. The selected provider and database name are persisted in the ignored server-side `.runtime-db-config.json`; credentials are never stored there.

Local setup detection is available from PowerShell with:

```powershell
npm.cmd run setup:local
```

The command detects an existing MongoDB Community Server installation and can start its existing Windows service. It does not download unverified installers, delete data, or run arbitrary commands. If MongoDB is missing, install MongoDB Community Server from the official distribution, then rerun the command. Local and Atlas databases remain isolated; switching does not copy, migrate, merge, or delete records.

Protected database endpoints are available under `/api/admin/database`: `GET /status`, `GET /config`, `POST /test`, `POST /switch`, `POST /setup-local`, and `GET /local-detection`. They require an authenticated administrator session.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the Oxlint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and Oxlint's TypeScript related rules in your project.

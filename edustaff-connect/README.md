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

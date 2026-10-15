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

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the Oxlint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and Oxlint's TypeScript related rules in your project.

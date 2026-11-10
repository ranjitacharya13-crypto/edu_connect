# EduStaff Connect — Complete Project Process

This document records how the project was created, configured, updated, built, and published.

## 1. Project contents

The complete project is kept in one folder:

```text
E:\Main
```

Important folders:

- `src/` — React web interface
- `server/` — Express API and MongoDB routes
- `flutter_app/` — Flutter Android application
- `public/downloads/` — APK download files served by the web app
- `dist/` — production web build
- `shared/` — shared application utilities and types

## 2. Web application architecture

The web interface uses React, Vite, Tailwind CSS, and Axios.

The backend uses Express and MongoDB. The backend serves both:

- API routes under `/api/*`
- the production web application from `dist/`

The production server listens on port `5000`.

## 3. Database setup

MongoDB must be running before starting the API. The application database is:

```text
edustaff-connect
```

Check the database health endpoint:

```powershell
Invoke-WebRequest http://localhost:5000/api/health
```

## 4. Install web/backend dependencies

From PowerShell:

```powershell
Set-Location E:\Main
npm install
```

## 5. Start the web application locally

Start the API:

```powershell
Set-Location E:\Main
npm run server
```

For development with Vite and the API together:

```powershell
Set-Location E:\Main
npm run dev
```

The Vite development interface normally uses port `5173`. The production API uses port `5000`.

## 6. Build the web interface

```powershell
Set-Location E:\Main
npm run build
```

This updates the `dist/` folder. The Express server serves the built interface from this folder.

## 7. Notes and categories feature

The Interested / Not interested feature is implemented throughout the note flow.

Web behavior:

1. Open a call or student communication history.
2. Select **Interested** or **Not interested** before saving a note.
3. Save the note.
4. The selected category is stored by the API.
5. Communication history displays a colored category label.

The API stores the category as either:

```text
interested
not_interested
```

An empty value means no category was selected.

## 8. Flutter Android application

Flutter is installed on the `E:` drive:

```text
E:\Development\Flutter\flutter
```

Flutter source is located at:

```text
E:\Main\flutter_app
```

The Flutter app includes the same Interested / Not interested controls in its call-note and student-note dialogs.

Build a release APK:

```powershell
Set-Location E:\Main\flutter_app
flutter build apk --release --dart-define=API_BASE_URL=https://followingly-mesothelial-zara.ngrok-free.dev/api
```

The generated APK is:

```text
E:\Main\flutter_app\build\app\outputs\flutter-apk\app-release.apk
```

## 9. APK download panel

The published APK is copied to:

```text
E:\Main\public\downloads\educonnect.apk
E:\Main\dist\downloads\educonnect.apk
```

The web download URL is:

```text
https://followingly-mesothelial-zara.ngrok-free.dev/downloads/educonnect.apk
```

After replacing the APK, verify that the download route returns HTTP 200.

## 10. Start ngrok

Start the API first, then expose port `5000`:

```powershell
ngrok http 5000
```

Use the HTTPS forwarding URL shown by ngrok. If the endpoint is already online, do not start a second tunnel with the same reserved hostname; use the existing tunnel or stop the old agent first.

## 11. ERR_NGROK_8012 troubleshooting

This error means ngrok is running but nothing is accepting connections on the forwarded local port.

Check port `5000`:

```powershell
Get-NetTCPConnection -LocalPort 5000 -ErrorAction SilentlyContinue
```

Restart the API from `E:\Main`:

```powershell
Set-Location E:\Main
node server/index.js
```

Then refresh the public ngrok URL.

## 12. Moving the project

The project was consolidated from the Downloads workspace into:

```text
E:\Main
```

When starting commands after the move, always use `E:\Main` as the project directory so the web server, API, Flutter source, and download files all use the same project copy.

## 13. Normal release sequence

1. Start MongoDB.
2. Run the API from `E:\Main`.
3. Run `npm run build`.
4. Test `http://localhost:5000/` and `/api/health`.
5. Build the Flutter release APK.
6. Copy the APK into both download folders.
7. Start or reuse ngrok on port `5000`.
8. Verify the web URL and APK download URL.

# Frontend

This frontend is a `Next.js` App Router application for the Training Tracker workspace.

## Main areas

- authentication and OTP verification
- dashboard overview
- task management
- team profiles
- user administration
- audit and notification views

## Auth behavior

The UI uses cookie-based auth against the backend API at `http://localhost:4000/api`.

Sign-in is a two-step MFA flow:

1. email + password
2. email OTP verification

Only after OTP verification does the backend set the auth cookie used by protected dashboard pages.

## Development

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Important files

- `app/(auth)/login/page.tsx`: login + OTP verification UI
- `app/dashboard/page.tsx`: role-aware dashboard
- `app/dashboard/profiles/*`: profile directory and detail pages
- `app/dashboard/users/page.tsx`: HR user management
- `context/AuthContext.tsx`: current-user bootstrap
- `lib/api.ts`: shared Axios client

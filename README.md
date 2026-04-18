<<<<<<< HEAD
# Training Tracker

Training Tracker is a full-stack internal operations app for onboarding and training management. It combines a `Next.js` frontend with an `Express` + `Prisma` backend and supports role-based workflows for HR, team leads, and developers.

## What the project currently includes

- Role-based authentication for `HR`, `TEAM_LEAD`, `JUNIOR_DEV`, and `SENIOR_DEV`
- Email-OTP multi-factor authentication during sign-in
- User invitations and role assignment for HR
- Profile setup and profile editing
- Training status and progress tracking
- Task assignment and task lifecycle management
- Feedback workflows
- Notifications and audit log records

## Current implementation status vs README

Before this update, the checked-in README did not describe the real project. The old `frontend/README.md` was the default Next.js starter text, so it did not match the application in this repository.

This README update now reflects the actual app structure and the MFA-enabled login flow implemented in the backend and frontend.

## Project structure

```text
training-tracker/
  backend/   Express API, Prisma schema, migrations, auth, mail, business logic
  frontend/  Next.js App Router UI, dashboard pages, auth flows, shared API client
```

## Roles

- `HR`: manage users, invitations, roles, and profile administration
- `TEAM_LEAD`: manage training progress, review profiles, assign work
- `JUNIOR_DEV`: manage own profile and work items
- `SENIOR_DEV`: manage own profile and work items

## MFA flow

This project uses email OTP as MFA for login:

1. User submits email and password.
2. Backend verifies credentials.
3. Backend generates a one-time code and sends it by email.
4. User submits the OTP.
5. Backend verifies the OTP and issues the auth cookie.

The backend persists OTP requests in the `LoginOtp` table and limits incorrect attempts.

## Local development

### Backend

From `backend/`:

```bash
npm install
npm run dev
```

Required environment variables include:

- `DATABASE_URL`
- `JWT_SECRET`
- `PORT`
- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_USER`
- `SMTP_PASS`
- `SMTP_SECURE`
- `MAIL_FROM`

### Frontend

From `frontend/`:

```bash
npm install
npm run dev
```

The frontend expects the backend at `http://localhost:4000/api`.

## Database changes

Recent schema support in this repo includes:

- training progress fields on `User`
- login OTP persistence for MFA
- notifications and audit logs
- MFA status fields on `User`

Apply Prisma migrations from `backend/` before running the app against a fresh database.

## Notes

- Protected dashboard pages rely on the auth cookie issued after OTP verification.
- Profile directory access is intended for HR and team leads.
- Individual profile editing is restricted to the profile owner and HR.
=======
# training-tracker
Role-based training tracker using Next.js, Node.js, PostgreSQL
>>>>>>> f8bf9dbd7f405ade3e1dbe401a722f011e268416

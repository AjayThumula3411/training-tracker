# Training Tracker

Training Tracker is a full-stack internal training operations app. The project is organized as two runnable apps:

- `backend/` - Express API, Prisma access, auth, mail, routes, middleware, and uploads
- `frontend/` - Next.js App Router UI, dashboard pages, shared components, context, and browser API client

## Project Structure

```text
training-tracker/
  backend/
    src/
      controllers/
      middleware/
      prisma/
      routes/
      utils/
      app.ts
      server.ts
    prisma/
    uploads/
  frontend/
    app/
    components/
    context/
    lib/
    public/
```

## Local Development

Run the API:

```bash
cd backend
npm install
npm run dev
```

Run the UI:

```bash
cd frontend
npm install
npm run dev
```

The frontend calls the backend through `/api` and proxies requests to `http://localhost:4000` by default.

## Environment

Backend environment values live in `backend/.env`. Frontend-only values live in `frontend/.env.local`.

Common backend values include:

- `DATABASE_URL`
- `JWT_SECRET`
- `PORT`
- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_USER`
- `SMTP_PASS`
- `SMTP_SECURE`
- `MAIL_FROM`

## Verification

Useful checks:

```bash
cd backend
npm run build
```

```bash
cd frontend
npm run lint
```

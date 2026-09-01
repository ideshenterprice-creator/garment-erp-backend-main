# FabricFlow ERP Backend

Production API for FabricFlow ERP — garment manufacturing (masters, purchase orders, purchase, inventory, production, boxing, sales, accounts, team, and notifications).

## Stack

- Node.js 18+, Express, TypeScript
- Prisma + PostgreSQL (Supabase in production)
- JWT access tokens + httpOnly refresh cookies
- Zod validation, Helmet, CORS allowlist, rate limiting
- Swagger UI at `/api/docs` (disabled in production unless `SWAGGER_ENABLED=true`)

## Local setup

```bash
cp .env.example .env
docker compose up -d
npm install
npx prisma generate
npx prisma migrate deploy
npx prisma db seed   # local demo data only; blocked against Supabase/production
npm run dev
```

API: `http://localhost:5000`  
- Health: `GET /health`
- Database health: `GET /health/db`
- Storage health: `GET /health/storage`
- Docs: `http://localhost:5000/api/docs`

`DIRECT_URL` must be set. Locally it can match `DATABASE_URL`. On Supabase, `DATABASE_URL` is the pooled/runtime URL and `DIRECT_URL` is the direct connection used for migrations.

## Scripts

| Script | Purpose |
|--------|---------|
| `npm run dev` | Nodemon + ts-node |
| `npm run build` | Compile TypeScript |
| `npm start` | Run `dist/server.js` |
| `npm test` | Jest |
| `npm run lint` | `tsc --noEmit` |
| `npx prisma migrate deploy` | Apply pending Prisma migrations (never `migrate reset` in production) |
| `npm run admin:upsert` | Create/update the ADMIN user from `ADMIN_EMAIL` / `ADMIN_PASSWORD` in `.env` |

## Authentication

- `POST /api/auth/login` — access token in JSON, refresh token as httpOnly cookie
- `POST /api/auth/refresh` — rotates the refresh token and returns a new access token
- `POST /api/auth/logout` — revokes refresh token
- `POST /api/auth/accept-invite`
- `GET /api/auth/me`

Roles: `ADMIN`, `TEAM_MEMBER`. Admin-only writes include team management, purchase confirm, sales submit/pay, stock adjust.

## Team invitations

Admin invites a user. A hashed one-time token is stored with expiry (`INVITE_EXPIRY` hours, default 48). Email is sent with Resend when `RESEND_API_KEY` is set. The raw token is never logged.

## Storage

Server-side Supabase Storage (`SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`). Private bucket `erp-documents` by default. The service role key must never be exposed to the browser.

Sales bill PDFs are archived in that bucket. Authenticated clients can list metadata at `GET /api/attachments` and obtain a short-lived signed URL at `GET /api/attachments/:id/url`.

## Canonical purchase route

The live route is `/api/purchase` (singular), not `/api/purchases`.

## Tests

```bash
npm test
```

CI runs install, Prisma validate/generate/migrate, build, and tests. It does not auto-deploy.

# FabricFlow ERP — Production Deployment

This guide deploys the existing Express/Prisma backend and Next.js frontend against Supabase PostgreSQL and Supabase Storage.

Do **not** use `prisma migrate reset`, `prisma db push --force-reset`, `DROP DATABASE`, or `DROP TABLE` on production.

## Architecture

```
Vercel frontend  →  Backend API  →  Supabase PostgreSQL (Prisma)
                                 →  Supabase Storage (private bucket)
                                 →  Resend (team invitations)
```

Production Supabase project (empty of ERP tables until migrations run):

`https://xbpdumzzphpdiuuvadqp.supabase.co`

The Cursor Supabase plugin may be connected to a **different** project (for example GehnaHub `vhcxbkyccvazrgwqndvy`). Never apply FabricFlow migrations to an unrelated database.

To inspect FabricFlow tables through MCP, authenticate the Supabase MCP as the account that owns `xbpdumzzphpdiuuvadqp`. Until that MCP session is connected, verify with Prisma (`npx prisma migrate status`, application queries) against this project's `DATABASE_URL` / `DIRECT_URL`.

MCP inspects the database; it is not the runtime connection. The backend still needs `DATABASE_URL` / `DIRECT_URL` from **Project Settings → Database**.

## 1. Supabase PostgreSQL

1. In the FabricFlow project, open **Project Settings → Database**.
2. Copy:
   - **Transaction pooler** connection string → `DATABASE_URL`  
     Use the pooled URL (port `6543`) and add `?pgbouncer=true` if Prisma requires it.
   - **Direct connection** string → `DIRECT_URL` (port `5432`) for migrations/introspection.
3. Replace `[YOUR-PASSWORD]` with the database password. Do not commit these values.

Prisma schema uses:

```
url       = env("DATABASE_URL")
directUrl = env("DIRECT_URL")
```

Apply migrations from the backend repo (this creates ERP tables; it does not drop existing ones):

```bash
cd garment-erp-backend-main
npx prisma generate
npx prisma migrate deploy
```

Inspect generated SQL in `prisma/migrations/` before running against production. The latest migration adds `Notification` and `FileAttachment` and enables RLS so the Supabase Data API cannot read ERP rows. Prisma still connects as the database owner.

Seed only if you explicitly want demo data. Do not seed over live customer data.

## 2. Supabase Storage

1. Create a **private** bucket named `erp-documents` (or set `SUPABASE_STORAGE_BUCKET`).
2. Do not add public policies. The backend creates signed URLs with the service role key.
3. Set backend env:

```
SUPABASE_URL=https://xbpdumzzphpdiuuvadqp.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<service_role, server only>
SUPABASE_STORAGE_BUCKET=erp-documents
```

Never put `SUPABASE_SERVICE_ROLE_KEY` in Vercel `NEXT_PUBLIC_*` variables.

## 3. Backend environment

```
NODE_ENV=production
PORT=5000

DATABASE_URL=
DIRECT_URL=

JWT_ACCESS_SECRET=
JWT_REFRESH_SECRET=
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

FRONTEND_URL=https://garment-erp-frontend-ivory.vercel.app
BACKEND_URL=https://<backend-domain>
APP_URL=https://garment-erp-frontend-ivory.vercel.app
CORS_ORIGIN=https://garment-erp-frontend-ivory.vercel.app
COOKIE_SAMESITE=none
RATE_LIMIT_MAX=1000
SWAGGER_ENABLED=false

SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
SUPABASE_STORAGE_BUCKET=erp-documents

RESEND_API_KEY=
RESEND_FROM="FabricFlow ERP <noreply@your-domain>"
INVITE_EXPIRY=48

COMPANY_NAME=
COMPANY_ADDRESS=
COMPANY_CONTACT=
COMPANY_EMAIL=
COMPANY_GSTIN=
```

For a Vercel frontend on another domain, `COOKIE_SAMESITE=none` and HTTPS (`secure` cookies) are required so the refresh cookie is sent cross-site.

CORS is an explicit allowlist from `FRONTEND_URL`, `CORS_ORIGIN`, and `APP_URL`. Wildcard `*` is not used.

## 4. Frontend environment (Vercel)

```
NEXT_PUBLIC_API_URL=https://<backend-domain>/api
NEXT_PUBLIC_APP_URL=https://<vercel-domain>
```

## 5. Email (Resend)

1. Create a Resend API key.
2. Verify the sending domain.
3. Set `RESEND_API_KEY` and `RESEND_FROM`.

Without `RESEND_API_KEY`, invitations fail in production (they still log in development, without writing the raw token).

## 6. Backend host

Keep the current backend host (Render, Railway, Fly, VM, etc.). Required steps:

- Node 18+
- `npm ci && npx prisma generate && npx prisma migrate deploy && npm run build && npm start`
- Health checks: `GET /health`, `GET /health/db`, and `GET /health/storage`

A `Dockerfile` is included. `NODE_ENV` is set after `npm ci` so the Prisma CLI remains available for `migrate deploy`.

Production start command:

```bash
npx prisma migrate deploy && node dist/server.js
```

Never run `prisma migrate reset` against production.

## 7. Frontend host (Vercel)

- Root: `garment-erp-frontend-main`
- Build: `npm run build`
- Output: Next.js default

## 8. Migration process

1. Review `prisma/migrations/<name>/migration.sql`.
2. Confirm it is additive (CREATE / ALTER ADD / INDEX / RLS). Abort if it drops tables or columns with data.
3. Run against a backup or branch if available.
4. Run `npx prisma migrate deploy` in production.
5. Verify `GET /health/db`.

## 9. Rollback strategy

- Application: redeploy the previous backend/frontend release.
- Database: restore from a Supabase PITR/backup. Prisma does not auto-rollback migrations.
- Keep a snapshot before the first production `migrate deploy`.

## 10. Smoke checks

- `/health`, `/health/db`, `/health/storage`
- Login, refresh, logout
- Admin invite + accept (email)
- Party/product CRUD
- Purchase confirm → stock
- Sales bill PDF + sales register CSV + statement CSV
- Notifications badge
- Global search
- TEAM_MEMBER cannot call `/api/team/*`

## 11. Troubleshooting

| Symptom | Check |
|---------|--------|
| CORS / cookie not set | `FRONTEND_URL` matches the Vercel origin exactly; `COOKIE_SAMESITE=none`; HTTPS |
| Migrations fail | `DIRECT_URL` is the direct (5432) connection, not the pooler |
| Invites not arriving | `RESEND_API_KEY`, domain, `RESEND_FROM` |
| Storage 503 | `SUPABASE_URL` + service role key + private bucket |
| 403 on team routes | Caller is `TEAM_MEMBER`; admin-only by design |
| Frontend 401 loop | `NEXT_PUBLIC_API_URL` includes `/api`; backend CORS allowlist |

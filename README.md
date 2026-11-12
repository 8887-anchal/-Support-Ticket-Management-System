# Relay Support Desk

A support-ticket application with a Spring Boot REST API, MySQL persistence, JWT authentication, and a React/Vite frontend.

See the [user guide](docs/user-guide.md) for customer and agent workflows, the [API guide](docs/api.md) for request examples, and [CONTRIBUTING.md](CONTRIBUTING.md) for GitHub setup and contribution instructions.

## Features

- Account registration and login; public registration always creates a `USER` account.
- `USER` accounts can create and manage their own tickets. `AGENT` accounts can see the queue, update ticket status and priority, and assign agents.
- Ticket search, category/status/priority filters, and server-side pagination.
- Dashboard counts, comments, and a ticket activity timeline.
- BCrypt password hashing, stateless signed JWTs, request validation, and role-aware ownership checks.

## Local Setup

Prerequisites: Java 21, Docker Desktop with Compose, and Node.js 20 or newer.

1. Start MySQL from the repository root:

   ```powershell
   docker compose -f "Support Ticket Management System-backend/compose.yaml" up -d
   ```

   The local database is `tickets` on host port `3308`; local-only credentials are `ticket_app` / `ticket_local_password`. Data persists in the `ticket-mysql` volume.

2. Start the API in a separate PowerShell terminal:

   ```powershell
   cd "Support Ticket Management System-backend"
   $env:BOOTSTRAP_AGENT_EMAIL = "agent@example.com"
   $env:BOOTSTRAP_AGENT_PASSWORD = "change-this-agent-password"
   $env:BOOTSTRAP_AGENT_NAME = "Support Agent"
   $secretBytes = New-Object byte[] 32
   $rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
   $rng.GetBytes($secretBytes)
   $env:JWT_SECRET = [Convert]::ToBase64String($secretBytes)
   $rng.Dispose()
   .\mvnw.cmd spring-boot:run
   ```

   The bootstrap agent is created only when the configured email is not already registered. Omit the bootstrap variables to run without an agent account. `JWT_SECRET` is required and should be generated separately for every environment; do not commit it.

3. Start the frontend in another terminal:

   ```powershell
   cd ticket-frontend
   Copy-Item .env.example .env.local
   # If the API uses port 8081, set VITE_API_URL in .env.local to http://localhost:8081/api
   npm install
   npm run dev
   ```

   Open `http://localhost:4000`. Create a normal account in the UI. Sign in as the configured bootstrap agent to access the agent queue.

## Configuration

The API listens on port `8081` by default. Runtime settings are environment-driven:

| Variable | Default | Purpose |
| --- | --- | --- |
| `PORT` | `8081` | HTTP listener port |
| `DATABASE_URL` | `jdbc:mysql://localhost:3308/tickets?...` | JDBC URL |
| `DATABASE_USERNAME` | `ticket_app` | MySQL user |
| `DATABASE_PASSWORD` | `ticket_local_password` | MySQL password |
| `JWT_SECRET` | required; no default | HMAC signing secret; generate a unique value for each environment and keep it out of Git |
| `JWT_EXPIRATION_MS` | `86400000` | Token lifetime |
| `CORS_ALLOWED_ORIGINS` | `http://localhost:4000,https://support-ticket-management-system-drab.vercel.app` | Comma-separated exact browser origins |
| `BOOTSTRAP_AGENT_EMAIL` | empty | Optional first agent email |
| `BOOTSTRAP_AGENT_PASSWORD` | empty | Optional first agent password (minimum 8 characters) |
| `BOOTSTRAP_AGENT_NAME` | empty | Optional first agent display name |

To make an existing account an agent in a local development database, first register it in the application, then run this from the repository root with its email in place of `agent@example.com`:

```powershell
docker compose -f "Support Ticket Management System-backend/compose.yaml" exec mysql mysql -uroot -proot_local_password tickets -e "UPDATE app_users SET role='AGENT' WHERE email='agent@example.com';"
```

Sign out and back in after changing the role. Do not expose a public role selector in registration; only trusted operators should grant `AGENT` access.

For deployment, use the platform's managed MySQL URL/credentials and set `CORS_ALLOWED_ORIGINS` to the exact Vercel production origin (and any preview origins you intend to use). Never use the local Compose passwords in production. Hibernate currently uses `ddl-auto=update`; use reviewed schema migrations before production data is important.

## API Overview

All routes are under `/api`. Except for registration and login, send `Authorization: Bearer <token>`.
See the [API guide](docs/api.md) for sample requests and payload details.

| Method | Route | Access |
| --- | --- | --- |
| `POST` | `/auth/register` | Public; creates `USER` |
| `POST` | `/auth/login` | Public |
| `GET` | `/auth/me` | Authenticated |
| `GET` | `/tickets` | Authenticated; `q`, `status`, `priority`, `category`, `page`, `size` filters |
| `POST` | `/tickets` | Authenticated |
| `GET`, `PUT`, `DELETE` | `/tickets/{id}` | Owner or agent; owner deletion is limited to open tickets |
| `PUT` | `/tickets/{id}/assignment` | Agent only |
| `GET`, `POST` | `/tickets/{id}/comments` | Ticket owner or agent |
| `GET` | `/tickets/{id}/activity` | Ticket owner or agent |
| `GET` | `/dashboard` | Authenticated; role-scoped visibility |
| `GET` | `/agents` | Authenticated |

Ticket status values are `OPEN`, `IN_PROGRESS`, `WAITING`, `RESOLVED`, and `CLOSED`; priorities are `LOW`, `MEDIUM`, `HIGH`, and `URGENT`.

## Tests

The backend tests use an in-memory H2 database and do not require Docker/MySQL:

```powershell
cd "Support Ticket Management System-backend"
.\mvnw.cmd test
```

Build the frontend with `cd ticket-frontend; npm run build`.

## Vercel Deployment

The frontend is Vercel-ready. Create a Vercel project connected to this repository and use:

- Root directory: `ticket-frontend`
- Framework preset: Vite
- Build command: `npm run build`
- Output directory: `dist`
- Environment variable: `VITE_API_URL=https://<your-public-backend-host>/api`

The deployed Vercel origin is `https://support-ticket-management-system-drab.vercel.app`. Set the backend's `CORS_ALLOWED_ORIGINS` to that exact origin (plus any local/preview origins needed), and redeploy the backend. The backend must be publicly reachable over HTTPS; a local `localhost` URL cannot be used by Vercel visitors. After setting or changing Vercel environment variables, redeploy the frontend. The included `vercel.json` sends browser routes to the Vite entry point.

For GitHub publishing steps and the checked-in CI workflow, see [CONTRIBUTING.md](CONTRIBUTING.md).

## Submission Links

GitHub repository: https://github.com/8887-anchal/-Support-Ticket-Management-System

Vercel frontend URL: https://support-ticket-management-system-drab.vercel.app

Backend/API URL: not publicly deployed yet. The Vercel frontend needs a public HTTPS backend configured as `VITE_API_URL` before registration/login can work from the hosted site.
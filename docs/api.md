# API Guide

The API base URL is `http://localhost:8081/api` for local development. Except for registration and login, send the JWT in the `Authorization` header. The API returns JSON; timestamps use UTC ISO-8601 values.

## Register and Sign In

Public registration always creates a `USER`; clients cannot select their role. Passwords must be 8-72 characters. Duplicate email addresses return `409 Conflict`.

```powershell
$Api = 'http://localhost:8081/api'
$registration = @{
  name = 'Jamie Chen'
  email = 'jamie@example.com'
  password = 'change-this-password'
} | ConvertTo-Json

$account = Invoke-RestMethod -Uri "$Api/auth/register" -Method Post `
  -ContentType 'application/json' -Body $registration
$Token = $account.token
$Headers = @{ Authorization = "Bearer $Token" }
```

Sign in at `POST /auth/login` with `{ "email": "...", "password": "..." }`. The response contains `token` and a user object with `id`, `name`, `email`, and `role`. `GET /auth/me` returns the authenticated user.

## Tickets

Create a ticket with `POST /tickets`:

```powershell
$ticketBody = @{
  title = 'Cannot access my account'
  description = 'Password reset link has expired.'
  category = 'Account access'
  priority = 'HIGH'
} | ConvertTo-Json

$ticket = Invoke-RestMethod -Uri "$Api/tickets" -Method Post `
  -Headers $Headers -ContentType 'application/json' -Body $ticketBody
```

Ticket statuses are `OPEN`, `IN_PROGRESS`, `WAITING`, `RESOLVED`, and `CLOSED`. Priorities are `LOW`, `MEDIUM`, `HIGH`, and `URGENT`. Categories are free-form text, up to 80 characters. New tickets always start as `OPEN`.

- `GET /tickets/{id}` returns ticket details.
- `PUT /tickets/{id}` updates title, description, category, priority, and, for agents only, status. Send all required fields in the request body.
- `DELETE /tickets/{id}` deletes a ticket. A `USER` can delete only their own `OPEN` ticket; an `AGENT` can delete any ticket.
- `GET /tickets` supports `q`, `status`, `priority`, `category`, `page`, and `size`. Page numbering starts at zero; page size is capped at 100. Results are ordered by most recently updated.

A `USER` only sees tickets they created. Attempts to access another user's ticket return `404 Not Found` so ticket existence is not disclosed.

## Agent Actions

Only an `AGENT` may assign tickets or change status. Assign an agent with `PUT /tickets/{id}/assignment`:

```powershell
$assignment = @{ agentId = 1 } | ConvertTo-Json
Invoke-RestMethod -Uri "$Api/tickets/$($ticket.id)/assignment" -Method Put `
  -Headers $Headers -ContentType 'application/json' -Body $assignment
```

Use `{ "agentId": null }` to unassign. `GET /agents` lists assignable agents. `USER` requests to assign tickets or change status return `403 Forbidden`.

## Comments and Dashboard

- `GET /tickets/{id}/comments` lists comments; `POST` to the same route with `{ "body": "..." }` adds one.
- `GET /tickets/{id}/activity` returns chronological creation, status-change, and assignment events.
- `GET /dashboard` returns `total`, `open`, `inProgress`, and `resolved` counts. Counts are scoped to a customer's own tickets and to the full queue for agents.

Every comment and activity request is scoped to a ticket the authenticated user is allowed to see. Request validation errors return a client error; invalid enum values return `400 Bad Request`.

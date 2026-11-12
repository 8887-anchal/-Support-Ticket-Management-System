# Relay User Guide

## Access and Roles

Open the frontend at `http://localhost:4000` for local development. Create an account with **Create an account** or sign in with an existing email and password. Public registration always creates a `USER` account.

The account role appears under the user's name in the sidebar. Customers and agents use the same sign-in form; the dashboard changes according to the authenticated role.

An operator creates the first agent by setting `BOOTSTRAP_AGENT_EMAIL`, `BOOTSTRAP_AGENT_PASSWORD`, and optionally `BOOTSTRAP_AGENT_NAME` before starting the API. For an existing local account, see the role-promotion command in the root README. Never allow users to choose `AGENT` during public registration.

## Customer Workflow

1. Sign in as a `USER`.
2. Select **New ticket** and enter a subject, details, category, and priority. A new ticket starts in `OPEN` status.
3. Select **My tickets** to see tickets created by your account. The dashboard counts and ticket list are scoped to your account.
4. Select a ticket to open its details, add a comment, or edit its title, description, category, or priority.
5. Customers cannot change ticket status or assign agents. A customer can delete their own ticket only while its status is `OPEN`.

Customers cannot view another user's ticket. The API returns not found for tickets outside the current user's scope.

## Agent Workflow

1. Sign in with an `AGENT` account.
2. Select **All tickets** to view the support queue. Agents can see tickets from all users.
3. Search by ticket title or description. Filter by status, priority, or category. Use the pager at the bottom of the table to move through results.
4. Open a ticket to read its details and activity, add a comment, change status or priority, or assign/remove an agent.
5. Agents can edit or delete tickets regardless of status. Ticket creation, status changes, assignments, and comments are available in the activity/conversation view.

## Status and Priority Values

Statuses: `OPEN`, `IN_PROGRESS`, `WAITING`, `RESOLVED`, `CLOSED`.

Priorities: `LOW`, `MEDIUM`, `HIGH`, `URGENT`.

## Troubleshooting

- If the page will not open, use `http://localhost:4000` including the port.
- If login or registration reports a network error, confirm the API is running at `http://localhost:8081` and MySQL is healthy with `docker compose -f "Support Ticket Management System-backend/compose.yaml" ps`.
- If an account was promoted to agent while signed in, sign out and back in to load its new role.
- Local database data persists in the `ticket-mysql` Docker volume. It is not deleted when the containers stop.

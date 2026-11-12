# Contributing and GitHub Setup

## Publish This Workspace to GitHub

The workspace has a local Git repository but no remote configured. Create an empty repository on GitHub, then run these commands from the workspace root, replacing the remote URL with your repository URL:

```powershell
git add README.md CONTRIBUTING.md docs .gitignore .github "Support Ticket Management System-backend" ticket-frontend
git commit -m "Build support ticket management system"
git branch -M main
git remote add origin https://github.com/YOUR_ACCOUNT/YOUR_REPOSITORY.git
git push -u origin main
```

If a remote is already present, inspect it with `git remote -v` and use `git push -u origin main` instead of adding it again. Never commit `.env` files, passwords, JWT secrets, `node_modules`, Vite `dist`, or Maven `target` output. The root `.gitignore` excludes these local/generated files; `.env.example` files are safe to publish.

## Local Development

Follow the [README local setup](README.md#local-setup). The stack uses Java 21, Spring Boot, MySQL Compose on host port `3308`, the API on `8081`, and Vite on `4000`.

## Run Checks Before a Pull Request

From the backend directory, with Java 21 selected:

```powershell
.\mvnw.cmd test
```

From `ticket-frontend`:

```powershell
npm ci
npm run build
```

Both checks also run in GitHub Actions for pushes and pull requests targeting `main` (`.github/workflows/ci.yml`). Backend tests use an in-memory H2 database and do not require a MySQL service.

## Pull Request Guidelines

- Keep changes focused and explain the user-visible or API behavior they affect.
- Include or update tests when changing authorization, validation, ticket operations, or response contracts.
- Update the README or user guide when setup or workflows change.
- Do not put credentials, production URLs containing secrets, or customer data in commits or pull requests.

## Deploy Frontend to Vercel

1. Import the GitHub repository in Vercel.
2. Set the project root directory to `ticket-frontend`.
3. Set the build command to `npm run build` and output directory to `dist`.
4. Configure `VITE_API_URL` as `https://YOUR_PUBLIC_API_HOST/api`.
5. Add the exact Vercel site origin to the backend `CORS_ALLOWED_ORIGINS` setting and redeploy the backend.

A Vercel-hosted frontend cannot call an API running only on your own `localhost`; use a publicly reachable HTTPS backend and database for a shared deployment. Add the generated GitHub and Vercel URLs to the README submission section after publishing.

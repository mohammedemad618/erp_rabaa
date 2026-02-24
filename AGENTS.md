# AGENTS.md

## Cursor Cloud specific instructions

### Overview

Enterprise Travel ERP — a self-contained Next.js 16 (App Router) application with in-memory backend. No external database or services required.

### Quick reference

| Action | Command |
|---|---|
| Install deps | `npm install` |
| Dev server | `npm run dev` (serves on `http://localhost:3000`, redirects to `/en`) |
| Lint | `npm run lint` |
| Test | `npm test` |
| Build | `npm run build` |

All commands are defined in `package.json`. See `README.md` for full details.

### Dev server notes

- The dev server runs on port **3000** by default.
- Root `/` redirects (307) to `/en` (English locale). Arabic locale is at `/ar`.
- All backend state is **in-memory** and resets on server restart — no database setup needed.
- No `.env` file is required; `AUTH_SESSION_SECRET` has a built-in fallback.

### Demo accounts

Hardcoded in the app (see `README.md` for full list). Primary: `admin@enterprise.local` / `Admin@12345`.

### Testing caveats

- Tests use Node.js built-in test runner with `tsx` loader (`node --test --import tsx`).
- Tests run against in-memory service modules directly — no dev server needed for `npm test`.
- CI pipeline (`.github/workflows/ci.yml`) runs: lint → test → build.

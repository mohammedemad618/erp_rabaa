## Enterprise Travel ERP

Professional Next.js baseline for enterprise travel and finance workflows.

### Stack

- Next.js 16 (App Router)
- TypeScript (strict)
- Tailwind CSS 4
- next-intl (EN/AR + RTL/LTR)
- Zustand
- Radix Tooltip

### Run

```bash
npm install
npm run dev
```

Open `http://localhost:3000` (redirects to `/en`).

Production preview:

```bash
npm run build
npm run start
```

### Quality Gates

```bash
npm run lint
npm test
npm run build
```

CI workflow is included at `.github/workflows/ci.yml` and runs lint/test/build for push and pull requests.

### Current Delivery

- Session-based authentication (login/logout/session API)
- RBAC-protected pages and APIs
- Enterprise shell with permission-aware navigation
- Travel module:
  - Travel request lifecycle with policy validation
  - Multi-level approvals and audit trail export
  - Policy simulation API
  - Policy versioning with draft/activate/schedule workflow
  - Executive insights (compliance, SLA, budget risk)
  - Booking data capture
  - Expense claim submission/review
  - Finance sync with retry/failure simulation
  - Trip closure readiness checks + settlement summary on `close_trip`
- OpenAPI contract for travel APIs at `openapi/travel-workflow.v1.yaml`
- Functional consoles for accounting, BSP, treasury, CRM, expenses, reports, OCR, templates, and transactions

### Demo Accounts

- `admin@enterprise.local` / `Admin@12345`
- `finance@enterprise.local` / `Finance@12345`
- `agent@enterprise.local` / `Agent@12345`
- `auditor@enterprise.local` / `Auditor@12345`
- `manager@enterprise.local` / `Manager@12345`
- `traveldesk@enterprise.local` / `TravelDesk@12345`

### Deploy on Netlify

Included config:

- `netlify.toml` with build command `npx prisma generate && npm run build`
- Node runtime pinned to `20`
- Set environment variables:
  - `DATABASE_URL`
  - `AUTH_SESSION_SECRET`
  - `ALLOW_DEMO_ACCOUNTS=true` (unless you intentionally want to disable demo login)

### Operations and Pilot

- Runbook: `docs/operations/travel-erp-runbook.md`
- Pilot plan: `docs/operations/travel-erp-pilot-plan.md`
- Escalation matrix: `docs/operations/travel-erp-support-escalation-matrix.md`
- Go-live checklist: `docs/operations/travel-erp-go-live-checklist.md`
- Hypercare plan: `docs/operations/travel-erp-hypercare-plan.md`
- Release readiness playbook: `docs/operations/travel-erp-release-readiness-playbook.md`
- Performance gate guide: `docs/operations/travel-erp-performance-gate.md`
- Security gate guide: `docs/operations/travel-erp-security-gate.md`
- Training guide: `docs/training/travel-erp-role-training-guide.md`

Pilot smoke check:

```bash
npm run pilot:smoke
```

Usage scenario check:

```bash
npm run pilot:usage-scenario
```

Daily health report:

```bash
npm run pilot:daily-report
```

Weekly executive summary:

```bash
npm run pilot:weekly-summary
```

Go/No-Go decision:

```bash
npm run pilot:go-no-go
```

Performance gate:

```bash
npm run pilot:performance-gate
```

Security gate:

```bash
npm run pilot:security-gate
```

Release readiness:

```bash
npm run pilot:release-readiness
```

Rollback drill:

```bash
npm run pilot:rollback-drill
```

Hypercare daily automation:

```bash
npm run pilot:hypercare
npm run pilot:task:register
npm run pilot:task:unregister
```

### Scope and Limits

- Hybrid prototype with in-memory backend logic in Next.js route handlers
- Authentication and RBAC are demo-grade, not production IAM
- Workflow state is in-memory and resets when server restarts
- External ERP/GDS integrations are simulated

### Key Folders

- `app/[locale]` routes
- `modules/travel` travel domain implementation
- `components` shared UI/layout
- `services` auth, workflow, and data services
- `i18n` localization routing/request config
- `messages` translation files
- `docs` project planning and references

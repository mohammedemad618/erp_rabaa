# Travel ERP Operations Runbook

## 1) Scope
- Product: Enterprise Travel ERP (travel workflow domain)
- Environments: `dev`, `staging`, `production`
- Coverage: authentication, travel lifecycle, policy versioning, finance sync, trip closure

## 2) Preconditions
- Node.js `>=20`
- Access to deployment platform logs
- Access to application logs and metrics dashboards
- At least one admin account with `travel.policy.manage` and `travel.finance.sync`

## 3) Standard Commands
```bash
npm install
npm run lint
npm test
npm run build
npm run start
```

## 4) Daily Operational Checklist
1. Validate deployment health:
   - App starts without runtime errors.
   - `/api/auth/session` returns `200`.
2. Validate business-critical APIs:
   - `/api/travel/requests`
   - `/api/travel/insights/overview`
   - `/api/travel/policy/active`
3. Review error logs for:
   - `transition_not_allowed`
   - `sync_failed`
   - authentication/authorization errors
4. Review KPI signals:
   - approval SLA breaches
   - finance sync failure rate
   - blocked policy rate

## 5) Pilot Smoke Command
```powershell
powershell -ExecutionPolicy Bypass -File scripts/pilot/smoke-check.ps1
```

Equivalent npm command:
```bash
npm run pilot:smoke
```

Usage scenario command:
```bash
npm run pilot:usage-scenario
```

Daily health report command:
```bash
npm run pilot:daily-report
```

Weekly executive summary command:
```bash
npm run pilot:weekly-summary
```

Go/No-Go decision command:
```bash
npm run pilot:go-no-go
```

Performance gate command:
```bash
npm run pilot:performance-gate
```

Security gate command:
```bash
npm run pilot:security-gate
```

Release readiness orchestration command:
```bash
npm run pilot:release-readiness
```

Combined hypercare daily run:
```bash
npm run pilot:hypercare
```

Register scheduled daily execution (Windows Task Scheduler):
```bash
npm run pilot:task:register
```

Rollback drill command:
```bash
npm run pilot:rollback-drill
```

## 6) Incident Severity Model
- `SEV-1`: Production outage or security incident affecting all users.
- `SEV-2`: Critical business function unavailable (approval/finance sync/closure).
- `SEV-3`: Partial degradation with workaround.
- `SEV-4`: Cosmetic or low-impact defect.

## 7) Response SLAs
- `SEV-1`: acknowledge in 15 minutes, workaround in 60 minutes.
- `SEV-2`: acknowledge in 30 minutes, workaround in 2 hours.
- `SEV-3`: acknowledge in 4 hours, fix in next planned release.
- `SEV-4`: triage in backlog grooming.

## 8) Incident Playbooks

### A) Login/Auth Failure
1. Check `/api/auth/session` behavior.
2. Verify session cookie issuance on `/api/auth/login`.
3. Confirm role-permission mapping in `services/auth/rbac.ts`.
4. If broken in production, rollback to last known good release.

### B) Finance Sync Failure Spike
1. Filter logs for `finance_sync_failed`.
2. Confirm impacted requests and retry count.
3. Re-run sync from finance console for affected requests.
4. If persistent, freeze new closure actions and escalate to backend owner.

### C) Policy Activation Incident
1. Identify last activated version from `/api/travel/policy/active`.
2. Activate previous stable version using policy activation API.
3. Re-test simulation endpoint for critical scenarios.
4. Announce rollback and impact window.

### D) Trip Closure Backlog
1. Query closure readiness endpoint for blocked requests.
2. Classify blockers: pending expenses, unsynced approvals, missing booking.
3. Assign actions to travel desk/finance owners.
4. Track daily until closure backlog returns below threshold.

## 9) Rollback Procedure
1. Trigger release rollback to previous artifact.
2. Run `npm run pilot:smoke` against rolled-back target.
3. Validate critical workflows (submit -> approve -> finance sync -> close).
4. Publish rollback summary with timestamp and owner.
5. Run and archive rollback drill evidence:
   - `npm run pilot:rollback-drill`
6. Re-run security/performance gates on rollback target if used for go-live:
   - `npm run pilot:security-gate`
   - `npm run pilot:performance-gate`

## 10) Communication Template
```text
Incident: <title>
Severity: <SEV-x>
Start Time (UTC): <timestamp>
Current Status: <investigating/mitigated/resolved>
User Impact: <summary>
Next Update: <timestamp>
Owner: <name>
```

Incident ticket template:
- `docs/operations/travel-erp-incident-ticket-template.md`
Go/No-Go framework:
- `docs/operations/travel-erp-go-no-go-framework.md`
Release readiness playbook:
- `docs/operations/travel-erp-release-readiness-playbook.md`
Performance gate:
- `docs/operations/travel-erp-performance-gate.md`
Security gate:
- `docs/operations/travel-erp-security-gate.md`

## 11) Post-Incident Review
- Root cause
- Detection gap
- Containment actions
- Permanent corrective actions
- Target date and accountable owner

# Operations Documentation

- `docs/operations/travel-erp-runbook.md`
  - Primary incident and operational runbook.
- `docs/operations/travel-erp-support-escalation-matrix.md`
  - Severity model, escalation rules, and response targets.
- `docs/operations/travel-erp-pilot-plan.md`
  - Pilot execution plan, dates, KPIs, and exit criteria.
- `docs/operations/travel-erp-go-live-checklist.md`
  - Go-live readiness and day-0 checklist.
- `docs/operations/travel-erp-hypercare-plan.md`
  - 30-day post-pilot support cadence and exit criteria.
- `docs/operations/travel-erp-incident-ticket-template.md`
  - Standardized incident ticket format for support escalation.
- `docs/operations/travel-erp-oncall-rota.md`
  - Weekly on-call ownership and backup rotation.
- `docs/operations/travel-erp-shift-handover-template.md`
  - Shift handover format for continuity.
- `docs/operations/travel-erp-go-no-go-framework.md`
  - Decision criteria and workflow for executive go/no-go approval.
- `docs/operations/travel-erp-release-readiness-playbook.md`
  - Consolidated release readiness automation and sign-off flow.
- `docs/operations/travel-erp-performance-gate.md`
  - Performance baseline thresholds and gate procedure.
- `docs/operations/travel-erp-security-gate.md`
  - Security boundary validation and authorization gate procedure.

Smoke check script:
- `scripts/pilot/smoke-check.ps1`

Usage scenario script:
- `scripts/pilot/usage-scenario-check.ps1`

Daily report script:
- `scripts/pilot/daily-health-report.ps1`

Weekly summary script:
- `scripts/pilot/weekly-executive-summary.ps1`

Go/No-Go script:
- `scripts/pilot/go-no-go-decision.ps1`

Release readiness orchestration script:
- `scripts/pilot/release-readiness.ps1`

Performance gate script:
- `scripts/pilot/performance-gate.ps1`

Security gate script:
- `scripts/pilot/security-gate.ps1`

Hypercare automation scripts:
- `scripts/pilot/hypercare-daily.ps1`
- `scripts/pilot/register-hypercare-task.ps1`
- `scripts/pilot/unregister-hypercare-task.ps1`

Rollback drill script:
- `scripts/pilot/rollback-drill.ps1`

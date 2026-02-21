# Travel ERP Release Readiness Playbook

## 1) Purpose
Provide one command that consolidates release evidence before launch:
- weekly executive KPI snapshot
- automated Go/No-Go decision
- consolidated release-readiness report
- release-readiness history log

## 2) Command
```bash
npm run pilot:release-readiness
```

Equivalent PowerShell command:
```powershell
powershell -ExecutionPolicy Bypass -File scripts/pilot/release-readiness.ps1 -RunQualityGates -RunPerformanceGate -RunSecurityGate
```

## 3) Optional Parameters
- `-BaseUrl`: target environment URL.
- `-Email`, `-Password`: service account credentials.
- `-OutDir`: reports directory.
- `-OpenSev1`, `-OpenSev2`: current open critical incidents.
- `-SkipSmoke`: skip smoke check inside Go/No-Go (not recommended).
- `-RunQualityGates`: run `lint`, `test`, `build` as mandatory evidence.
- `-RunPerformanceGate`: run performance API baseline gate.
- `-RunSecurityGate`: run authorization and API boundary gate.

## 4) Generated Outputs
- `docs/operations/reports/weekly-executive-summary-<YYYY-Www>.md`
- `docs/operations/reports/go-no-go-decision-<YYYY-Www>.md`
- `docs/operations/reports/go-no-go-history.md`
- `docs/operations/reports/release-readiness-<YYYY-MM-DD>.md`
- `docs/operations/reports/release-readiness-history.md`
- `docs/operations/reports/performance-gate-<YYYY-MM-DD>.md` (when `-RunPerformanceGate`)
- `docs/operations/reports/security-gate-<YYYY-MM-DD>.md` (when `-RunSecurityGate`)

## 5) Decision Mapping
- `GO` -> `READY`
- `CONDITIONAL-GO` -> `READY-WITH-RISKS`
- `NO-GO` -> `NOT-READY`

## 6) Manual Sign-Off (After Automation)
Automation does not replace business sign-off. Complete:
1. Runbook and escalation approvals.
2. On-call and rollback drill confirmation (`npm run pilot:rollback-drill`).
3. Training evidence.
4. Product, operations, finance, and security sign-off as applicable.

# Travel ERP Performance Gate

## 1) Purpose
Validate API responsiveness and error rate before go-live using a repeatable baseline.

## 2) Command
```bash
npm run pilot:performance-gate
```

Equivalent PowerShell:
```powershell
powershell -ExecutionPolicy Bypass -File scripts/pilot/performance-gate.ps1
```

## 3) Default Scope
- Auth session API
- Travel requests API
- Insights overview API
- Active policy API
- Policy versions API

## 4) Default Thresholds
- Iterations per endpoint: `30`
- Average latency: `<= 700 ms`
- P95 latency: `<= 1200 ms`
- Error rate: `<= 1%`

## 5) Outputs
- `docs/operations/reports/performance-gate-<YYYY-MM-DD>.md`
- `docs/operations/reports/performance-gate-history.md`

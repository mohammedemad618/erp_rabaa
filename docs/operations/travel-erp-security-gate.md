# Travel ERP Security Gate

## 1) Purpose
Validate permission boundaries and protected API behavior before go-live.

## 2) Command
```bash
npm run pilot:security-gate
```

Equivalent PowerShell:
```powershell
powershell -ExecutionPolicy Bypass -File scripts/pilot/security-gate.ps1
```

## 3) Baseline Checks
1. Anonymous access to protected travel APIs is rejected.
2. Non-finance roles cannot execute finance sync.
3. Non-admin roles cannot activate policy versions.
4. Unauthorized roles cannot export audit CSV.
5. Authorized roles can access approved protected APIs.

## 4) Outputs
- `docs/operations/reports/security-gate-<YYYY-MM-DD>.md`
- `docs/operations/reports/security-gate-history.md`

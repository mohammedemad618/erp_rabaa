# Travel ERP Go-No-Go Framework

## 1) Purpose
Provide a repeatable executive decision process for production go-live readiness using automated checks and sign-off governance.

## 2) Decision Outcomes
- `GO`: all required checks pass.
- `CONDITIONAL-GO`: no hard failures, but one or more required checks were skipped.
- `NO-GO`: one or more required checks failed.

## 3) Required Criteria
1. Pilot smoke check passes.
2. Quality gates (`lint`, `test`, `build`) pass.
3. Performance gate passes.
4. Security gate passes.
5. Compliance rate is at or above target.
6. Blocked policy rate is below target.
7. No open `SEV-1` incidents.
8. No open `SEV-2` incidents.
9. Booked requests blocked from closure are within threshold.

## 4) Generation Command
```bash
npm run pilot:go-no-go
```

Default command executes quality, performance, and security gates.  
Override thresholds using direct script parameters if needed.

## 5) Output Artifacts
- Decision report:
  - `docs/operations/reports/go-no-go-decision-<YYYY-Www>.md`
- Decision history:
  - `docs/operations/reports/go-no-go-history.md`
- Supporting gate reports:
  - `docs/operations/reports/performance-gate-<YYYY-MM-DD>.md`
  - `docs/operations/reports/security-gate-<YYYY-MM-DD>.md`

## 6) Required Sign-Off
- Product Owner
- Operations Lead
- Finance Lead
- Security Owner (if applicable)

## 7) Governance Note
For manual incident inputs (`OpenSev1`, `OpenSev2`), the incident owner must validate counts before final approval.

## 8) Consolidated Evidence Package
For launch governance artifacts (weekly summary + decision + manual sign-off checklist), run:
```bash
npm run pilot:release-readiness
```

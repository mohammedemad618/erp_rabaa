# Travel ERP Go-Live Checklist

## 1) Pre-Go-Live Technical Gates
- [ ] `npm run lint` passed
- [ ] `npm test` passed
- [ ] `npm run build` passed
- [ ] `npm run pilot:smoke` passed on target environment
- [ ] `npm run pilot:performance-gate` passed
- [ ] `npm run pilot:security-gate` passed
- [ ] `npm run pilot:release-readiness` generated with `READY` (or approved `READY-WITH-RISKS`)
- [ ] OpenAPI contract updated and reviewed
- [ ] No unresolved `SEV-1` / `SEV-2` defects

## 2) Security and Access
- [ ] Admin accounts validated
- [ ] Role-permission matrix reviewed
- [ ] Audit export verified
- [ ] Session timeout/cookie behavior validated

## 3) Operations Readiness
- [ ] Runbook approved
- [ ] Escalation matrix approved and distributed
- [ ] On-call schedule published
- [ ] Rollback plan tested (`npm run pilot:rollback-drill` evidence attached)

## 4) Business Readiness
- [ ] Pilot exit criteria met
- [ ] Key user sign-off complete
- [ ] Finance sign-off complete
- [ ] Training completed for all pilot roles

## 5) Day-0 Launch Checks
- [ ] Smoke check executed post-deployment
- [ ] Login flow verified
- [ ] Request creation verified
- [ ] Approval flow verified
- [ ] Finance sync + closure readiness verified

## 6) Hypercare Plan
- [ ] Daily review cadence confirmed (first 30 days)
- [ ] Weekly KPI and defect review meeting scheduled
- [ ] Support response SLA tracking enabled

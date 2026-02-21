# Travel ERP Pilot Plan

## 1) Pilot Window
- Start Date: **March 2, 2026**
- End Date: **March 20, 2026**
- Hypercare Window: **March 21, 2026 to April 19, 2026**

## 2) Pilot Objectives
1. Validate end-to-end travel lifecycle in real usage.
2. Confirm policy compliance behavior and exception handling.
3. Validate finance sync and trip closure reliability.
4. Measure user adoption and completion speed by role.

## 3) Pilot Cohort
- Employees/Travelers: 25
- Managers/Approvers: 8
- Travel Desk Agents: 4
- Finance Reviewers: 4
- Auditors/Observers: 2

## 4) Entry Criteria (Must Pass Before March 2, 2026)
1. `npm run lint` passes.
2. `npm test` passes.
3. `npm run build` passes.
4. `npm run pilot:smoke` passes against pilot environment.
5. `npm run pilot:performance-gate` passes.
6. `npm run pilot:security-gate` passes.
7. Support escalation matrix approved.
8. Role-based training sessions delivered.

## 5) Execution Cadence
- Daily standup (15 min): support + product + engineering.
- Daily health check:
  - API smoke status
  - auth/login success
  - finance sync failures
  - closure readiness backlog
- Weekly checkpoint:
  - KPI trend review
  - user feedback consolidation
  - priority fix decision

## 6) Pilot KPIs and Exit Thresholds
- First-time request completion success: `>= 85%`
- Median request creation time: `<= 5 minutes`
- Median approval action time: `<= 30 seconds`
- Policy compliance ratio: `>= 95%`
- Finance sync success on first attempt: `>= 90%`
- Critical incidents (`SEV-1`/`SEV-2`): `0` unresolved at pilot close

## 7) Pilot Tracking Board
- `New`: new issue reported
- `Triaged`: root cause and owner assigned
- `In Progress`: fix in development
- `Ready to Verify`: deployed to pilot environment
- `Closed`: validated by reporter

## 8) Feedback Intake
- Channel: dedicated operations/support channel
- Mandatory fields:
  - role
  - environment
  - workflow step
  - screenshot/log snippet
  - expected vs actual behavior

## 9) Go/No-Go Decision (March 20, 2026)
- `Go`: all exit thresholds met, no unresolved `SEV-1/SEV-2`.
- `Conditional Go`: thresholds partially met with accepted mitigation plan.
- `No-Go`: unresolved critical defects or KPI failure without mitigation.
- Evidence package command:
  - `npm run pilot:release-readiness`

## 10) Hypercare (30 Days After Pilot)
1. Daily incident review.
2. Weekly KPI trend review.
3. Weekly backlog reprioritization.
4. End-of-hypercare report with recommendations.

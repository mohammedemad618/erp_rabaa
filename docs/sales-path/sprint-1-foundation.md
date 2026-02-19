# Sales Path Sprint 1 Foundation

## Scope
Sprint 1 establishes the operating baseline for an enterprise sales path in the frontend:

1. Canonical workflow and stage policy.
2. Role matrix and approval rules.
3. SLA targets per stage.
4. API contract draft for backend integration.

This sprint does not include payment gateway integration or invoice posting to ERP backend.

## Canonical Sales Workflow
Primary sequence:

1. `draft`
2. `ocr_reviewed`
3. `pending_approval`
4. `approved`
5. `pending_payment`
6. `paid`
7. `receipt_issued`

High-risk terminal outcomes:

1. `refunded`
2. `voided`

## Workflow Policy
Rules applied by the UI state machine:

1. A record can only move through allowed transitions from its current state.
2. `refund` and `void` require high-risk privileges.
3. High-risk actions require PIN re-auth at execution time.
4. Approval-sensitive actions cannot run unless the record is approved.
5. Terminal states (`refunded`, `voided`) are immutable in Sprint 1.

## Role Matrix (Operational)
| Role | Primary Responsibility | Allowed Critical Actions |
| --- | --- | --- |
| `agent` | Sales entry, customer handling, payment follow-up | Regular workflow actions except high-risk actions |
| `finance_manager` | Approval, financial control, exception handling | Approve, refund, void, financial override |
| `admin` | Full control and policy override | All actions |
| `auditor` | Audit-only read access | No workflow-changing actions |

## SLA Targets
| Stage | Target | Breach Signal |
| --- | --- | --- |
| `draft` | 2 hours | Warning after target is exceeded |
| `ocr_reviewed` | 1 hour | Warning |
| `pending_approval` | 4 hours | Critical |
| `approved` | 2 hours | Warning |
| `pending_payment` | 12 hours | Critical |
| `paid` | 1 hour (to receipt) | Warning |
| `receipt_issued` | 24 hours (post-sale closure checks) | Warning |

## Sprint 1 Deliverables
1. Sales state machine implementation and transition guards.
2. Unified permission evaluation for workflow transitions.
3. OpenAPI v1 contract for sales endpoints and transitions.
4. Sales workflow panel in transaction UI to expose state and next actions.

## Acceptance Criteria
1. UI can compute and display valid next transitions by role and current state.
2. Restricted actions are blocked with explicit reason.
3. High-risk actions are flagged as PIN-required.
4. API contract compiles as valid OpenAPI 3.1 schema.
5. Project passes `npm run lint` and `npm run build`.

## Deferred to Sprint 2+
1. Real backend persistence and optimistic concurrency control.
2. Payment gateway webhook and reconciliation callback.
3. Invoice and ledger posting integration.
4. Notification engine (email, SMS, in-app queue).

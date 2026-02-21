# Travel ERP Support Escalation Matrix

## 1) Tier Model
- `L1 Support`: first response, ticket intake, basic triage.
- `L2 Product Support`: functional triage, workflow validation, user impact analysis.
- `L3 Engineering`: code/config/database fixes.
- `Security Owner`: security/privacy incidents.
- `Operations Lead`: release/rollback and production stability.

## 2) Severity to Response Targets
| Severity | Initial Response | Escalation Deadline | Resolution Target |
|---|---:|---:|---:|
| SEV-1 | 15 min | 15 min | 1 hour workaround |
| SEV-2 | 30 min | 30 min | 2 hours workaround |
| SEV-3 | 4 hours | 1 business day | Planned release |
| SEV-4 | 1 business day | Weekly review | Backlog |

## 3) Escalation Paths

### SEV-1 / Security
1. L1 opens incident bridge.
2. Notify Security Owner + Operations Lead + Engineering Lead immediately.
3. Freeze non-critical deployments.
4. Share updates every 30 minutes until mitigated.

### SEV-2 / Critical Function Failure
1. L1 routes to L2 and opens incident ticket.
2. L2 confirms impact (approval, finance sync, closure, login).
3. Escalate to L3 within 30 minutes if no workaround.

### SEV-3 / Partial Degradation
1. L1 captures exact reproduction path.
2. L2 assigns owner and priority.
3. L3 fixes in planned sprint or hotfix if risk increases.

## 4) Required Ticket Fields
- Severity
- Environment
- Affected role(s)
- Affected API/feature
- Reproduction steps
- Logs/screenshot
- Business impact

## 5) Escalation Contacts (Current Demo Environment)
- L1 Shift Lead: Travel Desk Operator (`traveldesk@enterprise.local`) - role `travel_desk`
- L2 Product Support Lead: Department Manager (`manager@enterprise.local`) - role `manager`
- L3 Engineering On-Call: System Administrator (`admin@enterprise.local`) - role `admin`
- Security Owner: Internal Auditor (`auditor@enterprise.local`) - role `auditor`
- Operations Lead: Finance Controller (`finance@enterprise.local`) - role `finance_manager`

## 6) Communication Channels
| Context | Primary Channel | Backup Channel | Owner |
|---|---|---|---|
| Incident Bridge (SEV-1/SEV-2) | `ops-incident-bridge@enterprise.local` | Phone tree (on-call list) | Operations Lead |
| Functional Support | `travel-support@enterprise.local` | `traveldesk@enterprise.local` | L1 Shift Lead |
| Product Clarifications | `travel-product@enterprise.local` | `manager@enterprise.local` | L2 Product Support Lead |
| Engineering Escalation | `travel-engineering@enterprise.local` | `admin@enterprise.local` | L3 Engineering On-Call |
| Security Escalation | `security-incident@enterprise.local` | `auditor@enterprise.local` | Security Owner |

## 7) Incident Closure Criteria
1. Service restored and verified.
2. Monitoring stable for agreed observation window.
3. User-facing communication sent.
4. Post-incident action items logged with owner/date.

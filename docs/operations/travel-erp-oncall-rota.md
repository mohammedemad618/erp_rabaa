# Travel ERP On-Call Rota

## 1) Coverage Model
- Window: 24x7 incident availability for `SEV-1` and `SEV-2`
- Rotation: weekly
- Escalation chain: L1 -> L2 -> L3 -> Security/Operations Lead

## 2) Team Mapping
- L1 Primary: Travel Desk Operator (`traveldesk@enterprise.local`)
- L2 Primary: Department Manager (`manager@enterprise.local`)
- L3 Primary: System Administrator (`admin@enterprise.local`)
- Security Owner: Internal Auditor (`auditor@enterprise.local`)
- Operations Lead: Finance Controller (`finance@enterprise.local`)

## 3) Weekly Rotation Calendar (Pilot + Hypercare)
| Week (Mon-Sun) | L1 Primary | L1 Backup | L2 Primary | L3 Primary | Security |
|---|---|---|---|---|---|
| 2026-03-02 to 2026-03-08 | Travel Desk Operator | Department Manager | Department Manager | System Administrator | Internal Auditor |
| 2026-03-09 to 2026-03-15 | Travel Desk Operator | Finance Controller | Department Manager | System Administrator | Internal Auditor |
| 2026-03-16 to 2026-03-22 | Travel Desk Operator | Department Manager | Department Manager | System Administrator | Internal Auditor |
| 2026-03-23 to 2026-03-29 | Travel Desk Operator | Finance Controller | Department Manager | System Administrator | Internal Auditor |
| 2026-03-30 to 2026-04-05 | Travel Desk Operator | Department Manager | Department Manager | System Administrator | Internal Auditor |
| 2026-04-06 to 2026-04-12 | Travel Desk Operator | Finance Controller | Department Manager | System Administrator | Internal Auditor |
| 2026-04-13 to 2026-04-19 | Travel Desk Operator | Department Manager | Department Manager | System Administrator | Internal Auditor |

## 4) Handover Rules
1. Outgoing on-call shares unresolved incidents before shift/week end.
2. Incoming on-call confirms ownership in handover log.
3. `SEV-1` and `SEV-2` must include mitigation status and next ETA.
4. Any unresolved security ticket requires direct Security Owner acknowledgment.

## 5) Contact and Escalation Commands
- Manual daily run:
  ```bash
  npm run pilot:hypercare
  ```
- Weekly summary:
  ```bash
  npm run pilot:weekly-summary
  ```
- Executive Go/No-Go:
  ```bash
  npm run pilot:go-no-go
  ```

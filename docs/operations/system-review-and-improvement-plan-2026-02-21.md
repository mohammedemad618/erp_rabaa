# Enterprise Travel ERP: Full System Review and Improvement Plan

Date: 2026-02-21  
Scope: Frontend pages, API routes, auth/permissions, localization, quality gates, test coverage.

## 1) Review Summary

Automated checks run:
- `npm run lint` -> PASS
- `npm test` -> PASS (7/7)
- `npm run build` -> PASS
- `npm run pilot:security-gate` -> PASS

Important: quality gates are green, but manual review found critical gaps not currently covered by those gates.

## 2) Findings (Ordered by Severity)

### F-001 (Critical) - Unprotected API mutation endpoints outside travel domain
Evidence:
- `app/api/sales/orders/[orderId]/transition/route.ts:11`
- `app/api/ocr/extract/route.ts:261`
- `proxy.ts:37` (only protects `/api/travel`)

Impact:
- Unauthorized users can hit sensitive endpoints directly.
- Workflow state can be mutated without role checks.
- OCR upload endpoint is callable without auth boundary.

Action:
- Add `requireApiPermission(...)` guards to these endpoints.
- Extend proxy protection to all business APIs, not only `/api/travel`.
- Keep `/api/auth/*` public, protect everything else by default.

### F-002 (High) - Missing server-side permission guard on most ERP pages
Evidence:
- `app/[locale]/transactions/page.tsx:7`
- `app/[locale]/accounting/page.tsx:8`
- `app/[locale]/bsp/page.tsx:8`
- `app/[locale]/crm/page.tsx:8`
- `app/[locale]/expenses/page.tsx:8`
- `app/[locale]/ocr/page.tsx:8`
- `app/[locale]/reports/page.tsx:8`
- `app/[locale]/templates/page.tsx:8`
- `app/[locale]/treasury/page.tsx:8`
- Only guarded pages found:
  - `app/[locale]/travel/page.tsx:14`
  - `app/[locale]/settings/page.tsx:11`

Impact:
- Authenticated users can open pages by URL even if they should not have module access.

Action:
- Add `requirePermission(locale, "...", ...)` in every page entry.
- Create a route-to-permission map and enforce it centrally.

### F-003 (High) - Navigation permission model is incomplete
Evidence:
- `components/layout/app-shell.tsx:273`
- `components/layout/app-shell.tsx:279`

Impact:
- Sidebar hides only a subset of restricted routes (`/settings`, `/travel`).
- Other modules are treated as always accessible in UI.

Action:
- Replace hardcoded checks with a complete route-permission matrix.
- Use one shared permission source for both nav visibility and server page guard.

### F-004 (High) - Session signing secret has insecure fallback
Evidence:
- `services/auth/session.ts:5`
- `services/auth/session.ts:9`

Impact:
- If `AUTH_SESSION_SECRET` is missing in production, tokens become forgeable with known fallback value.

Action:
- Fail fast in production when secret is missing.
- Keep fallback only for explicit local-dev mode.

### F-005 (High) - Plaintext demo credentials exposed in code and login UI
Evidence:
- `services/auth/user-directory.ts:3`
- `services/auth/user-directory.ts:9`
- `app/[locale]/login/page.tsx:41`
- `app/[locale]/login/page.tsx:163`

Impact:
- Static credentials are visible in repository and UI.
- High risk if shipped beyond local demo environment.

Action:
- Move demo seeds to controlled dev-only bootstrap.
- Remove password display from UI.
- Disable demo accounts by environment flag outside development.

### F-006 (High) - Arabic localization is corrupted (mojibake)
Evidence:
- `messages/ar.json:3`
- `app/[locale]/forbidden/page.tsx:14`
- `app/[locale]/login/page.tsx:30`
- `components/layout/app-shell.tsx:425`

Impact:
- Arabic users see broken text and unreadable UI.
- Major usability and trust failure in RTL mode.

Action:
- Rebuild `messages/ar.json` in valid UTF-8.
- Move all hardcoded Arabic literals into i18n files.
- Add CI check to detect mojibake patterns before merge.

### F-007 (Medium) - Multiple API routes can throw 500 on malformed JSON
Evidence:
- `app/api/auth/login/route.ts:17`
- `app/api/travel/requests/route.ts:24`
- `app/api/travel/requests/[requestId]/transition/route.ts:33`
- `app/api/travel/requests/[requestId]/booking/route.ts:47`
- `app/api/travel/requests/[requestId]/expenses/route.ts:51`
- `app/api/travel/requests/[requestId]/expenses/[expenseId]/decision/route.ts:43`
- `app/api/travel/policy/simulate/route.ts:34`
- `app/api/travel/policy/versions/route.ts:26`
- `app/api/sales/orders/[orderId]/transition/route.ts:26`

Impact:
- Invalid request bodies may return unhandled 500 instead of controlled 4xx.

Action:
- Introduce shared `parseJsonBodySafe()` helper returning typed `400/422` errors.
- Add API contract tests for malformed payloads.

### F-008 (Medium) - Security gate coverage is too narrow
Evidence:
- `scripts/pilot/security-gate.ps1:202`
- `scripts/pilot/security-gate.ps1:214`
- `scripts/pilot/security-gate.ps1:230`

Impact:
- Gate reports PASS while critical non-travel endpoints remain uncovered.

Action:
- Expand security gate to include `/api/sales/*`, `/api/ocr/*`, and page-level access checks.
- Add explicit negative tests (unauthenticated + wrong role).

### F-009 (Medium) - Travel console is a very large monolith
Evidence:
- `modules/travel/components/travel-requests-console.tsx` (~3166 LOC)

Impact:
- Higher regression risk, harder UX consistency, slower future iteration.

Action:
- Split into domain sections: `RequestList`, `RequestFormWizard`, `PolicyPanel`, `OpsPanel`, `AuditPanel`.
- Move network and state orchestration to dedicated hooks/services.

## 3) Improvement Plan (Execution Roadmap)

### Phase 0 - Security and Access Hotfix (24-48 hours)
1. Protect all mutation APIs by default (server guard + proxy policy).
2. Add server-side permission guard to every module page.
3. Remove insecure session secret fallback in production.
4. Disable hardcoded demo credentials outside local development.

Exit criteria:
- No business API route without auth guard.
- Role mismatch returns 403 consistently.
- Production boot fails if session secret is missing.

### Phase 1 - Localization and Reliability (2-4 days)
1. Restore Arabic resources to clean UTF-8.
2. Centralize all Arabic/English labels into next-intl messages.
3. Add malformed JSON guard helper for all POST handlers.
4. Add regression tests for Arabic rendering and API validation errors.

Exit criteria:
- No corrupted Arabic strings in UI.
- All invalid JSON requests return deterministic 4xx errors.

### Phase 2 - UX Architecture Standardization (1-2 weeks)
1. Apply universal ERP page template:
   - Zone A: Page header + context
   - Zone B: KPI/overview row
   - Zone C: Actionable worklist + details split
   - Zone D: Tables and exports
   - Zone E: Admin controls (separate and permission-gated)
2. Enforce 12-column grid and spacing token rules.
3. Break long forms into guided multi-step flows where field count > 10.
4. Standardize detail tabs: `Overview | Workflow | Operations | Audit`.

Exit criteria:
- Consistent layout hierarchy across modules.
- Reduced cognitive load in travel and finance-heavy pages.

### Phase 3 - Quality Gate Hardening (3-5 days)
1. Upgrade security gate script coverage to all API domains.
2. Add page authorization integration tests by role.
3. Add i18n integrity check in CI (detect mojibake/corrupt encoding).
4. Add architecture lint rule for page guard enforcement.

Exit criteria:
- Gate can fail on unguarded API/page routes.
- Localization integrity is enforced automatically.

## 4) KPI Targets for Completion

- 100% page-level permission coverage.
- 100% protected business API coverage.
- 0 mojibake strings in Arabic UI.
- 0 unhandled malformed-body 500 errors.
- Travel module split into reusable subcomponents with reduced file complexity.

## 5) Recommended Implementation Order

1. Phase 0 (blocker for enterprise readiness)
2. Phase 1 (user-facing trust and stability)
3. Phase 2 (UX structure and scalability)
4. Phase 3 (long-term enforcement)

